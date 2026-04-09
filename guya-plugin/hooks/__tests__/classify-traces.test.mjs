/**
 * Unit tests for classifyTraces — the chunking and partial-failure behavior.
 *
 * Regression guard for the STATUS.md HIGH bug: the old implementation stuffed
 * ALL pre-filtered traces into one Haiku call, which aborted the whole pass
 * once the backlog exceeded ~200K input tokens or ~30 classifications output.
 * This test locks in: chunking happens, chunks are sized correctly, and a
 * single failing chunk does NOT kill the rest of the classification pass.
 *
 * The Anthropic client is mocked — no network calls, no API key required.
 *
 * Run: node --test guya-plugin/hooks/__tests__/classify-traces.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyTraces, CLASSIFY_CHUNK_SIZE, computePluginRoot } from '../guya-session-end.mjs';

// --- Mock client ---

// behavior: (chunk, callIndex) -> array | Error
// Return an array of classifications to succeed, or throw/return Error to fail.
function makeMockClient(behavior) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        const chunk = JSON.parse(params.messages[0].content);
        calls.push({ chunk, params });
        const result = behavior(chunk, calls.length - 1);
        if (result instanceof Error) throw result;
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
  };
}

// Build N fake trace entries in the { trace, file } shape that classifyTraces expects.
function makeUnclassified(n) {
  return Array.from({ length: n }, (_, i) => ({
    trace: {
      id: `trace-${i}`,
      type: 'correction',
      content: `trace content ${i}`,
      timestamp: i,
    },
    file: 'test.jsonl',
  }));
}

// Classification output shape matching the guya-observer contract.
function echoClassifications(chunk) {
  return chunk.map((t) => ({
    id: t.id,
    persistence: 'tactical',
    confidence: 0.7,
    domain: 'workflow',
  }));
}

// --- Tests ---

test('classifyTraces: empty input returns empty array without calling the API', async () => {
  const client = makeMockClient(() => {
    throw new Error('should not be called');
  });

  const results = await classifyTraces(client, []);

  assert.deepEqual(results, []);
  assert.equal(client.calls.length, 0);
});

test('classifyTraces: fewer than chunk size → 1 API call, all traces classified', async () => {
  const client = makeMockClient((chunk) => echoClassifications(chunk));
  const unclassified = makeUnclassified(10);

  const results = await classifyTraces(client, unclassified);

  assert.equal(client.calls.length, 1, 'should make exactly one API call');
  assert.equal(client.calls[0].chunk.length, 10);
  assert.equal(results.length, 10);
  // Ids must be echoed so the merge step can join them back to traces.
  assert.deepEqual(results.map((r) => r.id), unclassified.map((u) => u.trace.id));
});

test('classifyTraces: exactly chunk size → 1 API call (off-by-one guard)', async () => {
  const client = makeMockClient((chunk) => echoClassifications(chunk));
  const unclassified = makeUnclassified(CLASSIFY_CHUNK_SIZE);

  const results = await classifyTraces(client, unclassified);

  assert.equal(client.calls.length, 1, 'exactly CHUNK_SIZE traces should fit in one chunk, not two');
  assert.equal(results.length, CLASSIFY_CHUNK_SIZE);
});

test('classifyTraces: larger than chunk size splits into multiple calls with correct sizing', async () => {
  // Pick a size that exercises a non-trivial remainder (e.g. 60 with chunk 25 → [25,25,10]).
  const total = CLASSIFY_CHUNK_SIZE * 2 + 10;
  const client = makeMockClient((chunk) => echoClassifications(chunk));
  const unclassified = makeUnclassified(total);

  const results = await classifyTraces(client, unclassified);

  assert.equal(client.calls.length, 3, 'should make ceil(total/chunkSize) = 3 calls');
  assert.equal(client.calls[0].chunk.length, CLASSIFY_CHUNK_SIZE);
  assert.equal(client.calls[1].chunk.length, CLASSIFY_CHUNK_SIZE);
  assert.equal(client.calls[2].chunk.length, 10);
  // Results preserved in chunk order and concatenated.
  assert.equal(results.length, total);
  assert.deepEqual(results.map((r) => r.id), unclassified.map((u) => u.trace.id));
});

test('classifyTraces: one chunk fails → partial results returned, other chunks survive', async () => {
  // This is the core behavioral upgrade vs the old implementation:
  // before chunking, a single API failure aborted the whole pass. Now the
  // loop continues and the caller gets whatever classified successfully.
  const total = CLASSIFY_CHUNK_SIZE * 3;
  const client = makeMockClient((chunk, callIndex) => {
    if (callIndex === 1) return new Error('simulated mid-pass API blip');
    return echoClassifications(chunk);
  });
  const unclassified = makeUnclassified(total);

  const results = await classifyTraces(client, unclassified);

  assert.equal(client.calls.length, 3, 'loop must continue past the failing chunk');
  assert.notEqual(results, null, 'partial success should not return null');
  assert.equal(results.length, CLASSIFY_CHUNK_SIZE * 2, 'lost one chunk worth of classifications');
  // Surviving results must come from chunks 0 and 2, not 1.
  const survivingIds = new Set(results.map((r) => r.id));
  for (let i = 0; i < CLASSIFY_CHUNK_SIZE; i++) {
    assert.ok(survivingIds.has(`trace-${i}`), `chunk 0 result ${i} should survive`);
  }
  for (let i = CLASSIFY_CHUNK_SIZE * 2; i < total; i++) {
    assert.ok(survivingIds.has(`trace-${i}`), `chunk 2 result ${i} should survive`);
  }
  // The failed chunk's ids must NOT appear in results.
  for (let i = CLASSIFY_CHUNK_SIZE; i < CLASSIFY_CHUNK_SIZE * 2; i++) {
    assert.ok(!survivingIds.has(`trace-${i}`), `chunk 1 result ${i} should be missing`);
  }
});

test('classifyTraces: all chunks fail → returns null (caller will skip persistence)', async () => {
  const client = makeMockClient(() => new Error('total API outage'));
  const unclassified = makeUnclassified(CLASSIFY_CHUNK_SIZE * 2);

  const results = await classifyTraces(client, unclassified);

  assert.equal(results, null, 'complete failure must be distinguishable from partial success');
  assert.equal(client.calls.length, 2, 'all chunks should have been attempted');
});

test('classifyTraces: one chunk returns non-array → treated as failure for that chunk only', async () => {
  // The classifyChunk helper throws when the response is not an array. That
  // must be caught per-chunk and not poison other chunks.
  const client = {
    calls: [],
    messages: {
      create: async (params) => {
        const chunk = JSON.parse(params.messages[0].content);
        client.calls.push({ chunk });
        // First chunk: bad shape. Second chunk: good.
        if (client.calls.length === 1) {
          return { content: [{ type: 'text', text: '{"not": "an array"}' }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(echoClassifications(chunk)) }] };
      },
    },
  };
  const unclassified = makeUnclassified(CLASSIFY_CHUNK_SIZE * 2);

  const results = await classifyTraces(client, unclassified);

  assert.equal(client.calls.length, 2);
  assert.equal(results.length, CLASSIFY_CHUNK_SIZE, 'only the good chunk should contribute');
});

// --- Cross-chunk ID correctness (code-review follow-up) ---

test('classifyTraces: cross-chunk id bleed is filtered out, no contamination', async () => {
  // If chunk 1 hallucinates an id belonging to chunk 0, the old behavior
  // would push it into results where mergeClassifications' `new Map(...)`
  // would treat the later entry as authoritative — silently overwriting
  // chunk 0's correct classification. classifyChunk must now drop
  // out-of-chunk ids per-chunk before they leave the function.
  const client = makeMockClient((chunk, callIndex) => {
    if (callIndex === 1) {
      // Chunk 1 returns its own traces PLUS a bleed entry for trace-0 (chunk 0's territory)
      // with a different domain/persistence than chunk 0 would produce.
      return [
        ...echoClassifications(chunk),
        { id: 'trace-0', persistence: 'strategic', confidence: 0.99, domain: 'general' },
      ];
    }
    return echoClassifications(chunk);
  });
  const unclassified = makeUnclassified(CLASSIFY_CHUNK_SIZE * 2);

  const results = await classifyTraces(client, unclassified);

  // Exactly CHUNK_SIZE * 2 — no duplicate entries, no bleed.
  assert.equal(results.length, CLASSIFY_CHUNK_SIZE * 2);
  // trace-0 must appear exactly once, with chunk 0's classification (tactical/workflow).
  const traceZeroEntries = results.filter((r) => r.id === 'trace-0');
  assert.equal(traceZeroEntries.length, 1, 'trace-0 must not be duplicated by the bleed');
  assert.equal(traceZeroEntries[0].persistence, 'tactical', 'chunk 0 value must survive');
  assert.equal(traceZeroEntries[0].domain, 'workflow', 'chunk 0 value must survive');
});

test('classifyTraces: duplicate ids within a chunk are deduplicated', async () => {
  // An observer that echoes the same id twice for a single chunk should
  // not pollute the results array. Dedupe happens at classifyChunk so the
  // Map-build in mergeClassifications never sees the dupes.
  const client = makeMockClient((chunk) => {
    const base = echoClassifications(chunk);
    // Duplicate the first entry inside the same chunk's response.
    return [...base, { ...base[0] }];
  });
  const unclassified = makeUnclassified(5);

  const results = await classifyTraces(client, unclassified);

  assert.equal(results.length, 5, 'in-chunk duplicate must be dropped');
  const ids = new Set(results.map((r) => r.id));
  assert.equal(ids.size, 5, 'every surviving id must be unique');
});

// --- computePluginRoot (PLUGIN_ROOT fallback) ---

test('computePluginRoot: walks up from hooks/ to plugin root when no env var is set', () => {
  const original = process.env.CLAUDE_PLUGIN_ROOT;
  delete process.env.CLAUDE_PLUGIN_ROOT;
  try {
    // Simulate a module located at <plugin-root>/hooks/<file>.mjs.
    const fakeUrl = 'file:///some/path/guya-plugin/hooks/guya-session-end.mjs';
    assert.equal(computePluginRoot(fakeUrl), '/some/path/guya-plugin');
  } finally {
    if (original !== undefined) process.env.CLAUDE_PLUGIN_ROOT = original;
  }
});

test('computePluginRoot: CLAUDE_PLUGIN_ROOT env var overrides the fallback', () => {
  const original = process.env.CLAUDE_PLUGIN_ROOT;
  process.env.CLAUDE_PLUGIN_ROOT = '/override/root';
  try {
    // Even with a valid URL that would compute differently, env var wins.
    const fakeUrl = 'file:///totally/different/path/file.mjs';
    assert.equal(computePluginRoot(fakeUrl), '/override/root');
  } finally {
    if (original === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = original;
  }
});
