/**
 * pre-commit-review-e2e.test.mjs — End-to-end tests for the pre-commit
 * review gate. Spawns the real hook as a subprocess against real git
 * repos to verify the full orchestration, not just the module in
 * isolation.
 *
 * PURPOSE:
 *   The unit tests in review-evidence.test.mjs cover the module surface
 *   (readEvidence, appendStep, validateForCommit). This file covers what
 *   those unit tests can't: the hook's main() orchestration, the stdin
 *   protocol, the exit-code contract, the interaction with real git
 *   commands, and the old-file migration path.
 *
 * COVERAGE:
 *   1. Evidence recording via Skill tool_name → appendStep fires
 *   2. Happy path: record initial + followup, attempt commit → allow
 *   3. Tree mismatch with small delta → allow with stderr note
 *   4. Tree mismatch with large delta → block
 *   5. Missing evidence → block
 *   6. --no-verify → block (unconditional)
 *   7. Small change skips review entirely
 *   8. Legacy review-evidence.json file cleaned up on hook entry
 *   9. All files exempt → skip
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const HOOK_PATH = join(__dirname, '..', 'guya-pre-commit-review.mjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `guya-gate-e2e-${prefix}-`));
}

/**
 * Initialize a git repo with an initial commit + a project-level
 * pre-commit-config.json that enables the gate. Also writes a fake user
 * config path so loadConfig uses project-only config in the test.
 */
