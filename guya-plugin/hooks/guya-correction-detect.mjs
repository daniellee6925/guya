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
import { randomUUID } from 'crypto';

// --- Correction patterns ---

const PATTERNS = [
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
];

const INSTEAD_OF_PATTERN = /\binstead of\b/i;

// Short prompts that are just commands (< 15 chars) aren't feedback
const MIN_SIGNAL_LENGTH = 15;

function detectCorrection(prompt) {
  if (prompt.length < MIN_SIGNAL_LENGTH) return null;
  for (const { regex, type } of PATTERNS) {
    if (regex.test(prompt)) return type;
  }
  if (INSTEAD_OF_PATTERN.test(prompt.slice(0, 150))) return 'correction';
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
    const directory = input.cwd || input.directory || process.cwd();

    const correctionType = detectCorrection(prompt);

    if (!correctionType) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const now = new Date();
    const timestamp = now.getTime();
    const isoDate = now.toISOString();
    const uuid = randomUUID();

    const tracesDir = join(directory, '.guya', 'evolution', 'traces');
    const tacticalDir = join(directory, '.guya', 'evolution', 'guidelines', 'tactical');
    ensureDir(tracesDir);
    ensureDir(tacticalDir);

    // Write trace entry
    const trace = {
      id: randomUUID(),
      sessionId,
      timestamp,
      type: correctionType,
      domain: 'user_preferences',
      content: `Correction detected: ${prompt.slice(0, 200)}`,
    };
    try {
      appendFileSync(join(tracesDir, `${todayString()}.jsonl`), JSON.stringify(trace) + '\n', 'utf-8');
    } catch {}

    // Write tactical guideline
    const guidelineContent = `---
id: guideline-${uuid}
domain: user_preferences
confidence: 0.8
created: ${isoDate}
type: tactical
---

${prompt.trim()}
`;
    try {
      writeFileSync(join(tacticalDir, `${timestamp}.md`), guidelineContent, 'utf-8');
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

main();
