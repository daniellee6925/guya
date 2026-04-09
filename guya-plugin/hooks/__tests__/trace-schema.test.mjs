/**
 * trace-schema.test.mjs — Producer/consumer contract for user-feedback trace types
 *
 * PURPOSE:
 *   Catch producer-consumer schema drift between correction-detect (producer)
 *   and session-end hasLearningSignal (consumer). Historical bug: the consumer's
 *   hardcoded allowlist ['correction', 'preference'] silently dropped
 *   confirmation/decision/pushback that correction-detect was writing.
 *
 * CONTRACT:
 *   1. Every type emitted by correction-detect PATTERNS must be registered
 *      in FEEDBACK_TRACE_TYPES (producer -> schema)
 *   2. Every type in FEEDBACK_TRACE_TYPES must pass hasLearningSignal
 *      (schema -> consumer)
 *
 *   If either direction breaks, the classification pipeline silently drops
 *   traces. Same class of bug as the traceId/id contract from earlier today.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEEDBACK_TRACE_TYPES,
  FEEDBACK_TRACE_TYPE_SET,
  hasLearningSignal,
} from '../hook-utils.mjs';
import { PATTERNS, detectCorrection } from '../guya-correction-detect.mjs';

describe('trace schema: feedback type contract', () => {
  it('FEEDBACK_TRACE_TYPES is non-empty and frozen', () => {
    assert.ok(FEEDBACK_TRACE_TYPES.length > 0, 'feedback types must be non-empty');
    assert.ok(Object.isFrozen(FEEDBACK_TRACE_TYPES), 'feedback types must be frozen');
  });

  it('FEEDBACK_TRACE_TYPE_SET matches FEEDBACK_TRACE_TYPES', () => {
    assert.equal(FEEDBACK_TRACE_TYPE_SET.size, FEEDBACK_TRACE_TYPES.length);
    for (const t of FEEDBACK_TRACE_TYPES) {
      assert.ok(FEEDBACK_TRACE_TYPE_SET.has(t), `set missing ${t}`);
    }
  });

  it('producer -> schema: every PATTERNS.type is a registered feedback type', () => {
    const unregistered = [];
    for (const { type } of PATTERNS) {
      if (!FEEDBACK_TRACE_TYPE_SET.has(type)) {
        unregistered.push(type);
      }
    }
    assert.deepEqual(
      unregistered,
      [],
      `correction-detect PATTERNS emits types not in FEEDBACK_TRACE_TYPES: ${[...new Set(unregistered)].join(', ')}. ` +
      `Add them to hook-utils.mjs FEEDBACK_TRACE_TYPES or remove the patterns.`,
    );
  });

  it('schema -> consumer: hasLearningSignal accepts every feedback type', () => {
    const rejected = [];
    for (const type of FEEDBACK_TRACE_TYPES) {
      if (hasLearningSignal({ type }) !== true) {
        rejected.push(type);
      }
    }
    assert.deepEqual(
      rejected,
      [],
      `hasLearningSignal rejected feedback types: ${rejected.join(', ')}. ` +
      `This means the classification pipeline silently drops these traces.`,
    );
  });

  it('every FEEDBACK_TRACE_TYPE is produced by at least one PATTERNS regex (no dead enum entries)', () => {
    // Reverse direction of test #3: catches dead types that were added to
    // the enum but never got a regex. If this fires, either delete the
    // unused enum entry or add a regex that emits it.
    const typesEmitted = new Set(PATTERNS.map((p) => p.type));
    const unemitted = FEEDBACK_TRACE_TYPES.filter((t) => !typesEmitted.has(t));
    assert.deepEqual(
      unemitted,
      [],
      `FEEDBACK_TRACE_TYPES registers types with no matching PATTERNS regex: ${unemitted.join(', ')}`,
    );
  });

  it('detectCorrection emit sweep: every non-null return is a registered feedback type', () => {
    // Codex found that detectCorrection has an out-of-band emit path
    // (INSTEAD_OF_PATTERN on line 59 of guya-correction-detect.mjs) that
    // returns a type outside the PATTERNS loop. A future escape hatch
    // could emit a fresh unregistered type and test #3 would still pass.
    //
    // This sweep calls detectCorrection with inputs that exercise EVERY
    // known emit path (one per PATTERNS entry + the INSTEAD_OF escape
    // hatch) and asserts every return value is in the schema.
    const probes = [
      // Exercise INSTEAD_OF escape hatch specifically (the bug surface)
      'please do this instead of the old approach you were using',
      // Exercise correction patterns
      "no, use the other approach here",
      "that's not what I asked for",
      "don't add extra comments here",
      "stop doing that",
      "that's not right for this case",
      "wrong, try again please",
      // Exercise confirmation patterns
      "yes exactly what I want here",
      "nice approach there friend",
      // Exercise preference patterns
      "always use async/await please",
      "i prefer it when you are terse",
      // Exercise decision patterns
      "let's go with option B for sure",
      // Exercise pushback patterns
      "why are we doing it this way",
      "are you sure this is right",
      "do we really need this layer",
    ];
    const emitted = new Set();
    for (const prompt of probes) {
      const result = detectCorrection(prompt);
      if (result != null) emitted.add(result);
    }
    // Every distinct emit must be in the schema.
    const unregistered = [...emitted].filter((t) => !FEEDBACK_TRACE_TYPE_SET.has(t));
    assert.deepEqual(
      unregistered,
      [],
      `detectCorrection emitted types not in FEEDBACK_TRACE_TYPES: ${unregistered.join(', ')}. ` +
      `Check for new escape-hatch patterns like INSTEAD_OF_PATTERN that bypass the PATTERNS loop.`,
    );
    // Sanity: the sweep must actually exercise emit paths, otherwise the
    // assertion above is vacuously true (if detectCorrection changed
    // shape and nothing matches, this test would become a no-op).
    assert.ok(emitted.size > 0, 'detectCorrection emit sweep matched zero probes — probes stale?');
    // And the sweep must cover every registered type via detectCorrection,
    // not just via static PATTERNS inspection.
    const missing = FEEDBACK_TRACE_TYPES.filter((t) => !emitted.has(t));
    assert.deepEqual(
      missing,
      [],
      `detectCorrection sweep did not emit types: ${missing.join(', ')}. ` +
      `Either add a matching probe or investigate why the pattern no longer fires.`,
    );
  });
});

describe('trace schema: hasLearningSignal behavior preserved', () => {
  it('reflection type still passes (kept for future producers)', () => {
    assert.equal(hasLearningSignal({ type: 'reflection' }), true);
  });

  it('context-based guya path match still passes', () => {
    assert.equal(
      hasLearningSignal({ type: 'other', context: '/Users/x/.claude/guya/foo' }),
      true,
    );
    assert.equal(
      hasLearningSignal({ type: 'other', context: '/repo/.guya/memory/core' }),
      true,
    );
  });

  it('noise tool calls are still skipped', () => {
    // content format: "Tool: Read" / "Tool: Grep" — stripped, lowered, matched
    assert.equal(hasLearningSignal({ type: 'x', content: 'Tool: Read' }), false);
    assert.equal(hasLearningSignal({ type: 'x', content: 'Tool: Glob' }), false);
  });

  it('write-family tools are still classified', () => {
    assert.equal(hasLearningSignal({ type: 'x', content: 'Tool: Write' }), true);
    assert.equal(hasLearningSignal({ type: 'x', content: 'Tool: Edit' }), true);
  });

  it('unknown low-signal traces still default to false', () => {
    assert.equal(hasLearningSignal({ type: 'mystery', content: 'Tool: Unknown' }), false);
  });

  it('null/undefined/non-object inputs return false instead of throwing', () => {
    // Follow-up review: hasLearningSignal is now shared code and may be
    // called from new sites. Guard the boundary rather than assume the
    // caller always passes a well-formed trace.
    assert.equal(hasLearningSignal(null), false);
    assert.equal(hasLearningSignal(undefined), false);
    assert.equal(hasLearningSignal(42), false);
    assert.equal(hasLearningSignal('not-an-object'), false);
  });
});