function initFixtureRepo(config = {}) {
  const dir = makeTmpDir('repo');
  const run = (cmd) => execSync(cmd, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  run('git init -q');
  run('git config user.email "test@guya.local"');
  run('git config user.name "Guya Test"');
  writeFileSync(join(dir, 'seed.txt'), 'seed\n');
  run('git add seed.txt');
  run('git commit -q -m "seed"');

  // Enable the gate with a low threshold so small-change bypass is
  // predictable, and a short max age so we can test the boundaries.
  const projectConfig = {
    gateMaxAgeMinutes: 30,
    smallChange: { maxLines: 10 },
    ...config,
  };
  mkdirSync(join(dir, '.guya'), { recursive: true });
  writeFileSync(
    join(dir, '.guya', 'pre-commit-config.json'),
    JSON.stringify(projectConfig),
  );

  return dir;
}

/**
 * Spawn the real hook as a subprocess with the given tool call payload
 * piped to stdin. Returns { stdout, stderr, status } — stdout contains
 * the hook's JSON decision.
 *
 * IMPORTANT: HOME is overridden to the tmp directory so that the hook's
 * `homedir()`-derived USER_CONFIG_PATH points at a non-existent file.
 * Without this, tests run on a dev machine would read Daniel's real
 * `~/.claude/guya/pre-commit-config.json` as a fallback, silently
 * polluting the test with project-specific path/review exemptions.
 * Every E2E test must run against ONLY the project config it sets up.
 */
function runHook(dir, toolCallJson) {
  const r = spawnSync('node', [HOOK_PATH], {
    cwd: dir,
    input: JSON.stringify({ ...toolCallJson, cwd: dir }),
    encoding: 'utf-8',
    timeout: 10000,
    env: { ...process.env, HOME: dir },
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function parseDecision(stdout) {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

function evidenceFile(dir) {
  return join(dir, '.guya', 'evolution', 'review-evidence.jsonl');
}

// ---------------------------------------------------------------------------
// Evidence recording via Skill tool_name
// ---------------------------------------------------------------------------

describe('pre-commit-review e2e: evidence recording via Skill calls', () => {
  let dir;
  beforeEach(() => { dir = initFixtureRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('karpathy-review skill call records an initial step with real treeSha', () => {
    const r = runHook(dir, {
      tool_name: 'Skill',
      tool_input: { skill: 'karpathy-review' },
    });
    assert.equal(r.status, 0);
    assert.ok(existsSync(evidenceFile(dir)));

    const raw = readFileSync(evidenceFile(dir), 'utf-8').trim();
    const entry = JSON.parse(raw);
    assert.equal(entry.v, 1);
    assert.equal(entry.step, 'initial');
    assert.match(entry.treeSha, /^[0-9a-f]{40}$/);
  });

  it('review-followup skill call records a followup step', () => {
    const r = runHook(dir, {
      tool_name: 'Skill',
      tool_input: { skill: 'review-followup' },
    });
    assert.equal(r.status, 0);
    const entry = JSON.parse(readFileSync(evidenceFile(dir), 'utf-8').trim());
    assert.equal(entry.step, 'followup');
  });

  it('/cr skill call records an initial step (cr is aliased to initial)', () => {
    const r = runHook(dir, {
      tool_name: 'Skill',
      tool_input: { skill: 'cr' },
    });
    assert.equal(r.status, 0);
    const entry = JSON.parse(readFileSync(evidenceFile(dir), 'utf-8').trim());
    assert.equal(entry.step, 'initial');
  });

  it('non-review Skill call is a no-op', () => {
    const r = runHook(dir, {
      tool_name: 'Skill',
      tool_input: { skill: 'random-skill' },
    });
    assert.equal(r.status, 0);
    assert.equal(existsSync(evidenceFile(dir)), false);
  });
});

// ---------------------------------------------------------------------------
// Commit gating — full flow
// ---------------------------------------------------------------------------

describe('pre-commit-review e2e: happy path and failure modes', () => {
  let dir;
  beforeEach(() => { dir = initFixtureRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  /**
   * Stage a medium-sized change (over the small-change threshold) so
   * the gate actually fires instead of short-circuiting via isSmallChange.
   */
  function stageLargeChange() {
    writeFileSync(join(dir, 'feature.py'), 'def f():\n'.repeat(20));
    execSync('git add feature.py', { cwd: dir });
  }

  function recordReview(skill) {
    const r = runHook(dir, { tool_name: 'Skill', tool_input: { skill } });
    assert.equal(r.status, 0, `recording ${skill} failed: ${r.stderr}`);
  }

  function attemptCommit(message = 'attempt') {
    return runHook(dir, {
      tool_name: 'Bash',
      tool_input: { command: `git commit -m "${message}"` },
    });
  }

  it('happy path: stage → karpathy-review → review-followup → commit allowed', () => {
    stageLargeChange();
    recordReview('karpathy-review');
    recordReview('review-followup');
    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue, `expected continue:true, got ${r.stdout}`);
    assert.match(r.stderr, /Review evidence valid/);
  });

  it('blocks commit when no evidence has been recorded', () => {
    stageLargeChange();
    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /No review evidence/);
  });

  it('blocks commit with only initial step (missing followup)', () => {
    stageLargeChange();
    recordReview('karpathy-review');
    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /Missing followup/);
  });

  it('allows commit with small delta since followup (within threshold)', () => {
    stageLargeChange();
    recordReview('karpathy-review');
    recordReview('review-followup');

    // Add a tiny post-review fix: 3 new lines
    writeFileSync(join(dir, 'tiny.txt'), 'a\nb\nc\n');
    execSync('git add tiny.txt', { cwd: dir });

    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue);
    assert.match(r.stderr, /Small delta since review/);
    assert.match(r.stderr, /3 lines/);
  });

  it('blocks commit with large delta since followup (over threshold)', () => {
    stageLargeChange();
    recordReview('karpathy-review');
    recordReview('review-followup');

    // Add 30 lines of unreviewed content — above maxLines=10
    writeFileSync(join(dir, 'sneak.py'), 'x = 1\n'.repeat(30));
    execSync('git add sneak.py', { cwd: dir });

    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /lines changed since review/);
  });

  it('--no-verify is unconditionally blocked (before evidence check)', () => {
    stageLargeChange();
    recordReview('karpathy-review');
    recordReview('review-followup');
    // Even with valid evidence, --no-verify is still blocked.
    const r = runHook(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit --no-verify -m "bypass attempt"' },
    });
    const decision = parseDecision(r.stdout);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /--no-verify/);
  });

  it('small change (under threshold) skips review entirely', () => {
    // Only 2 lines staged — under the 10-line smallChange threshold.
    // Evidence should not be required.
    writeFileSync(join(dir, 'tiny.txt'), 'one\ntwo\n');
    execSync('git add tiny.txt', { cwd: dir });

    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue, `expected continue:true, got ${r.stdout}`);
    assert.match(r.stderr, /Small change/);
  });

  it('allows commit when all staged files match reviewExempt patterns', () => {
    // Configure exemption in a fresh repo so loadConfig sees it.
    rmSync(dir, { recursive: true, force: true });
    dir = initFixtureRepo({ reviewExempt: ['*.md'] });
    writeFileSync(join(dir, 'docs.md'), '# heading\n'.repeat(20));
    execSync('git add docs.md', { cwd: dir });

    const r = attemptCommit();
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue, `expected continue:true, got ${r.stdout}`);
    assert.match(r.stderr, /exempt/);
  });
});

