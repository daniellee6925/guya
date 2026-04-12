/**
 * reflection-nudge.test.mjs — SessionStart backlog nudge contract
 *
 * PURPOSE:
 *   Pin the contract of computeReflectionNudge, the Phase 2 soft signal that
 *   reminds Daniel to run /guya-evolve when reflections accumulate. Without
 *   tests, the nudge behavior was only inline smoke-tested once during Phase
 *   2 development — the exact rotting-under-silence pattern the nudge itself
 *   is designed to prevent.
 *
 * COVERAGE:
 *   1. Never evolved + reflections present → shows backlog + "no prior runs"
 *   2. Evolved today + newer reflection → shows backlog + "earlier today"
 *   3. Evolved N days ago + newer reflections → shows backlog + "N days ago"
 *   4. Evolved, no newer reflections → returns null (all caught up)
 *   5. No reflections at all → returns null
 *   6. Reflections dir missing → returns null (no hook spam)
 *   7. .last-evolved malformed → treats as never-evolved
 *   8. Pluralization: "1 reflection" / "1 day" singular, "5 reflections" / "5 days" plural
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { computeReflectionNudge } from '../guya-session-start.mjs';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'guya-nudge-'));
  const projectDir = join(root, 'project');
  const globalDir = join(root, 'global');
  mkdirSync(join(projectDir, '.guya', 'memory', 'reflections'), { recursive: true });
  mkdirSync(globalDir, { recursive: true });
  return { root, projectDir, globalDir };
}

function writeReflection(projectDir, filename, mtimeMs) {
  const path = join(projectDir, '.guya', 'memory', 'reflections', filename);
  writeFileSync(path, 'reflection body');
  if (mtimeMs != null) {
    const t = mtimeMs / 1000;
    utimesSync(path, t, t);
  }
}

function writeLastEvolved(globalDir, tsIso) {
  writeFileSync(join(globalDir, '.last-evolved'), JSON.stringify({ ts: tsIso }) + '\n');
}

const NOW = Date.parse('2026-04-12T10:00:00Z');

describe('computeReflectionNudge', () => {
  let fx;
  beforeEach(() => { fx = makeFixture(); });
  afterEach(() => { rmSync(fx.root, { recursive: true, force: true }); });

  it('never evolved + 3 reflections → shows backlog with "no prior runs"', () => {
    writeReflection(fx.projectDir, 'a.md', NOW - 1000);
    writeReflection(fx.projectDir, 'b.md', NOW - 1000);
    writeReflection(fx.projectDir, 'c.md', NOW - 1000);

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.match(out, /3 reflections/);
    assert.match(out, /no prior \/guya-evolve runs recorded/);
    assert.match(out, /Run \/guya-evolve/);
  });

  it('evolved earlier today + newer reflection → "last evolve earlier today"', () => {
    writeLastEvolved(fx.globalDir, new Date(NOW - 3 * 60 * 60 * 1000).toISOString()); // 3h ago
    writeReflection(fx.projectDir, 'fresh.md', NOW - 60 * 1000); // 1 min ago

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.match(out, /1 reflection /); // singular, note trailing space
    assert.match(out, /last evolve earlier today/);
  });

  it('evolved 5 days ago + 2 newer reflections → "5 days since last evolve"', () => {
    const fiveDaysAgo = new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString();
    writeLastEvolved(fx.globalDir, fiveDaysAgo);
    writeReflection(fx.projectDir, 'r1.md', NOW - 1000);
    writeReflection(fx.projectDir, 'r2.md', NOW - 1000);

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.match(out, /2 reflections/);
    assert.match(out, /5 days since last evolve/);
  });

  it('evolved 1 day ago → singular "1 day"', () => {
    const oneDayAgo = new Date(NOW - 1.5 * 24 * 60 * 60 * 1000).toISOString(); // 1.5 → floor = 1
    writeLastEvolved(fx.globalDir, oneDayAgo);
    writeReflection(fx.projectDir, 'fresh.md', NOW - 1000);

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.match(out, /1 day since last evolve/);
  });

  it('evolved, all reflections older → returns null (caught up, no nudge)', () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
    writeLastEvolved(fx.globalDir, oneHourAgo);
    // Reflection mtime BEFORE last-evolved
    writeReflection(fx.projectDir, 'old.md', NOW - 2 * 60 * 60 * 1000);

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.equal(out, null);
  });

  it('no reflections at all → returns null', () => {
    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.equal(out, null);
  });

  it('reflections directory missing → returns null, no crash', () => {
    rmSync(join(fx.projectDir, '.guya', 'memory', 'reflections'), { recursive: true });
    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.equal(out, null);
  });

  it('malformed .last-evolved → treats as never-evolved (nudge still shows)', () => {
    writeFileSync(join(fx.globalDir, '.last-evolved'), 'not json at all');
    writeReflection(fx.projectDir, 'r.md', NOW - 1000);

    const out = computeReflectionNudge(fx.projectDir, { globalDir: fx.globalDir, now: () => NOW });
    assert.match(out, /no prior \/guya-evolve runs recorded/);
  });
});
