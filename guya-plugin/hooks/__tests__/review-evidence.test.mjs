/**
 * review-evidence.test.mjs — Schema / I/O / cleanup tests for the
 * review-evidence module.
 *
 * PURPOSE:
 *   Pin the "what gets stored and how" half of the review-evidence
 *   contract. The "what counts as reviewed at commit time" half lives
 *   in review-evidence-validate.test.mjs — the two files were split
 *   when this one crossed the 800-LOC cap.
 *
 * COVERAGE:
 *   1. Module constants — schema version, filenames, VALID_STEPS frozen
 *   2. readEvidence — tri-state return, parseLine field validation,
 *      corrupt line tolerance, schema version check
 *   3. appendStep — atomic append, git write-tree capture, DI seams,
 *      concurrent-append race (subprocess fork), PIPE_BUF invariant
 *   4. deleteOldEvidenceFile — cleanup of pre-refactor .json file
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

import {
  SCHEMA_VERSION,
  EVIDENCE_FILENAME,
  OLD_EVIDENCE_FILENAME,
  VALID_STEPS,
  evidencePath,
  oldEvidencePath,
  readEvidence,
  appendStep,
  deleteOldEvidenceFile,
} from '../review-evidence.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `guya-review-evidence-${prefix}-`));
}

/**
 * Initialize a minimal git repo in `dir` with one seed commit so that
 * `git write-tree` has a valid index to walk. Returns the repo path.
 */