// ---------------------------------------------------------------------------
// Legacy file cleanup
// ---------------------------------------------------------------------------

describe('pre-commit-review e2e: legacy review-evidence.json cleanup', () => {
  let dir;
  beforeEach(() => { dir = initFixtureRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('deletes the legacy .json file on any hook invocation', () => {
    // Pre-populate the pre-refactor file
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    const legacyPath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    writeFileSync(legacyPath, JSON.stringify({ steps: [], contentHash: 'fake' }));
    assert.ok(existsSync(legacyPath));

    // Any hook call triggers deleteOldEvidenceFile
    runHook(dir, { tool_name: 'Bash', tool_input: { command: 'git status' } });

    assert.equal(existsSync(legacyPath), false, 'legacy .json should be deleted');
  });

  it('does not touch the new .jsonl file while cleaning up the legacy one', () => {
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    const legacyPath = join(dir, '.guya', 'evolution', 'review-evidence.json');
    writeFileSync(legacyPath, '{}');
    const newPath = evidenceFile(dir);
    const validEntry = JSON.stringify({
      v: 1, step: 'initial', timestamp: Date.now(), treeSha: 'a'.repeat(40),
    }) + '\n';
    writeFileSync(newPath, validEntry);

    runHook(dir, { tool_name: 'Bash', tool_input: { command: 'git status' } });

    assert.equal(existsSync(legacyPath), false);
    assert.equal(readFileSync(newPath, 'utf-8'), validEntry, 'new file must survive');
  });
});

// ---------------------------------------------------------------------------
// Observability: corrupt-line warnings surfaced to stderr
// ---------------------------------------------------------------------------

describe('pre-commit-review e2e: corrupt evidence lines are reported to stderr', () => {
  let dir;
  beforeEach(() => { dir = initFixtureRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('surfaces a stderr warning when the evidence file has a mix of valid and corrupt lines', () => {
    // Stage a large change so the gate fires and main() reaches the
    // evidence-validation code path (where the warning is emitted).
    writeFileSync(join(dir, 'feature.py'), 'def f():\n'.repeat(20));
    execSync('git add feature.py', { cwd: dir });

    // Pre-populate the jsonl with valid steps interleaved with a
    // corrupt line. Valid steps have the staged tree SHA so tree
    // identity can be validated (not strictly required for this test,
    // but keeps the block path clean).
    const tree = execSync('git write-tree', { cwd: dir, encoding: 'utf-8' }).trim();
    const entries = [
      JSON.stringify({ v: 1, step: 'initial', timestamp: Date.now() - 1000, treeSha: tree }),
      '{not actually json', // corrupt line — must be reported
      JSON.stringify({ v: 1, step: 'followup', timestamp: Date.now(), treeSha: tree }),
    ];
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(evidenceFile(dir), entries.join('\n') + '\n');

    const r = runHook(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m test' },
    });

    assert.match(r.stderr, /warning: 1 corrupt evidence line/);
    assert.match(r.stderr, /line 2/);
    assert.match(r.stderr, /invalid JSON/);

    // Validation itself should still proceed with the valid steps and
    // pass (tree matches, both steps present) — the warning is
    // informational, not blocking.
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue, `expected continue:true, got ${r.stdout}`);
  });

  it('does not emit a warning when all lines are valid', () => {
    writeFileSync(join(dir, 'feature.py'), 'def f():\n'.repeat(20));
    execSync('git add feature.py', { cwd: dir });

    // Use the real skill flow to populate evidence
    runHook(dir, { tool_name: 'Skill', tool_input: { skill: 'karpathy-review' } });
    runHook(dir, { tool_name: 'Skill', tool_input: { skill: 'review-followup' } });

    const r = runHook(dir, {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m test' },
    });

    assert.doesNotMatch(r.stderr, /corrupt evidence/);
    const decision = parseDecision(r.stdout);
    assert.ok(decision.continue);
  });
});
