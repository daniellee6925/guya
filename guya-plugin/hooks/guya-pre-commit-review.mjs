#!/usr/bin/env node

/**
 * Guya PreToolUse Hook — Pre-Commit Code Review Gate
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, session_id, cwd }
 *   Output: JSON on stdout with { decision: "allow" } or { decision: "block", reason: "..." }
 *
 *   Intercepts git commit commands and blocks them until
 *   karpathy-review and review-followup have been run on changed files.
 *   Tracks review state in a session-scoped file.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

function isGitCommit(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  // Match git commit but not git commit --amend or other non-standard commits
  return /\bgit\s+commit\b/.test(cmd);
}

function getReviewStateFile(directory) {
  const stateDir = join(directory, '.guya', 'evolution');
  if (!existsSync(stateDir)) {
    try { mkdirSync(stateDir, { recursive: true }); } catch {}
  }
  return join(stateDir, 'review-gate.json');
}

function readReviewState(stateFile) {
  try {
    if (!existsSync(stateFile)) return null;
    return JSON.parse(readFileSync(stateFile, 'utf-8'));
  } catch {
    return null;
  }
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    // Only care about git commit commands
    if (!isGitCommit(toolName, toolInput)) {
      console.log(JSON.stringify({ decision: 'allow' }));
      return;
    }

    // Check if review has been completed for this commit
    const stateFile = getReviewStateFile(directory);
    const state = readReviewState(stateFile);

    if (state && state.reviewed === true) {
      // Review was done — allow the commit and reset state
      writeFileSync(stateFile, JSON.stringify({ reviewed: false }));
      console.log(JSON.stringify({ decision: 'allow' }));
      return;
    }

    // Block the commit — review not done yet
    console.log(JSON.stringify({
      decision: 'block',
      reason: 'Pre-commit review required. Run karpathy-review on the staged changes first, then review-followup. After both pass, mark the review complete by writing { "reviewed": true } to .guya/evolution/review-gate.json, then retry the commit.'
    }));
  } catch {
    // Never block on hook errors — allow the commit
    console.log(JSON.stringify({ decision: 'allow' }));
  }
}

main();
