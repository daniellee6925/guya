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
  { regex: /\bno[,.]?\s+(use|do|make|write|prefer|try)\b/i, type: 'correction' },
  { regex: /\b(wrong|incorrect|that's not right|fix that|not what i asked)\b/i, type: 'correction' },
  { regex: /\b(always|never)\s+(use|do|write|prefer|make)\b/i, type: 'preference' },
];

const INSTEAD_OF_PATTERN = /\binstead of\b/i;

function detectCorrection(prompt) {
  for (const { regex, type } of PATTERNS) {
    if (regex.test(prompt)) return type;
  }
  // "instead of" only counts near the beginning
  if (INSTEAD_OF_PATTERN.test(prompt.slice(0, 100))) return 'correction';
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

    const { prompt = '', sessionId = '', directory = process.cwd() } = input;

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
