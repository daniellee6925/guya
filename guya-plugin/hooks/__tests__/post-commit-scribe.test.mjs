/**
 * post-commit-scribe.test.mjs — wipe-on-blocked-commit fix
 *
 * PURPOSE:
 *   Locks in the HEAD-advance check that drives the gate-reset decision.
 *   Historical bug: main() used to reset review-evidence.json on every
 *   Bash tool call matching isGitCommit, even when the commit was
 *   blocked by PreToolUse and HEAD never advanced. Codex's counterexample:
 *   the first patch tried to use appendCommit's STATUS.md dedup as the
 *   "HEAD advanced" signal, but that broke in the missing-STATUS.md case.
 *
 *   The proper fix: a dedicated marker file `.guya/evolution/last-scribe-head`
 *   tracks the full SHA the scribe last processed. main() compares current
 *   `git rev-parse HEAD` to the marker; if unchanged, skip everything.
 *
 * COVERAGE:
 *   - appendCommit's narrow role (STATUS.md display dedup) — same unit
 *     tests as before, but the comments no longer claim it drives gate
 *     decisions
 *   - HEAD marker helpers (readHeadMarker, writeHeadMarker) with tmp files
 *   - Integration: spawn the real hook as a subprocess against a real
 *     git repo fixture, verify that a matched-but-didn't-advance tool
 *     call does NOT wipe review-evidence.json
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  appendCommit,
  headMarkerPath,
  getCurrentHeadSha,
  readHeadMarker,
  writeHeadMarker,
} from '../guya-post-commit-scribe.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCRIBE_PATH = join(__dirname, '..', 'guya-post-commit-scribe.mjs');

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `guya-scribe-${prefix}-`));
}

// ---------------------------------------------------------------------------
// appendCommit: narrow STATUS.md display behavior
// ---------------------------------------------------------------------------

describe('appendCommit: STATUS.md display-level behavior', () => {
  let dir;

  beforeEach(() => { dir = makeTmpDir('append'); });
  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  it('returns true and writes skeleton when STATUS.md does not exist', () => {
    const commit = { hash: 'abc1234', message: 'test commit', date: '2026-04-09' };
    const result = appendCommit(dir, commit);
    assert.equal(result, true);
    const statusPath = join(dir, 'STATUS.md');
    assert.ok(existsSync(statusPath));
    const content = readFileSync(statusPath, 'utf-8');
    assert.match(content, /abc1234/);
    assert.match(content, /test commit/);
  });

  it('returns true when appending a new commit to an existing STATUS.md', () => {
    const statusPath = join(dir, 'STATUS.md');
    writeFileSync(statusPath, `# test
> Last updated: 2026-04-01

## Recent Changes
- [2026-04-01] \`oldhash1\` — previous commit
`);
    const commit = { hash: 'newhash2', message: 'new commit', date: '2026-04-09' };
    assert.equal(appendCommit(dir, commit), true);
    const content = readFileSync(statusPath, 'utf-8');
    assert.match(content, /newhash2/);
    assert.match(content, /oldhash1/);
  });

  it('returns false (dedup) when the commit hash is already in STATUS.md — display-only signal', () => {
    // This is NOT the signal that drives gate reset. main() uses the
    // HEAD marker file instead. This return value just avoids duplicate
    // log lines in the human-facing Recent Changes section.
    const statusPath = join(dir, 'STATUS.md');
    writeFileSync(statusPath, `# test
## Recent Changes
- [2026-04-09] \`samehash\` — already logged
`);
    const before = readFileSync(statusPath, 'utf-8');
    assert.equal(
      appendCommit(dir, { hash: 'samehash', message: 'x', date: '2026-04-09' }),
      false,
    );
    assert.equal(readFileSync(statusPath, 'utf-8'), before);
  });
});

// ---------------------------------------------------------------------------
// HEAD marker helpers
// ---------------------------------------------------------------------------

describe('HEAD marker helpers', () => {
  let dir;
  let markerPath;

  beforeEach(() => {
    dir = makeTmpDir('marker');
    markerPath = headMarkerPath(dir);
  });
  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  it('readHeadMarker returns null when the file does not exist', () => {
    assert.equal(readHeadMarker(markerPath), null);
  });

  it('writeHeadMarker then readHeadMarker round-trips a SHA', () => {
    const sha = 'deadbeef'.repeat(5);
    assert.equal(sha.length, 40);
    const wrote = writeHeadMarker(markerPath, sha);
    assert.equal(wrote, true);
    assert.equal(readHeadMarker(markerPath), sha);
  });

  it('readHeadMarker trims whitespace', () => {
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(markerPath, '  deadbeef\n  ');
    assert.equal(readHeadMarker(markerPath), 'deadbeef');
  });

  it('readHeadMarker returns null on empty file', () => {
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(markerPath, '');
    assert.equal(readHeadMarker(markerPath), null);
  });

  it('writeHeadMarker creates parent directories if missing', () => {
    const sha = 'abc'.repeat(14);
    assert.equal(writeHeadMarker(markerPath, sha), true);
    assert.ok(existsSync(markerPath));
  });

  it('getCurrentHeadSha returns null for non-git directory', () => {
    const nonRepo = makeTmpDir('nonrepo');
    try {
      assert.equal(getCurrentHeadSha(nonRepo), null);
    } finally {
      try { rmSync(nonRepo, { recursive: true, force: true }); } catch {}
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: spawn the real hook against a real git repo, verify
// that a blocked-commit tool call does NOT wipe review-evidence.json
// ---------------------------------------------------------------------------

function initFixtureRepo() {
  const dir = makeTmpDir('integration');
  // Minimal local git setup so `git rev-parse HEAD` works.
  const run = (cmd) => execSync(cmd, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  run('git init -q');
  run('git config user.email "test@guya.local"');
  run('git config user.name "Guya Test"');
  writeFileSync(join(dir, 'README.md'), 'seed\n');
  run('git add README.md');
  run('git commit -q -m "initial"');
  return dir;
}

function runScribe(dir, toolCallJson) {
  // Spawn the real scribe binary with the payload piped to stdin.
  const r = spawnSync('node', [SCRIBE_PATH], {
    cwd: dir,
    input: JSON.stringify(toolCallJson),
    encoding: 'utf-8',
    timeout: 10000,
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('scribe integration: blocked commit does not wipe evidence (the core fix)', () => {
  let dir;

  beforeEach(() => { dir = initFixtureRepo(); });
  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  it('first-run bootstrap: HEAD != marker (null) → processes once, writes marker', () => {
    // No marker file yet. Scribe should treat this as "new commit" and
    // process it (write marker, reset gate if present).
    const evidencePath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(evidencePath, JSON.stringify({ steps: [{ step: 'initial', timestamp: Date.now() }] }));

    const r = runScribe(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "seed"' },
      cwd: dir,
    });
    assert.equal(r.status, 0);

    // Marker should now be the current HEAD sha.
    const markerPath = join(dir, '.guya', 'evolution', 'last-scribe-head');
    assert.ok(existsSync(markerPath));
    const markerContent = readFileSync(markerPath, 'utf-8').trim();
    assert.equal(markerContent.length, 40, 'marker must be full 40-char SHA');

    // First-run bootstrap wiped the gate. This is the accepted one-time
    // cost of establishing the marker.
    const evidenceAfter = JSON.parse(readFileSync(evidencePath, 'utf-8'));
    assert.deepEqual(evidenceAfter, { steps: [] });
  });

  it('HEAD unchanged (blocked commit scenario): marker == HEAD → SKIP reset', () => {
    // THIS is the core fix. Pre-populate the marker with the current HEAD
    // to simulate "scribe already processed this commit last time". Then
    // simulate a blocked commit attempt — the scribe should see HEAD
    // unchanged and skip the reset, preserving the gate evidence.
    const currentHead = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    const markerPath = join(dir, '.guya', 'evolution', 'last-scribe-head');
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(markerPath, currentHead);

    // Populate evidence file with a review record to prove it survives.
    const evidencePath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    const originalEvidence = {
      steps: [
        { step: 'initial', timestamp: Date.now() - 1000 },
        { step: 'followup', timestamp: Date.now() },
      ],
    };
    writeFileSync(evidencePath, JSON.stringify(originalEvidence));

    // Simulate a blocked commit: matched-regex tool call, but HEAD hasn't
    // advanced since the last scribe run.
    const r = runScribe(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "would-be-blocked"' },
      cwd: dir,
    });
    assert.equal(r.status, 0);

    // Evidence file must be UNCHANGED. This is the bug-fix contract.
    const evidenceAfter = JSON.parse(readFileSync(evidencePath, 'utf-8'));
    assert.deepEqual(
      evidenceAfter,
      originalEvidence,
      'review-evidence.json must NOT be wiped when HEAD did not advance',
    );
  });

  it('HEAD advanced (real new commit): marker != HEAD → process + reset + update marker', () => {
    // Set marker to an old (fake) SHA so HEAD != marker.
    const oldFakeSha = '0000000000000000000000000000000000000000';
    const markerPath = join(dir, '.guya', 'evolution', 'last-scribe-head');
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(markerPath, oldFakeSha);

    const evidencePath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    writeFileSync(evidencePath, JSON.stringify({ steps: [{ step: 'initial', timestamp: 1 }] }));

    const r = runScribe(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "new"' },
      cwd: dir,
    });
    assert.equal(r.status, 0);

    // Marker should be updated to current HEAD.
    const newMarker = readFileSync(markerPath, 'utf-8').trim();
    const currentHead = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    assert.equal(newMarker, currentHead);

    // Evidence wiped because HEAD advanced (from the fake marker).
    assert.deepEqual(JSON.parse(readFileSync(evidencePath, 'utf-8')), { steps: [] });
  });

  it('non-commit Bash call (git status) never reaches the HEAD check', () => {
    // Control case: isGitCommit returns false, scribe short-circuits
    // before the HEAD/marker logic runs. Evidence and marker untouched.
    const evidencePath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(evidencePath, JSON.stringify({ steps: [{ step: 'initial', timestamp: 1 }] }));

    const markerPath = join(dir, '.guya', 'evolution', 'last-scribe-head');
    assert.equal(existsSync(markerPath), false);

    const r = runScribe(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      cwd: dir,
    });
    assert.equal(r.status, 0);

    // Nothing should have been touched.
    assert.equal(existsSync(markerPath), false, 'marker should not be created for non-commit calls');
    assert.deepEqual(
      JSON.parse(readFileSync(evidencePath, 'utf-8')),
      { steps: [{ step: 'initial', timestamp: 1 }] },
    );
  });
});
