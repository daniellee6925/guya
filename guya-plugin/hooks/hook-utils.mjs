/**
 * hook-utils.mjs — Shared utilities for Guya hooks
 *
 * CALLING SPEC:
 *   Exports:
 *     - readStdin(timeoutMs) -> Promise<string>
 *     - isHarnessActive(cwd) -> boolean
 *   Used by: guya-decision-gate.mjs, guya-intent-detect.mjs,
 *            guya-correction-detect.mjs, guya-pre-commit-review.mjs
 */

import { existsSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

// Harness markers older than this are treated as crash debris and removed.
const HARNESS_MARKER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check whether a decision harness (feature/bugfix/refactor/kickoff)
 * is currently running in this cwd.
 *
 * Reads .guya/decisions/.harness-active — a short-lived marker written
 * by the harness skill at Q1 and removed at plan-generation or abort.
 * Uses mtime-based TTL: if the marker is older than 2 hours it's treated
 * as crash debris from a previous session and auto-deleted.
 *
 * Returns false on any error. Hooks calling this should fail open
 * (proceed with normal behavior) rather than silently suppress.
 */
export function isHarnessActive(cwd) {
  try {
    const markerPath = join(cwd, '.guya', 'decisions', '.harness-active');
    if (!existsSync(markerPath)) return false;
    const ageMs = Date.now() - statSync(markerPath).mtimeMs;
    if (ageMs > HARNESS_MARKER_TTL_MS) {
      try { unlinkSync(markerPath); } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Read stdin with timeout (async, event-based).
 * Resolves to raw string — caller is responsible for JSON.parse.
 */
export function readStdin(timeoutMs = 2000) {
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
    process.stdin.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        console.error('[hook-utils] stdin error:', err.message);
        resolve('');
      }
    });
    if (process.stdin.readableEnded) {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }
  });
}
