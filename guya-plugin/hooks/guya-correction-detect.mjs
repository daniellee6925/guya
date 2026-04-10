#!/usr/bin/env node

/**
 * Guya UserPromptSubmit Hook — Correction Detection
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { prompt, sessionId, directory }
 *   Output (correction detected): { continue: true, hookSpecificOutput: { hookEventName, additionalContext } }
 *   Output (no match): { continue: true, suppressOutput: true }
 *
 *   Detects correction/preference patterns via regex
 *   Writes a trace entry and a tactical guideline file when detected
 *   Completes in under 100ms — regex only, no LLM calls
 */

import { existsSync, appendFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { isHarnessActive, FEEDBACK_TRACE_TYPE_SET, resolveProjectRoot } from './hook-utils.mjs';

const GLOBAL_TRACES_DIR = join(homedir(), '.claude', 'guya', 'traces');

// --- Correction patterns ---

// Frozen to match FEEDBACK_TRACE_TYPES' posture on the schema side — both
// halves of the contract should be immutable at module scope. Shallow freeze
// is sufficient: the runtime guard and detectCorrection only read .type/.regex.
const PATTERNS = Object.freeze([
  // Corrections — Daniel says something is wrong
  { regex: /\bno[,.]?\s+(use|do|make|write|prefer|try|that|don't)\b/i, type: 'correction' },
  { regex: /\b(wrong|incorrect|that's not right|fix that|not what i (asked|meant|want))\b/i, type: 'correction' },
  { regex: /\bdon'?t\s+(do|add|use|make|write|include|put|change)\b/i, type: 'correction' },
  { regex: /\bstop\s+(doing|adding|using|making)\b/i, type: 'correction' },
  { regex: /\bthat's not\b/i, type: 'correction' },

  // Confirmations — Daniel says something is right (equally valuable)
  { regex: /\b(yes exactly|perfect|that's (exactly )?what i want|keep doing that|love it)\b/i, type: 'confirmation' },
  { regex: /\b(great|nice|good)\s+(approach|call|idea|thinking|choice)\b/i, type: 'confirmation' },

  // Preferences — Daniel expresses how he wants things done
  { regex: /\b(always|never)\s+(use|do|write|prefer|make|add|include)\b/i, type: 'preference' },
  { regex: /\bi (prefer|like|want)\s+(it )?(when|if|to)\b/i, type: 'preference' },
  { regex: /\blet'?s\s+(go with|use|do|try|stick with)\b/i, type: 'decision' },

  // Pushback — Daniel questions a choice
  { regex: /\bwhy (are we|did you|would you|do we|is this)\b/i, type: 'pushback' },
  { regex: /\b(are you sure|I don'?t think|that (doesn't|doesn) seem right)\b/i, type: 'pushback' },
  { regex: /\bdo (we|you) (really )?need\b/i, type: 'pushback' },
]);

const INSTEAD_OF_PATTERN = /\binstead of\b/i;
// Hoisted so the runtime guard below can sweep every emit path, not just PATTERNS.
const INSTEAD_OF_TYPE = 'correction';

// Short prompts that are just commands (< 15 chars) aren't feedback
const MIN_SIGNAL_LENGTH = 15;

// Runtime guard: every trace type this module can emit must be registered in
// FEEDBACK_TRACE_TYPE_SET, or session-end's hasLearningSignal will silently
// drop the trace. Throws at module load (not inside main's try/catch) so a
// broken hook fails fast instead of dropping traces for weeks unnoticed.
// This is the primary defense against producer/consumer schema drift — the
// contract test in trace-schema.test.mjs is a secondary safety net.
for (const { type } of PATTERNS) {
  if (!FEEDBACK_TRACE_TYPE_SET.has(type)) {
    throw new Error(
      `[guya-correction-detect] PATTERNS contains unregistered type '${type}'. ` +
      `Add it to hook-utils.mjs FEEDBACK_TRACE_TYPES or remove the pattern.`,
    );
  }
}
if (!FEEDBACK_TRACE_TYPE_SET.has(INSTEAD_OF_TYPE)) {
  throw new Error(
    `[guya-correction-detect] INSTEAD_OF_TYPE '${INSTEAD_OF_TYPE}' is not in ` +
    `FEEDBACK_TRACE_TYPES — register it or change the emit type.`,
  );
}

function detectCorrection(prompt) {
  if (prompt.length < MIN_SIGNAL_LENGTH) return null;
  for (const { regex, type } of PATTERNS) {
    if (regex.test(prompt)) return type;
  }
  if (INSTEAD_OF_PATTERN.test(prompt.slice(0, 150))) return INSTEAD_OF_TYPE;
  return null;
}

// --- Helpers ---

function readStdinSync(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString('utf-8')); }
    }, timeoutMs);
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    });
    process.stdin.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(''); }
    });
    if (process.stdin.readableEnded) {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }
  });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  }
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const prompt = input.prompt || input.message || '';
    const sessionId = input.session_id || input.sessionId || '';
    const directory = resolveProjectRoot(input.cwd || input.directory || process.cwd());

    // Decision harness in progress — user is answering domain questions,
    // not giving behavior feedback to Guya. Suppress to prevent
    // false-positive "corrections" from polluting the guideline corpus.
    if (isHarnessActive(directory)) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const correctionType = detectCorrection(prompt);

    if (!correctionType) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const now = new Date();
    const timestamp = now.getTime();
    const isoDate = now.toISOString();
    const uuid = randomUUID();

    ensureDir(GLOBAL_TRACES_DIR);

    // Detect project from cwd
    const cwdParts = directory.split('/');
    const desktopIdx = cwdParts.indexOf('Desktop');
    const project = desktopIdx >= 0 && cwdParts.length > desktopIdx + 1
      ? cwdParts[desktopIdx + 1] : cwdParts[cwdParts.length - 1];

    // Write trace entry to global store
    const trace = {
      id: randomUUID(),
      sessionId,
      timestamp,
      type: correctionType,
      domain: 'user_preferences',
      project,
      content: `${correctionType}: ${prompt.slice(0, 300)}`,
    };
    try {
      appendFileSync(join(GLOBAL_TRACES_DIR, `${todayString()}.jsonl`), JSON.stringify(trace) + '\n', 'utf-8');
    } catch {}

    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: '<guya-correction>\nNew correction detected and saved as tactical guideline.\n</guya-correction>',
      },
    }));
  } catch {
    // Never block prompt submission — fail silently
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

// Only run main() when executed as a script (not when imported by tests).
// Matches the pattern in guya-session-end.mjs — lets the contract test
// inspect PATTERNS without triggering the hook side effects.
const isMain = (() => {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; }
  catch { return false; }
})();

if (isMain) {
  main();
}

// Exports for testing — PATTERNS and detectCorrection are both inspected
// by trace-schema.test.mjs. PATTERNS alone is not sufficient: detectCorrection
// has an out-of-band emit path (INSTEAD_OF_PATTERN) that the contract test
// only catches by invoking detectCorrection directly.
export { PATTERNS, detectCorrection };
