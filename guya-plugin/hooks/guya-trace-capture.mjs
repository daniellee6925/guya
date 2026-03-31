#!/usr/bin/env node

/**
 * Guya PostToolUse Hook — Trace Capture
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { toolName, toolInput, toolOutput, sessionId, directory }
 *   Output: { continue: true, suppressOutput: true }
 *
 *   Appends a JSONL trace entry to {directory}/.guya/evolution/traces/YYYY-MM-DD.jsonl
 *   Creates the traces directory if missing
 *   Completes in under 50ms — no LLM calls
 */

import { existsSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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

function truncate(value, maxChars) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 3) + '...';
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function ensureTracesDir(tracesDir) {
  if (!existsSync(tracesDir)) {
    try { mkdirSync(tracesDir, { recursive: true }); } catch {}
  }
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const toolName = input.tool_name || input.toolName || 'unknown';
    const toolInput = input.tool_input || input.toolInput || '';
    const toolOutput = input.tool_response || input.toolOutput || '';
    const sessionId = input.session_id || input.sessionId || '';
    const directory = input.cwd || input.directory || process.cwd();

    const tracesDir = join(directory, '.guya', 'evolution', 'traces');
    ensureTracesDir(tracesDir);

    const trace = {
      id: randomUUID(),
      sessionId,
      timestamp: Date.now(),
      type: 'tool_call',
      domain: 'general',
      content: `Tool: ${toolName}`,
      context: truncate(toolInput, 500),
      toolOutput: truncate(toolOutput, 500),
    };

    const traceFile = join(tracesDir, `${todayString()}.jsonl`);
    try {
      appendFileSync(traceFile, JSON.stringify(trace) + '\n', 'utf-8');
    } catch {}

    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    // Never block tool use — fail silently
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
