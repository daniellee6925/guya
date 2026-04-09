#!/usr/bin/env node

/**
 * guya-decision-gate.mjs
 *
 * UserPromptSubmit hook — session-scoped decision enforcement
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { prompt, session_id, cwd }
 *   Output: JSON on stdout — { continue: true } or { decision: "block", reason }
 *
 * Detects work intent patterns and checks for an active decision doc.
 * Blocks implementation if no decision harness has been run in this session.
 *
 * Decision doc is active only if:
 * - .guya/decisions/.active-session exists
 * - Contains a session_id matching the current session
 * - Not cleared by post-commit hook
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readStdin } from './hook-utils.mjs';

// Work intent patterns — these trigger the gate
const WORK_PATTERNS = [
  /\b(implement|build|create|write|add|develop|code)\s+(a\s+|an\s+|the\s+)?\w+/i,
  /\b(fix|debug|resolve|patch)\s+(the\s+|this\s+|a\s+)?\w+/i,
  /\b(refactor|restructure|clean up|reorganize|optimize|improve)\s+/i,
  /\b(start|kick off|begin)\s+(a\s+|the\s+)?(new\s+)?project/i,
];

// Patterns to exclude — these DON'T trigger the gate
const EXCLUDE_PATTERNS = [
  /^(what|how|why|when|where|who|explain|show|describe|demonstrate|does|is|are|can|could|should|would|should i|can you|could you|would you|let me|help me|tell me|check|look|read|review|analyze|understand|learn|teach)\s*/i,
  /\?$/,  // ends with question mark
  /^(yes|no|ok|okay|sure|thanks|thank you|great|looks good|perfect|sounds good|makes sense|got it)/i,
];

/**
 * Check if text matches work intent
 */
function hasWorkIntent(text) {
  if (!text || typeof text !== 'string') return false;

  // Check exclusion patterns first
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Check work patterns
  for (const pattern of WORK_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for active session decision doc
 */
function getActiveSession(cwd) {
  try {
    const sessionFilePath = join(cwd, '.guya', 'decisions', '.active-session');

    if (!existsSync(sessionFilePath)) {
      return null;
    }

    const content = readFileSync(sessionFilePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[guya-decision-gate] getActiveSession failed:', err.message);
    return null;
  }
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const stdinData = await readStdin(2000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {
      console.error('[guya-decision-gate] stdin parse failed:', stdinData.slice(0, 100));
    }

    const userText = input.prompt || input.message || '';
    const cwd = input.cwd || input.directory || process.cwd();
    const sessionId = input.session_id;

    if (!userText || !sessionId) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Check for work intent
    if (!hasWorkIntent(userText)) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Work intent detected — check for active session
    console.error('[guya-decision-gate] Work intent detected, checking session...');
    const activeSession = getActiveSession(cwd);

    if (!activeSession || activeSession.session_id !== sessionId) {
      const blockMessage = `[DECISION GATE] No active decision doc found for this session.

Before implementing, run the appropriate harness:
  /feature   — new capability in existing project
  /bugfix    — debugging/fixing something broken
  /refactor  — code quality improvement
  /kickoff   — starting a new project from scratch

This ensures scope, constraints, and success criteria are defined before any code is written.

Active decision docs are cleared after each commit, so each session requires a fresh harness run.`;

      console.log(JSON.stringify({
        decision: 'block',
        reason: blockMessage,
      }));
      return;
    }

    // Active session found and session_id matches — pass through
    console.log(JSON.stringify({ continue: true }));

  } catch (err) {
    console.error('[guya-decision-gate] Error:', err.message);
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