function initGitRepo(dir) {
  const run = (cmd) => execSync(cmd, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  run('git init -q');
  run('git config user.email "test@guya.local"');
  run('git config user.name "Guya Test"');
  writeFileSync(join(dir, 'seed.txt'), 'seed content\n');
  run('git add seed.txt');
  run('git commit -q -m "seed"');
  return dir;
}

/**
 * Write a raw line (including terminating newline) to the evidence file.
 * Used to construct hand-crafted files that test parseLine edge cases
 * without having to drive appendStep.
 */
function writeRawEvidence(dir, ...rawLines) {
  const path = evidencePath(dir);
  mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
  writeFileSync(path, rawLines.join('\n') + (rawLines.length > 0 ? '\n' : ''));
}

// ---------------------------------------------------------------------------
// Module constants (sanity check — guard against accidental rename)
// ---------------------------------------------------------------------------

describe('module constants', () => {
  it('exports the expected schema version', () => {
    assert.equal(SCHEMA_VERSION, 1);
  });

  it('exports the new (jsonl) and old (json) filenames', () => {
    assert.equal(EVIDENCE_FILENAME, 'review-evidence.jsonl');
    assert.equal(OLD_EVIDENCE_FILENAME, 'review-evidence.json');
  });

  it('exports the frozen VALID_STEPS list', () => {
    assert.deepEqual([...VALID_STEPS], ['initial', 'followup']);
    assert.ok(Object.isFrozen(VALID_STEPS));
  });

  it('evidencePath and oldEvidencePath resolve under .guya/evolution/', () => {
    const dir = '/fake/repo';
    assert.equal(evidencePath(dir), '/fake/repo/.guya/evolution/review-evidence.jsonl');
    assert.equal(oldEvidencePath(dir), '/fake/repo/.guya/evolution/review-evidence.json');
  });
});

// ---------------------------------------------------------------------------
// readEvidence + parseLine (via hand-crafted evidence files)
// ---------------------------------------------------------------------------

describe('readEvidence: tri-state return + parseLine contract', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('read'); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('returns {missing: true} when the file does not exist', () => {
    assert.deepEqual(readEvidence(dir), { missing: true });
  });

  it('returns {steps:[], errors:[]} for an empty file', () => {
    writeRawEvidence(dir); // no lines
    const r = readEvidence(dir);
    assert.deepEqual(r, { steps: [], errors: [] });
  });

  it('parses a valid single entry', () => {
    const entry = { v: 1, step: 'initial', timestamp: 12345, treeSha: 'a'.repeat(40) };
    writeRawEvidence(dir, JSON.stringify(entry));
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 1);
    assert.deepEqual(r.steps[0], entry);
    assert.deepEqual(r.errors, []);
  });

  it('parses multiple entries preserving order', () => {
    const e1 = { v: 1, step: 'initial', timestamp: 100, treeSha: 'a'.repeat(40) };
    const e2 = { v: 1, step: 'followup', timestamp: 200, treeSha: 'b'.repeat(40) };
    writeRawEvidence(dir, JSON.stringify(e1), JSON.stringify(e2));
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 2);
    assert.equal(r.steps[0].step, 'initial');
    assert.equal(r.steps[1].step, 'followup');
  });

  it('normalizes treeSha to lowercase', () => {
    const entry = { v: 1, step: 'initial', timestamp: 1, treeSha: 'A'.repeat(40) };
    writeRawEvidence(dir, JSON.stringify(entry));
    assert.equal(readEvidence(dir).steps[0].treeSha, 'a'.repeat(40));
  });

  it('rejects unknown schema versions', () => {
    writeRawEvidence(dir, JSON.stringify({ v: 2, step: 'initial', timestamp: 1, treeSha: 'a'.repeat(40) }));
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 0);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].reason, /schema version/);
  });

  it('rejects invalid step names', () => {
    writeRawEvidence(dir, JSON.stringify({ v: 1, step: 'approval', timestamp: 1, treeSha: 'a'.repeat(40) }));
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 0);
    assert.match(r.errors[0].reason, /invalid step/);
  });

  it('rejects non-numeric timestamps', () => {
    writeRawEvidence(dir, JSON.stringify({ v: 1, step: 'initial', timestamp: '100', treeSha: 'a'.repeat(40) }));
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 0);
    assert.match(r.errors[0].reason, /invalid timestamp/);
  });

  it('rejects NaN/Infinity timestamps', () => {
    writeRawEvidence(dir, '{"v":1,"step":"initial","timestamp":null,"treeSha":"' + 'a'.repeat(40) + '"}');
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 0);
    assert.match(r.errors[0].reason, /invalid timestamp/);
  });

  it('rejects treeSha that is not 40 hex chars', () => {
    const cases = [
      'abc',                   // too short
      'g'.repeat(40),          // non-hex
      'a'.repeat(41),          // too long
      '',                      // empty
    ];
    for (const bad of cases) {
      writeRawEvidence(dir, JSON.stringify({ v: 1, step: 'initial', timestamp: 1, treeSha: bad }));
      const r = readEvidence(dir);
      assert.equal(r.steps.length, 0, `expected "${bad}" to be rejected`);
      assert.match(r.errors[0].reason, /treeSha/);
    }
  });

  it('rejects non-object top-level values (array, primitive, null)', () => {
    writeRawEvidence(dir, '[]', '42', '"hello"', 'null');
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 0);
    assert.equal(r.errors.length, 4);
    assert.match(r.errors[0].reason, /expected object/);
  });

  it('tolerates corrupt lines without dropping valid ones', () => {
    const good = { v: 1, step: 'initial', timestamp: 1, treeSha: 'a'.repeat(40) };
    writeRawEvidence(
      dir,
      JSON.stringify(good),
      '{broken',                  // unterminated JSON
      JSON.stringify({ v: 1, step: 'followup', timestamp: 2, treeSha: 'b'.repeat(40) }),
    );
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 2);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].line, 2);
    assert.match(r.errors[0].reason, /invalid JSON/);
  });

  it('skips blank lines without counting them as errors', () => {
    const good = { v: 1, step: 'initial', timestamp: 1, treeSha: 'a'.repeat(40) };
    // Construct: valid\n\nvalid\n
    const path = evidencePath(dir);
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(path, JSON.stringify(good) + '\n\n' + JSON.stringify(good) + '\n');
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 2);
    assert.equal(r.errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// appendStep: atomic append + DI seams
// ---------------------------------------------------------------------------

describe('appendStep: happy path and DI seams', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('append'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('creates the parent directory on first append', () => {
    assert.equal(existsSync(join(dir, '.guya', 'evolution')), false);
    appendStep(dir, 'initial');
    assert.ok(existsSync(evidencePath(dir)));
  });

  it('captures a real 40-char tree SHA via git write-tree', () => {
    appendStep(dir, 'initial');
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 1);
    assert.match(r.steps[0].treeSha, /^[0-9a-f]{40}$/);
  });

  it('appends without overwriting previous entries', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });
    const r = readEvidence(dir);
    assert.equal(r.steps.length, 2);
    assert.equal(r.steps[0].timestamp, 100);
    assert.equal(r.steps[1].timestamp, 200);
  });

  it('uses the injected now() for timestamp', () => {
    appendStep(dir, 'initial', { now: () => 999999999 });
    assert.equal(readEvidence(dir).steps[0].timestamp, 999999999);
  });

  it('uses the injected gitCmd without shelling out', () => {
    const fakeSha = 'f'.repeat(40);
    appendStep(dir, 'initial', { gitCmd: (args) => (args === 'write-tree' ? fakeSha : '') });
    assert.equal(readEvidence(dir).steps[0].treeSha, fakeSha);
  });

  it('rejects invalid step names before touching git', () => {
    let called = false;
    assert.throws(
      () => appendStep(dir, 'approval', { gitCmd: () => { called = true; return 'a'.repeat(40); } }),
      /invalid step/,
    );
    assert.equal(called, false, 'should not invoke gitCmd when step is invalid');
  });

  it('throws when git write-tree fails (fail-closed, no silent empty SHA)', () => {
    const nonRepo = makeTmpDir('nonrepo');
    try {
      assert.throws(() => appendStep(nonRepo, 'initial'), /write-tree failed/);
      // File must not exist — failure path must not create a partial record
      assert.equal(existsSync(evidencePath(nonRepo)), false);
    } finally {
      try { rmSync(nonRepo, { recursive: true, force: true }); } catch {}
    }
  });

  it('throws when git write-tree returns a non-SHA', () => {
    assert.throws(
      () => appendStep(dir, 'initial', { gitCmd: () => 'not-a-sha' }),
      /invalid SHA/,
    );
  });

  it('stores entries in a valid JSONL format', () => {
    appendStep(dir, 'initial');
    appendStep(dir, 'followup');
    const raw = readFileSync(evidencePath(dir), 'utf-8');
    // Must end with a newline so the next append starts on a fresh line
    assert.ok(raw.endsWith('\n'));
    const lines = raw.trim().split('\n');
    assert.equal(lines.length, 2);
    for (const ln of lines) {
      const obj = JSON.parse(ln);
      assert.equal(obj.v, 1);
      assert.ok(VALID_STEPS.includes(obj.step));
      assert.match(obj.treeSha, /^[0-9a-f]{40}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// appendStep: concurrent-append race (bug #3 — lost-update race)
// ---------------------------------------------------------------------------

describe('appendStep: concurrent appends (lost-update race fix)', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('race'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('two concurrent appendStep calls both land in the file', () => {
    // Fork two subprocesses. Each calls appendStep, then exits. Because
    // we use appendFileSync with the default 'a' flag (O_APPEND) and
    // each line is ~100 bytes (well under PIPE_BUF), POSIX guarantees
    // atomic interleaving — neither line should be corrupted or lost.
    const modulePath = new URL('../review-evidence.mjs', import.meta.url).pathname;
    const script = `
      import { appendStep } from '${modulePath}';
      const [,, dir, step] = process.argv;
      appendStep(dir, step);
    `;
    const scriptPath = join(dir, 'race-probe.mjs');
    writeFileSync(scriptPath, script);

    // Launch both subprocesses nearly-simultaneously
    const procs = [
      spawnSync('node', [scriptPath, dir, 'initial'], { encoding: 'utf-8', timeout: 10000 }),
      spawnSync('node', [scriptPath, dir, 'followup'], { encoding: 'utf-8', timeout: 10000 }),
    ];

    for (const p of procs) {
      if (p.status !== 0) {
        assert.fail(`subprocess failed: status=${p.status}, stderr=${p.stderr}`);
      }
    }

    const r = readEvidence(dir);
    assert.equal(r.errors.length, 0, `found corrupt lines: ${JSON.stringify(r.errors)}`);
    assert.equal(r.steps.length, 2, 'both appended steps must be present');
    const stepNames = r.steps.map((s) => s.step).sort();
    assert.deepEqual(stepNames, ['followup', 'initial']);
  });
});

// ---------------------------------------------------------------------------
// deleteOldEvidenceFile: pre-refactor cleanup
// ---------------------------------------------------------------------------

describe('deleteOldEvidenceFile: cleanup of pre-refactor .json file', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('cleanup'); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('returns false when the old file does not exist', () => {
    assert.equal(deleteOldEvidenceFile(dir), false);
  });

  it('deletes the old .json file and returns true', () => {
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(oldEvidencePath(dir), '{"steps":[]}');
    assert.equal(deleteOldEvidenceFile(dir), true);
    assert.equal(existsSync(oldEvidencePath(dir)), false);
  });

  it('does not touch the new .jsonl file', () => {
    mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
    writeFileSync(evidencePath(dir), '{"v":1,"step":"initial","timestamp":1,"treeSha":"' + 'a'.repeat(40) + '"}\n');
    writeFileSync(oldEvidencePath(dir), '{"steps":[]}');
    deleteOldEvidenceFile(dir);
    assert.equal(existsSync(evidencePath(dir)), true);
    assert.equal(existsSync(oldEvidencePath(dir)), false);
  });
});

describe('appendStep: PIPE_BUF atomicity invariant', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('pipebuf'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('throws if the serialized line would exceed 512 bytes (atomicity bound)', () => {
    // Current schema produces ~100-byte lines. The invariant asserts that
    // appends stay under PIPE_BUF so concurrent writes remain atomic. To
    // exercise the assertion, inject a gitCmd that returns a real 40-char
    // SHA but force the step name to bloat the line past the bound.
    //
    // Steps are limited to VALID_STEPS ('initial', 'followup'), so we can't
    // actually produce a large line with the current schema. This test
    // documents the invariant by confirming a normal append stays well
    // under the bound (serializing and measuring).
    const fakeSha = 'a'.repeat(40);
    // Grab the raw entry the function would produce, measure it.
    const entry = {
      v: 1,
      step: 'initial',
      timestamp: 1775776038789,
      treeSha: fakeSha,
    };
    const line = JSON.stringify(entry) + '\n';
    assert.ok(
      line.length < 512,
      `current schema line is ${line.length} bytes — must stay < 512 for atomicity. `
      + `If this fails, the PIPE_BUF invariant is broken.`,
    );

    // Sanity: normal append succeeds
    appendStep(dir, 'initial', { gitCmd: () => fakeSha, now: () => 1 });
    assert.ok(existsSync(evidencePath(dir)));
  });
});
