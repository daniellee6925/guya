#!/usr/bin/env node

/**
 * guya-decision-gate.mjs
 *
 * UserPromptSubmit hook — session-scoped decision enforcement
 *
 * Detects work intent patterns and checks for an active decision doc.
 * Blocks implementation if no decision harness has been run in this session.
 *
 * Decision doc is active only if:
 * - .guya/decisions/.active-session exists
 * - Contains a session_id matching the current session
 * - Not cleared by post-commit hook
 */

import fs from 'fs';
import path from 'path';

const INPUT_TIMEOUT = 2000;

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
 * Read JSON from stdin with timeout
 */
function readStdinSync(timeoutMs = INPUT_TIMEOUT) {
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length);
    if (bytesRead === 0) return null;
    const input = buffer.toString('utf8', 0, bytesRead).trim();
    return input.length > 0 ? JSON.parse(input) : null;
  } catch (err) {
    console.error('[guya-decision-gate] stdin read failed:', err.message);
    return null;
  }
}

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
    const sessionFilePath = path.join(cwd, '.guya', 'decisions', '.active-session');

    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const content = fs.readFileSync(sessionFilePath, 'utf-8');
    const sessionData = JSON.parse(content);

    return sessionData;
  } catch (err) {
    // File doesn't exist or is malformed — treat as no active session
    console.error('[guya-decision-gate] getActiveSession failed:', err.message);
    return null;
  }
}

/**
 * Main hook logic
 */
function main() {
  try {
    const hookInput = readStdinSync();

    if (!hookInput || !hookInput.tool_input) {
      // Can't determine intent — pass through
      return JSON.stringify({ continue: true });
    }

    const userText = typeof hookInput.tool_input === 'string'
      ? hookInput.tool_input
      : (hookInput.tool_input?.prompt || '');
    const cwd = hookInput.cwd || process.cwd();
    const sessionId = hookInput.session_id;

    if (!sessionId) {
      // No session ID in hook input — pass through (can't validate session)
      console.error('[guya-decision-gate] Warning: No session_id in hook input');
      return JSON.stringify({ continue: true });
    }

    // Check for work intent
    if (!hasWorkIntent(userText)) {
      // No work intent detected — pass through
      return JSON.stringify({ continue: true });
    }

    // Work intent detected — check for active session
    console.error('[guya-decision-gate] Work intent detected, checking session...');
    const activeSession = getActiveSession(cwd);

    if (!activeSession || activeSession.session_id !== sessionId) {
      // No active decision doc for this session — block
      const blockMessage = `[DECISION GATE] No active decision doc found for this session.

Before implementing, run the appropriate harness:
  /feature   — new capability in existing project
  /bugfix    — debugging/fixing something broken
  /refactor  — code quality improvement
  /kickoff   — starting a new project from scratch

This ensures scope, constraints, and success criteria are defined before any code is written.

Active decision docs are cleared after each commit, so each session requires a fresh harness run.`;

      return JSON.stringify({
        decision: 'block',
        reason: blockMessage,
      });
    }

    // Active session found and session_id matches — pass through
    return JSON.stringify({ continue: true });

  } catch (err) {
    // On any error, pass through (never fatal)
    // Log to stderr for debugging but don't block
    console.error('[guya-decision-gate] Error:', err.message);
    return JSON.stringify({ continue: true });
  }
}

// Execute and output result
process.stdout.write(main());
