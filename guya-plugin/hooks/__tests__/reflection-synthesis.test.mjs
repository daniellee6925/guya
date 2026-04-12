/**
 * reflection-synthesis.test.mjs — Phase 1 self-edit pipeline contract tests
 *
 * PURPOSE:
 *   Lock in the contract for synthesizeFromReflections() before wiring it
 *   into the session-end hook. The function is the entry point of the
 *   reflection-driven self-edit pipeline; if it silently misroutes a
 *   stream, drops a proposal it shouldn't, or fails to apply the
 *   anti-oscillation guardrail, the whole loop is broken.
 *
 * COVERAGE:
 *   1. Manual reflections are weighted before auto reflections
 *   2. Reflections newer-first ordering
 *   3. Identity proposals with <2 sourceReflections are dropped (anti-oscillation)
 *   4. Identity proposals with >=2 sourceReflections survive
 *   5. Empty reflections dir → returns null cleanly
 *   6. Invalid JSON response → returns null cleanly
 *   7. Result shape normalization (missing arrays default to [])
 *   8. Dry-run writes inspection file with correct shape
 *   9. validateIdentityProposals as a pure unit
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import {
  synthesizeFromReflections,
  readReflections,
  validateIdentityProposals,
} from '../reflection-synthesis.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');

// --- Fixtures ---

function makeTmpDirs() {
  const root = mkdtempSync(join(tmpdir(), 'guya-reflsynth-'));
  const reflectionsDir = join(root, 'reflections');
  const globalDir = join(root, 'global');
  mkdirSync(reflectionsDir, { recursive: true });
  mkdirSync(join(globalDir, 'guidelines', 'strategic'), { recursive: true });
  mkdirSync(join(globalDir, 'traces'), { recursive: true });
  // Seed the global identity files so the synthesizer has something to read.
  writeFileSync(join(globalDir, 'soul.md'), '# soul fixture\n');
  writeFileSync(join(globalDir, 'user.md'), '# user fixture\n');
  writeFileSync(join(globalDir, 'growth-tracker.md'), '# growth fixture\n');
  return { root, reflectionsDir, globalDir };
}

function writeReflection(dir, filename, body) {
  writeFileSync(join(dir, filename), body);
}

function makeMockClient(responseObj) {
  return {
    messages: {
      create: async () => ({
        content: [{ text: JSON.stringify(responseObj) }],
      }),
    },
  };
}

// --- Tests ---

describe('readReflections', () => {
  let dirs;
  beforeEach(() => { dirs = makeTmpDirs(); });
  afterEach(() => { rmSync(dirs.root, { recursive: true, force: true }); });

  it('weights manual reflections before auto reflections', () => {
    writeReflection(dirs.reflectionsDir, '2026-04-08-abc12345.md', 'auto-old');
    writeReflection(dirs.reflectionsDir, '2026-04-09-def67890.md', 'auto-newer');
    writeReflection(dirs.reflectionsDir, '2026-04-07-manual.md', 'manual-old');
    writeReflection(dirs.reflectionsDir, '2026-04-10-manual.md', 'manual-newest');

    const result = readReflections(dirs.reflectionsDir, 5);

    // All 4 included; manual ones should appear first
    assert.equal(result.length, 4);
    assert.equal(result[0].isManual, true);
    assert.equal(result[1].isManual, true);
    // Within manual, newest first
    assert.equal(result[0].filename, '2026-04-10-manual.md');
    assert.equal(result[1].filename, '2026-04-07-manual.md');
  });

  it('caps at maxReflections', () => {
    for (let i = 1; i <= 10; i++) {
      writeReflection(dirs.reflectionsDir, `2026-04-${String(i).padStart(2, '0')}-manual.md`, `body-${i}`);
    }
    const result = readReflections(dirs.reflectionsDir, 3);
    assert.equal(result.length, 3);
    // Newest manual reflections (descending date)
    assert.equal(result[0].filename, '2026-04-10-manual.md');
  });

  it('filters out empty bodies', () => {
    writeReflection(dirs.reflectionsDir, '2026-04-10-manual.md', '');
    writeReflection(dirs.reflectionsDir, '2026-04-09-manual.md', 'real content');
    const result = readReflections(dirs.reflectionsDir, 5);
    assert.equal(result.length, 1);
    assert.equal(result[0].filename, '2026-04-09-manual.md');
  });
});

describe('validateIdentityProposals', () => {
  it('drops proposals with <2 sourceReflections (default threshold)', () => {
    const input = {
      identityProposals: [
        { file: 'soul.md', sourceReflections: ['a.md'] },                    // dropped
        { file: 'soul.md', sourceReflections: ['a.md', 'b.md'] },            // kept
        { file: 'user.md', sourceReflections: [] },                          // dropped
        { file: 'identity.md' },                                              // dropped (no sources)
        { file: 'soul.md', sourceReflections: ['a.md', 'b.md', 'c.md'] },    // kept
      ],
    };
    const out = validateIdentityProposals(input);
    assert.equal(out.identityProposals.length, 2);
    assert.deepEqual(out.identityProposals.map(p => p.sourceReflections.length), [2, 3]);
  });

  it('respects custom minSources', () => {
    const input = { identityProposals: [{ sourceReflections: ['a', 'b'] }, { sourceReflections: ['a', 'b', 'c'] }] };
    const out = validateIdentityProposals(input, 3);
    assert.equal(out.identityProposals.length, 1);
  });

  it('handles missing identityProposals gracefully', () => {
    const out = validateIdentityProposals({});
    assert.deepEqual(out.identityProposals, []);
  });
});

describe('synthesizeFromReflections', () => {
  let dirs;
  beforeEach(() => {
    dirs = makeTmpDirs();
    writeReflection(dirs.reflectionsDir, '2026-04-09-manual.md', 'reflection 1 content');
    writeReflection(dirs.reflectionsDir, '2026-04-10-manual.md', 'reflection 2 content');
  });
  afterEach(() => { rmSync(dirs.root, { recursive: true, force: true }); });

  it('happy path: returns normalized result + writes dry-run inspection file', async () => {
    const mockResponse = {
      guidelineEdits: [
        { action: 'create', domain: 'workflow', body: 'Do X', confidence: 0.9, sourceReflections: ['2026-04-10-manual.md'] },
      ],
      userProfileAdditions: [
        { section: 'How He Thinks', content: 'Loves systems', sourceReflections: ['2026-04-10-manual.md'] },
      ],
      identityProposals: [
        { file: 'soul.md', action: 'edit', description: 'Sharpen', diff: '+x', rationale: 'Two reflections agree', sourceReflections: ['2026-04-09-manual.md', '2026-04-10-manual.md'] },
      ],
      summary: 'Synthesized 1 guideline + 1 user fact + 1 identity proposal from 2 manual reflections.',
    };
    const client = makeMockClient(mockResponse);

    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });

    assert.ok(result, 'result must not be null');
    assert.equal(result.guidelineEdits.length, 1);
    assert.equal(result.userProfileAdditions.length, 1);
    assert.equal(result.identityProposals.length, 1);
    assert.match(result.summary, /Synthesized/);

    // Dry-run inspection file written
    const inspectionPath = join(dirs.globalDir, '.last-synthesis.json');
    assert.ok(existsSync(inspectionPath), 'inspection file must exist');
    const inspection = JSON.parse(readFileSync(inspectionPath, 'utf-8'));
    assert.match(inspection.ts, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(inspection.inputs.reflectionCount, 2);
    assert.equal(inspection.inputs.manualReflectionCount, 2);
    assert.equal(inspection.result.identityProposals.length, 1);
  });

  it('drops single-reflection identity proposals (anti-oscillation)', async () => {
    const mockResponse = {
      guidelineEdits: [],
      userProfileAdditions: [],
      identityProposals: [
        { file: 'soul.md', sourceReflections: ['only-one.md'] },              // dropped
        { file: 'user.md', sourceReflections: ['a.md', 'b.md'] },             // kept
      ],
      summary: 'mixed',
    };
    const client = makeMockClient(mockResponse);

    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.equal(result.identityProposals.length, 1);
    assert.equal(result.identityProposals[0].file, 'user.md');
  });

  it('empty reflections dir → returns null', async () => {
    const empty = makeTmpDirs();
    try {
      const result = await synthesizeFromReflections({
        client: makeMockClient({}),
        reflectionsDir: empty.reflectionsDir,
        globalDir: empty.globalDir,
        pluginRoot: PLUGIN_ROOT,
      });
      assert.equal(result, null);
    } finally {
      rmSync(empty.root, { recursive: true, force: true });
    }
  });

  it('invalid JSON response → returns null', async () => {
    const client = {
      messages: { create: async () => ({ content: [{ text: 'this is not JSON at all' }] }) },
    };
    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.equal(result, null);
  });

  it('strips ```json fences if model adds them despite the prompt', async () => {
    const fenced = '```json\n' + JSON.stringify({ guidelineEdits: [{ a: 1 }], userProfileAdditions: [], identityProposals: [], summary: 'ok' }) + '\n```';
    const client = {
      messages: { create: async () => ({ content: [{ text: fenced }] }) },
    };
    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.ok(result);
    assert.equal(result.guidelineEdits.length, 1);
  });

  it('normalizes missing streams to empty arrays', async () => {
    const partial = { summary: 'only summary' }; // no streams at all
    const client = makeMockClient(partial);
    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.deepEqual(result.guidelineEdits, []);
    assert.deepEqual(result.userProfileAdditions, []);
    assert.deepEqual(result.identityProposals, []);
    assert.equal(result.summary, 'only summary');
  });

  it('missing client → returns null without crashing', async () => {
    const result = await synthesizeFromReflections({
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.equal(result, null);
  });

  it('API error → returns null cleanly', async () => {
    const client = {
      messages: { create: async () => { throw new Error('rate limit'); } },
    };
    const result = await synthesizeFromReflections({
      client,
      reflectionsDir: dirs.reflectionsDir,
      globalDir: dirs.globalDir,
      pluginRoot: PLUGIN_ROOT,
    });
    assert.equal(result, null);
  });
});
