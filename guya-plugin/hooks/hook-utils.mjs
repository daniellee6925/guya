/**
 * hook-utils.mjs — Shared utilities for Guya hooks
 *
 * CALLING SPEC:
 *   Exports:
 *     - readStdin(timeoutMs) -> Promise<string>
 *     - resolveProjectRoot(cwd) -> string — resolves any subdirectory to the
 *       git repo root via `git rev-parse --show-toplevel`; falls back to raw
 *       cwd for non-repo paths. Prevents phantom .guya/ state dirs when
 *       Claude Code's cwd is a subdirectory (e.g. guya-plugin/).
 *     - isHarnessActive(cwd) -> boolean
 *     - FEEDBACK_TRACE_TYPES / FEEDBACK_TRACE_TYPE_SET — user-feedback
 *       trace-type enum shared by correction-detect (producer) and
 *       session-end hasLearningSignal (consumer) to prevent schema drift
 *     - isGitCommit(toolName, toolInput) -> boolean — shared detector
 *       used by the pre-commit gate AND the post-commit scribe to
 *       prevent drift between them (historical bug: the scribe fired
 *       on literal 'git commit' substrings inside `echo '...'` payloads)
 *   Used by: guya-decision-gate.mjs, guya-intent-detect.mjs,
 *            guya-correction-detect.mjs, guya-pre-commit-review.mjs,
 *            guya-post-commit-scribe.mjs, guya-session-end.mjs
 */

import { existsSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Harness markers older than this are treated as crash debris and removed.
const HARNESS_MARKER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Resolve any cwd to the git repo root, preventing phantom .guya/ state dirs
 * when Claude Code fires hooks from a subdirectory (e.g. guya-plugin/).
 */
export function resolveProjectRoot(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    // git exits 128 for "not a git repository" — expected, no log needed.
    // Any other failure (git not installed, permissions) is unexpected.
    if (e.status !== 128) {
      process.stderr.write(`[guya] resolveProjectRoot failed (${cwd}): ${e.message}\n`);
    }
    return cwd; // not a git repo — use raw cwd as fallback
  }
}

/**
 * User-feedback trace types that always represent learning signal.
 *
 * Single source of truth for the producer/consumer contract:
 *   - Producer: guya-correction-detect.mjs PATTERNS must only emit these types
 *   - Consumer: guya-session-end.mjs hasLearningSignal must accept all of these
 *
 * Drift between producer and consumer silently drops traces from the
 * classification pipeline (historical bug — confirmation/decision/pushback
 * were dropped for an unknown stretch). The contract test in
 * __tests__/trace-schema.test.mjs enforces both directions.
 *
 * If you add a new regex with a new type to correction-detect PATTERNS,
 * add the type here too. The contract test will fail loudly if you forget.
 */
export const FEEDBACK_TRACE_TYPES = Object.freeze([
  'correction',
  'confirmation',
  'preference',
  'decision',
  'pushback',
]);

export const FEEDBACK_TRACE_TYPE_SET = new Set(FEEDBACK_TRACE_TYPES);

/**
 * Decide whether a trace carries enough learning signal to be classified.
 *
 * Pure function — lives in hook-utils (not guya-session-end) so the schema
 * contract test can import it without loading @anthropic-ai/sdk and the
 * rest of the session-end pipeline.
 *
 * Paths:
 *   1. Any user-feedback type in FEEDBACK_TRACE_TYPE_SET → classify
 *   2. 'reflection' → classify (kept for future producers — memory_reflect
 *      currently writes markdown, not traces)
 *   3. context path matches .claude/guya/ or .guya/ → classify (edits to
 *      Guya's own identity/guideline/memory files)
 *   4. Legacy "Tool: X" content shape:
 *      - read-only tools → skip
 *      - write-family tools → classify
 *   5. Default → skip
 */
export function hasLearningSignal(trace) {
  // Null guard — this is shared code and callers may pass thin objects.
  // Original caller (preFilterTraces) only passes real trace objects, but
  // widening the caller surface widens the input risk surface.
  if (!trace || typeof trace !== 'object') return false;

  if (FEEDBACK_TRACE_TYPE_SET.has(trace.type)) return true;
  if (trace.type === 'reflection') return true;

  const ctx = (trace.context || '').toLowerCase();
  if (ctx.includes('.claude/guya/') || ctx.includes('.guya/')) return true;

  const toolName = (trace.content || '').replace('Tool: ', '').toLowerCase();
  const noiseTools = ['read', 'glob', 'grep', 'bash', 'ls', 'cat', 'head', 'tail', 'toolsearch'];
  if (noiseTools.includes(toolName)) return false;
  if (['write', 'edit', 'notebookedit'].includes(toolName)) return true;

  return false;
}

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
 * Detect whether a Bash tool invocation is a `git commit` command.
 *
 * Historical bug (2026-04-09): the original `/\bgit\s+commit\b/.test(cmd)`
 * check fired on any substring match, including literal `git commit` inside
 * quoted echo payloads like `echo '{"command":"git commit -m test"}'`. The
 * post-commit-scribe then ran `getLatestCommit()` + wiped the review gate
 * evidence for a commit that never happened.
 *
 * Two-layer defense:
 *   1. Strip single- and double-quoted substrings so quoted payloads don't
 *      match (handles `echo '... git commit ...'`).
 *   2. Require `git commit` to appear at a shell statement boundary:
 *      start of command, or immediately after a shell separator like
 *      `&&`, `||`, `;`, `|`, `(`, or newline. This rejects `echo git commit`,
 *      `grep git commit file`, `printf %s git commit`, and comments like
 *      `# git commit` where `git commit` is an argument to another command,
 *      not an invocation.
 *
 * Known false-negative (documented-only, not pinned by a test): `bash -c
 * "git commit -m foo"` — the quoted arg is stripped, leaving `bash -c`,
 * which doesn't match. Uncommon invocation style for Daniel's workflow.
 *
 * Pairs with a HEAD-advance check in post-commit-scribe for defense in
 * depth: even if this regex slips, the scribe's marker-file comparison
 * verifies the commit actually landed before wiping state.
 */
export function isGitCommit(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  // Layer 1: strip single- and double-quoted substrings so quoted `git commit`
  // text doesn't match. Order matters only for clarity — single first because
  // shells typically treat single-quoted strings as literal.
  const unquoted = cmd.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  // Layer 2: require a shell statement boundary before `git commit`. This
  // rejects cases where `git commit` appears as an argument to another
  // command (echo, grep, printf) or inside a comment.
  return /(?:^|[;&|()\n])\s*git\s+commit\b/.test(unquoted);
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
