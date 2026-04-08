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

import { existsSync, appendFileSync, mkdirSync, statSync } from 'fs';

const MAX_TRACE_FILE_BYTES = 5 * 1024 * 1024; // 5MB cap
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

// --- Filtering ---

// Directories whose files are noise — internal state, not learning signal
const NOISE_PATHS = ['.omc/', '.guya/evolution/', 'node_modules/', '.git/'];

// Only trace files that indicate real work
const SIGNAL_EXTENSIONS = ['.py', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.md', '.json', '.yaml', '.yml', '.toml', '.sh'];

function isSignificantEdit(toolInput) {
  const filePath = typeof toolInput === 'string' ? toolInput : (toolInput?.file_path || toolInput?.path || '');
  if (!filePath) return false;
  if (NOISE_PATHS.some(p => filePath.includes(p))) return false;
  if (!SIGNAL_EXTENSIONS.some(ext => filePath.endsWith(ext))) return false;
  return true;
}

function extractFileSummary(toolInput) {
  const filePath = typeof toolInput === 'string' ? toolInput : (toolInput?.file_path || toolInput?.path || '');
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1] || 'unknown';
  const project = parts.find((_, i) => i > 0 && parts[i - 1] === 'Desktop') || parts[parts.length - 2] || '';
  return { fileName, project, filePath };
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const toolName = input.tool_name || input.toolName || 'unknown';
    const toolInput = input.tool_input || input.toolInput || '';
    const sessionId = input.session_id || input.sessionId || '';
    const directory = input.cwd || input.directory || process.cwd();

    // Only trace significant file edits — skip noise
    if (!isSignificantEdit(toolInput)) {
      return console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }

    const { fileName, project, filePath } = extractFileSummary(toolInput);
    const tracesDir = join(directory, '.guya', 'evolution', 'traces');
    ensureTracesDir(tracesDir);

    const trace = {
      id: randomUUID(),
      sessionId,
      timestamp: Date.now(),
      type: 'file_edit',
      domain: 'workflow',
      content: `${toolName}: ${fileName}`,
      file: filePath,
      project,
    };

    const traceFile = join(tracesDir, `${todayString()}.jsonl`);
    try {
      if (existsSync(traceFile) && statSync(traceFile).size >= MAX_TRACE_FILE_BYTES) {
        // silently drop — better to lose a trace than fill the disk
      } else {
        appendFileSync(traceFile, JSON.stringify(trace) + '\n', 'utf-8');
      }
    } catch {}

    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    // Never block tool use — fail silently
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
