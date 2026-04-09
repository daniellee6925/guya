/**
 * Integration test for persistClassifications — the evolution pipeline's merge step.
 *
 * Regression guard for the traceId/id contract bug: producers write traces with
 * `id: <uuid>`, the observer must echo that `id`, and persistClassifications must
 * join them on that key. Any drift silently breaks the pipeline — this test
 * locks the contract.
 *
 * Run: node --test guya-plugin/hooks/__tests__/persist-classifications.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { persistClassifications, mergeClassifications } from '../guya-session-end.mjs';

// --- Test helpers ---

function makeTmpTracesDir() {
  return mkdtempSync(join(tmpdir(), 'guya-test-traces-'));
}

function writeTraces(dir, fileName, traces) {
  const path = join(dir, fileName);
  writeFileSync(path, traces.map(t => JSON.stringify(t)).join('\n') + '\n');
  return path;
}

function readTraces(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

// --- Tests ---

test('persistClassifications: classifications with matching id merge onto traces and classified ones are pruned', async () => {
  const dir = makeTmpTracesDir();
  try {
    const trace1 = { id: 'trace-aaa', type: 'correction', content: 'stop X', timestamp: 1 };
    const trace2 = { id: 'trace-bbb', type: 'file_edit', content: 'Edit: foo.js', timestamp: 2 };
    const trace3 = { id: 'trace-ccc', type: 'preference', content: 'prefer Y', timestamp: 3 };
    const path = writeTraces(dir, 'test.jsonl', [trace1, trace2, trace3]);

    const allTracesWithMeta = [
      { trace: trace1, file: 'test.jsonl' },
      { trace: trace2, file: 'test.jsonl' },
      { trace: trace3, file: 'test.jsonl' },
    ];
    // Only trace1 and trace3 passed the hasLearningSignal pre-filter.
    const unclassified = [
      { trace: trace1, file: 'test.jsonl' },
      { trace: trace3, file: 'test.jsonl' },
    ];
    // Observer returns classifications keyed on `id` (the contract).
    const classificationResults = [
      { id: 'trace-aaa', persistence: 'strategic', confidence: 0.9, domain: 'communication' },
      { id: 'trace-ccc', persistence: 'tactical',  confidence: 0.7, domain: 'technical_preferences' },
    ];

    const { mergedCount } = await persistClassifications(
      classificationResults, allTracesWithMeta, unclassified, dir,
    );

    assert.equal(mergedCount, 2, 'both classified traces should have merged');

    // trace2 (unclassified file_edit) should survive; trace1 + trace3 pruned.
    const remaining = readTraces(path);
    assert.equal(remaining.length, 1, 'only the unclassified trace should remain');
    assert.equal(remaining[0].id, 'trace-bbb');
    // Survivor must not have been mutated with classification metadata.
    assert.equal(remaining[0].classified, undefined);
    assert.equal(remaining[0].persistence, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('persistClassifications: deletes the file when every trace was classified', async () => {
  const dir = makeTmpTracesDir();
  try {
    const trace1 = { id: 'only-trace', type: 'correction', content: 'x', timestamp: 1 };
    const path = writeTraces(dir, 'only.jsonl', [trace1]);

    const allTracesWithMeta = [{ trace: trace1, file: 'only.jsonl' }];
    const unclassified = [{ trace: trace1, file: 'only.jsonl' }];
    const classificationResults = [
      { id: 'only-trace', persistence: 'tactical', confidence: 0.6, domain: 'workflow' },
    ];

    const { mergedCount } = await persistClassifications(
      classificationResults, allTracesWithMeta, unclassified, dir,
    );

    assert.equal(mergedCount, 1);
    assert.equal(existsSync(path), false, 'empty file should be deleted');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('persistClassifications: THROWS when observer returns results that match no trace (contract violation)', async () => {
  // This is the regression guard for the original bug. Before the fix, this
  // scenario silently no-op'd. Now it throws loudly so the failure mode is
  // caught instead of masked.
  const dir = makeTmpTracesDir();
  try {
    const trace1 = { id: 'trace-real', type: 'correction', content: 'x', timestamp: 1 };
    writeTraces(dir, 'real.jsonl', [trace1]);

    const allTracesWithMeta = [{ trace: trace1, file: 'real.jsonl' }];
    const unclassified = [{ trace: trace1, file: 'real.jsonl' }];

    // Simulate the old bug: observer returns results keyed on `traceId`
    // instead of `id`. Must now throw loudly instead of silently dropping.
    const badResults = [
      { traceId: 'trace-real', persistence: 'strategic', confidence: 0.9, domain: 'general' },
    ];

    await assert.rejects(
      () => persistClassifications(badResults, allTracesWithMeta, unclassified, dir),
      /contract violated/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('persistClassifications: empty classificationResults is a no-op (not a contract violation)', async () => {
  const dir = makeTmpTracesDir();
  try {
    const trace1 = { id: 'x', type: 'file_edit', content: 'x', timestamp: 1 };
    const path = writeTraces(dir, 'x.jsonl', [trace1]);

    const { mergedCount } = await persistClassifications(
      [], [{ trace: trace1, file: 'x.jsonl' }], [], dir,
    );

    assert.equal(mergedCount, 0);
    // File untouched because no classifications, no pruning.
    assert.deepEqual(readTraces(path), [trace1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mergeClassifications: merged traces carry persistence, confidence, domain fields verbatim from the classification', () => {
  // Field-level verification — persistClassifications prunes merged traces
  // before we can inspect them, so we test the pure merge step directly to
  // lock the contract on which classification fields land on which traces.
  const trace1 = { id: 'a', type: 'correction', content: 'x', timestamp: 1, sessionId: 's1' };
  const trace2 = { id: 'b', type: 'file_edit', content: 'y', timestamp: 2, sessionId: 's1' };
  const allTracesWithMeta = [
    { trace: trace1, file: 'test.jsonl' },
    { trace: trace2, file: 'test.jsonl' },
  ];
  const unclassified = [{ trace: trace1, file: 'test.jsonl' }];
  const classificationResults = [
    { id: 'a', persistence: 'strategic', confidence: 0.92, domain: 'growth_areas' },
  ];

  const { fileGroups, mergedCount } = mergeClassifications(
    classificationResults, allTracesWithMeta, unclassified,
  );

  assert.equal(mergedCount, 1);
  const group = fileGroups['test.jsonl'];
  assert.equal(group.length, 2, 'both traces should be in the file group');

  const merged = group.find(t => t.id === 'a');
  assert.equal(merged.classified, true);
  assert.equal(merged.persistence, 'strategic');
  assert.equal(merged.confidence, 0.92);
  assert.equal(merged.domain, 'growth_areas');
  // Original fields must be preserved, not replaced.
  assert.equal(merged.type, 'correction');
  assert.equal(merged.sessionId, 's1');
  assert.equal(merged.content, 'x');

  // Untouched trace must not be mutated with any classification metadata.
  const untouched = group.find(t => t.id === 'b');
  assert.equal(untouched.classified, undefined);
  assert.equal(untouched.persistence, undefined);
  assert.equal(untouched.confidence, undefined);
  assert.equal(untouched.domain, undefined);
});

test('mergeClassifications: merge is robust to object-identity changes (same id, different object)', () => {
  // Regression guard for the old `.some(u => u.trace === trace)` check that
  // relied on reference equality. After the fix, merge joins by id, so a
  // deserialized copy of the same logical trace still works correctly.
  const trace1 = { id: 'shared-id', type: 'correction', content: 'x', timestamp: 1 };
  // Deliberately different object with the same id (simulates a round-trip).
  const trace1Copy = JSON.parse(JSON.stringify(trace1));

  const allTracesWithMeta = [{ trace: trace1, file: 'f.jsonl' }];
  const unclassified = [{ trace: trace1Copy, file: 'f.jsonl' }];
  const classificationResults = [
    { id: 'shared-id', persistence: 'tactical', confidence: 0.7, domain: 'workflow' },
  ];

  const { mergedCount } = mergeClassifications(
    classificationResults, allTracesWithMeta, unclassified,
  );

  assert.equal(mergedCount, 1, 'merge should succeed across identity boundary via id lookup');
});

test('persistClassifications: mixed — some observer results match, some dont, still merges matches', async () => {
  const dir = makeTmpTracesDir();
  try {
    const trace1 = { id: 'matches', type: 'correction', content: 'x', timestamp: 1 };
    const trace2 = { id: 'also-matches', type: 'preference', content: 'y', timestamp: 2 };
    const path = writeTraces(dir, 'mixed.jsonl', [trace1, trace2]);

    const allTracesWithMeta = [
      { trace: trace1, file: 'mixed.jsonl' },
      { trace: trace2, file: 'mixed.jsonl' },
    ];
    const unclassified = [...allTracesWithMeta];

    // Observer returned an extra phantom classification that doesn't match
    // any trace — this can happen if the observer hallucinates. Real matches
    // should still land; phantom is silently dropped (it's only a contract
    // violation if ZERO merges happen).
    const classificationResults = [
      { id: 'matches', persistence: 'strategic', confidence: 0.9, domain: 'general' },
      { id: 'also-matches', persistence: 'tactical', confidence: 0.6, domain: 'workflow' },
      { id: 'phantom-not-in-input', persistence: 'strategic', confidence: 0.8, domain: 'general' },
    ];

    const { mergedCount } = await persistClassifications(
      classificationResults, allTracesWithMeta, unclassified, dir,
    );

    assert.equal(mergedCount, 2);
    assert.equal(existsSync(path), false, 'all real traces merged, file deleted');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
