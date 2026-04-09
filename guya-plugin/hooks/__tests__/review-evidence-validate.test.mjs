/**
 * review-evidence-validate.test.mjs — validateForCommit failure-mode matrix.
 *
 * PURPOSE:
 *   Every failure mode listed in the "What counts as reviewed" spec at
 *   the top of review-evidence.mjs must have at least one test here.
 *   This file is the authoritative pin for the commit-time gating
 *   contract — if one of these tests fails, something in the spec has
 *   changed and the spec comment must be updated to match (or the code
 *   reverted).
 *
 *   Split out of review-evidence.test.mjs when that file crossed the
 *   800-LOC cap. The split is purely organizational: readEvidence /
 *   appendStep / deleteOldEvidenceFile tests stayed in the original,
 *   validateForCommit tests live here. Both files share the same
 *   fixture helpers (duplicated for now — if they grow further we can
 *   extract a shared test-util module).
 *
 * COVERAGE:
 *   1. Happy paths — tree match, delta within tolerance, repeated steps
 *   2. Evidence file failure modes — missing, empty, all-corrupt
 *   3. Step presence + order — missing initial/followup, state reset
 *   4. Age (stale evidence) boundaries and defaults
 *   5. Tree mismatch + delta tolerance (the core new behavior)
 *   6. Zero-value config edge cases (debug/strict modes)
 *   7. findLast-by-position pin (documents the assumption)
 *   8. Defense-in-depth branches via gitCmd injection
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

import {
  evidencePath,
  appendStep,
  validateForCommit,
} from '../review-evidence.mjs';

// ---------------------------------------------------------------------------
// Fixtures (duplicated from review-evidence.test.mjs — if these grow further,
// extract into a shared test-util module.)
// ---------------------------------------------------------------------------

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `guya-review-evidence-${prefix}-`));
}

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

function writeRawEvidence(dir, ...rawLines) {
  const path = evidencePath(dir);
  mkdirSync(join(dir, '.guya', 'evolution'), { recursive: true });
  writeFileSync(path, rawLines.join('\n') + (rawLines.length > 0 ? '\n' : ''));
}

function testConfig(overrides = {}) {
  return {
    gateMaxAgeMinutes: 30,
    smallChange: { maxLines: 10 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateForCommit: full failure-mode matrix against real git fixtures
// ---------------------------------------------------------------------------

describe('validateForCommit: happy paths', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-happy'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('valid when initial + followup + tree matches current staged state', () => {
    // Stage some content, run both reviews, commit right away — tree
    // SHA at validate time == tree SHA at followup time.
    writeFileSync(join(dir, 'new.txt'), 'content\n');
    execSync('git add new.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 1_000_000 });
    appendStep(dir, 'followup', { now: () => 1_000_100 });
    const r = validateForCommit(dir, testConfig(), { now: () => 1_000_200 });
    assert.deepEqual(r, { valid: true });
  });

  it('valid with note when delta ≤ smallChange.maxLines', () => {
    writeFileSync(join(dir, 'a.txt'), 'initial content\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 1_000_000 });
    appendStep(dir, 'followup', { now: () => 1_000_100 });

    // Small post-review change: add 2 lines to a new file
    writeFileSync(join(dir, 'b.txt'), 'line1\nline2\n');
    execSync('git add b.txt', { cwd: dir });

    const r = validateForCommit(dir, testConfig(), { now: () => 1_000_200 });
    assert.equal(r.valid, true);
    assert.match(r.note, /2 lines/);
    assert.match(r.note, /≤ 10/);
  });

  it('valid when tree matches even after many steps', () => {
    writeFileSync(join(dir, 'a.txt'), 'content\n');
    execSync('git add a.txt', { cwd: dir });
    // Repeat initial, then followup, then another followup
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'initial', { now: () => 200 });
    appendStep(dir, 'followup', { now: () => 300 });
    appendStep(dir, 'followup', { now: () => 400 });
    const r = validateForCommit(dir, testConfig(), { now: () => 500 });
    assert.equal(r.valid, true);
  });
});

describe('validateForCommit: evidence file failure modes', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-evidence'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('blocks when evidence file is missing', () => {
    const r = validateForCommit(dir, testConfig());
    assert.equal(r.valid, false);
    assert.match(r.reason, /No review evidence/);
  });

  it('blocks when evidence file is empty', () => {
    writeRawEvidence(dir);
    const r = validateForCommit(dir, testConfig());
    assert.equal(r.valid, false);
    assert.match(r.reason, /no valid entries/);
  });

  it('blocks when every line is corrupt (all entries rejected)', () => {
    writeRawEvidence(dir, '{broken', 'also broken', '[]');
    const r = validateForCommit(dir, testConfig());
    assert.equal(r.valid, false);
    assert.match(r.reason, /no valid entries/);
  });
});

describe('validateForCommit: step presence + order failures', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-steps'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('blocks when only initial step is present', () => {
    appendStep(dir, 'initial');
    const r = validateForCommit(dir, testConfig());
    assert.equal(r.valid, false);
    assert.match(r.reason, /Missing followup/);
  });

  it('blocks when only followup step is present', () => {
    appendStep(dir, 'followup');
    const r = validateForCommit(dir, testConfig());
    assert.equal(r.valid, false);
    assert.match(r.reason, /Missing initial/);
  });

  it('blocks when initial runs after the latest followup (state reset)', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });
    appendStep(dir, 'initial', { now: () => 300 }); // re-ran initial after followup
    const r = validateForCommit(dir, testConfig(), { now: () => 400 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /Initial review ran after followup/);
  });

  it('blocks when followup.timestamp equals initial.timestamp (tie → not-after)', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 100 });
    const r = validateForCommit(dir, testConfig(), { now: () => 200 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /Initial review ran after followup/);
  });
});

describe('validateForCommit: age (stale evidence) failures', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-age'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('blocks when age exceeds gateMaxAgeMinutes', () => {
    appendStep(dir, 'initial', { now: () => 0 });
    appendStep(dir, 'followup', { now: () => 1000 });
    const r = validateForCommit(dir, testConfig({ gateMaxAgeMinutes: 10 }), {
      now: () => 11 * 60 * 1000 + 1, // 11 minutes + 1ms
    });
    assert.equal(r.valid, false);
    assert.match(r.reason, /Review expired/);
  });

  it('passes when age is exactly at the maxAge boundary (inclusive)', () => {
    writeFileSync(join(dir, 'a.txt'), 'x');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 0 });
    appendStep(dir, 'followup', { now: () => 100 });
    const r = validateForCommit(dir, testConfig({ gateMaxAgeMinutes: 10 }), {
      now: () => 10 * 60 * 1000, // exactly 10 minutes
    });
    assert.equal(r.valid, true);
  });

  it('uses default 30 minutes when gateMaxAgeMinutes is missing', () => {
    appendStep(dir, 'initial', { now: () => 0 });
    appendStep(dir, 'followup', { now: () => 100 });
    const r = validateForCommit(dir, { smallChange: { maxLines: 10 } }, {
      now: () => 31 * 60 * 1000,
    });
    assert.equal(r.valid, false);
    assert.match(r.reason, /max 30min/);
  });
});

describe('validateForCommit: tree mismatch + delta tolerance', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-delta'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('blocks when delta exceeds smallChange.maxLines', () => {
    writeFileSync(join(dir, 'a.txt'), 'initial\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    // Add 50 lines after review
    writeFileSync(join(dir, 'big.txt'), 'line\n'.repeat(50));
    execSync('git add big.txt', { cwd: dir });

    const r = validateForCommit(dir, testConfig(), { now: () => 300 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /50 lines changed/);
    assert.match(r.reason, /max 10/);
  });

  it('blocks when the change exactly equals maxLines+1 (strict boundary)', () => {
    writeFileSync(join(dir, 'a.txt'), 'initial\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    writeFileSync(join(dir, 'b.txt'), 'line\n'.repeat(11));
    execSync('git add b.txt', { cwd: dir });

    const r = validateForCommit(dir, testConfig({ smallChange: { maxLines: 10 } }), {
      now: () => 300,
    });
    assert.equal(r.valid, false);
    assert.match(r.reason, /11 lines/);
  });

  it('passes when the change is exactly equal to maxLines (inclusive)', () => {
    writeFileSync(join(dir, 'a.txt'), 'initial\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    writeFileSync(join(dir, 'b.txt'), 'line\n'.repeat(10));
    execSync('git add b.txt', { cwd: dir });

    const r = validateForCommit(dir, testConfig({ smallChange: { maxLines: 10 } }), {
      now: () => 300,
    });
    assert.equal(r.valid, true);
  });

  it('counts both additions and removals in the delta', () => {
    // Stage a file with 10 lines, review, then replace with different content
    // of the same line count — delta should be 20 (10 added + 10 removed),
    // NOT 0.
    writeFileSync(join(dir, 'a.txt'), 'a\n'.repeat(10));
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    writeFileSync(join(dir, 'a.txt'), 'b\n'.repeat(10));
    execSync('git add a.txt', { cwd: dir });

    const r = validateForCommit(dir, testConfig(), { now: () => 300 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /20 lines/);
  });

  it('uses default maxLines=10 when config.smallChange is missing', () => {
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    writeFileSync(join(dir, 'big.txt'), 'line\n'.repeat(11));
    execSync('git add big.txt', { cwd: dir });

    const r = validateForCommit(dir, { gateMaxAgeMinutes: 30 }, { now: () => 300 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /max 10/);
  });
});

describe('validateForCommit: zero-value config edge cases', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-zero'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('accepts gateMaxAgeMinutes: 0 (debug mode — expire immediately)', () => {
    // `0` is a legitimate debug setting: "any review older than 0 minutes
    // is stale" = every commit must have a just-recorded review. Previously
    // this was silently clamped to the default via a `> 0` check.
    appendStep(dir, 'initial', { now: () => 1000 });
    appendStep(dir, 'followup', { now: () => 1100 });

    // 1ms after recording → already expired because maxAge is 0
    const r = validateForCommit(
      dir,
      { gateMaxAgeMinutes: 0, smallChange: { maxLines: 10 } },
      { now: () => 1001 },
    );
    assert.equal(r.valid, false);
    assert.match(r.reason, /Review expired/);
    assert.match(r.reason, /max 0min/);
  });

  it('accepts smallChange.maxLines: 0 (strict tree match, no delta tolerance)', () => {
    writeFileSync(join(dir, 'a.txt'), 'initial\n');
    execSync('git add a.txt', { cwd: dir });
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    // Add even a single line after review → blocks because maxLines is 0
    writeFileSync(join(dir, 'b.txt'), 'one line\n');
    execSync('git add b.txt', { cwd: dir });

    const r = validateForCommit(
      dir,
      { gateMaxAgeMinutes: 30, smallChange: { maxLines: 0 } },
      { now: () => 300 },
    );
    assert.equal(r.valid, false);
    assert.match(r.reason, /lines changed/);
    assert.match(r.reason, /max 0/);
  });

  it('still falls back to defaults for negative or NaN config values', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });

    // Negative gateMaxAgeMinutes should fall back to default 30
    const r1 = validateForCommit(
      dir,
      { gateMaxAgeMinutes: -5, smallChange: { maxLines: 10 } },
      { now: () => 31 * 60 * 1000 },
    );
    assert.equal(r1.valid, false);
    assert.match(r1.reason, /max 30min/);

    // NaN should also fall back
    const r2 = validateForCommit(
      dir,
      { gateMaxAgeMinutes: 'oops', smallChange: { maxLines: 10 } },
      { now: () => 31 * 60 * 1000 },
    );
    assert.equal(r2.valid, false);
    assert.match(r2.reason, /max 30min/);
  });
});

describe('validateForCommit: findLast-by-position semantics (pin test)', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('findlast'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('uses file position, not timestamp, when picking the "latest" step', () => {
    // PIN: readEvidence returns steps in file-append order. validateForCommit
    // uses Array.prototype.findLast which picks the last entry BY POSITION,
    // not by timestamp. Under normal operation (monotonic clocks, sequential
    // appends) position order == timestamp order, so this distinction is
    // invisible. Under clock skew or pathological ordering, they diverge.
    //
    // This test documents the current behavior by hand-crafting a jsonl
    // with non-monotonic timestamps. A future refactor that sorts by
    // timestamp would break this pin and force an explicit decision.
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    execSync('git add a.txt', { cwd: dir });
    const tree = execSync('git write-tree', { cwd: dir, encoding: 'utf-8' }).trim();

    // File order: initial@t=500, followup@t=1000, initial@t=200 (back in time)
    // By file position:  latest initial = t=200, latest followup = t=1000
    // Order check:       1000 > 200 → PASS (followup "after" the last initial)
    // By timestamp sort: latest initial = t=500, latest followup = t=1000
    //                    Order check:   1000 > 500 → also PASS, but different
    //                    initial entry is "latest"
    // Today's code uses file position, so a later refactor changing to
    // timestamp sort would silently alter which initial step is "latest."
    writeRawEvidence(
      dir,
      JSON.stringify({ v: 1, step: 'initial', timestamp: 500, treeSha: tree }),
      JSON.stringify({ v: 1, step: 'followup', timestamp: 1000, treeSha: tree }),
      JSON.stringify({ v: 1, step: 'initial', timestamp: 200, treeSha: tree }),
    );

    // With findLast-by-position: latest initial is the t=200 entry.
    // Latest followup (t=1000) is after latest initial (t=200), so the
    // order check passes. Tree matches, so validation succeeds.
    const r = validateForCommit(
      dir,
      testConfig(),
      { now: () => 60 * 60 * 1000 }, // 1hr later
    );

    // Age check uses latestInitial.timestamp (t=200). Age = 60*60*1000 - 200
    // = ~3600s > 30min max, so expect stale block.
    assert.equal(r.valid, false);
    assert.match(r.reason, /Review expired/);
  });

  it('picks the file-position-latest entry even when an earlier entry has a later timestamp', () => {
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    execSync('git add a.txt', { cwd: dir });
    const tree = execSync('git write-tree', { cwd: dir, encoding: 'utf-8' }).trim();

    // File order: followup@t=100, initial@t=200 (initial is LAST in file)
    // By position: latest initial = t=200, latest followup = t=100
    // Order check: 100 <= 200 → BLOCK "Initial review ran after followup"
    writeRawEvidence(
      dir,
      JSON.stringify({ v: 1, step: 'followup', timestamp: 100, treeSha: tree }),
      JSON.stringify({ v: 1, step: 'initial', timestamp: 200, treeSha: tree }),
    );

    const r = validateForCommit(dir, testConfig(), { now: () => 300 });
    assert.equal(r.valid, false);
    assert.match(r.reason, /Initial review ran after followup/);
  });
});

describe('validateForCommit: defense-in-depth branches', () => {
  let dir;
  beforeEach(() => { dir = makeTmpDir('valid-defense'); initGitRepo(dir); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('blocks with a safe reason when git write-tree fails via gitCmd injection', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });
    const brokenGit = (args) => { throw new Error('boom'); };
    const r = validateForCommit(dir, testConfig(), { now: () => 300, gitCmd: brokenGit });
    assert.equal(r.valid, false);
    assert.match(r.reason, /Could not compute current tree SHA/);
  });

  it('blocks when git write-tree returns a non-SHA string', () => {
    appendStep(dir, 'initial', { now: () => 100 });
    appendStep(dir, 'followup', { now: () => 200 });
    const r = validateForCommit(dir, testConfig(), {
      now: () => 300,
      gitCmd: (args) => (args === 'write-tree' ? 'not-a-sha' : ''),
    });
    assert.equal(r.valid, false);
    assert.match(r.reason, /invalid SHA/);
  });
});
