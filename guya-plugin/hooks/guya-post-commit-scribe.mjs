#!/usr/bin/env node

/**
 * Guya PostToolUse Hook — Post-Commit Scribe
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, tool_output, session_id, cwd }
 *   Output: { continue: true, suppressOutput: true } (always passes through)
 *
 *   After a git commit, appends the commit message to STATUS.md's Recent Changes.
 *   Creates STATUS.md with a minimal skeleton if it doesn't exist.
 *   No LLM calls — pure file I/O. Completes in under 50ms.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, realpathSync } from 'fs';
import { join, basename, dirname } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isGitCommit, resolveProjectRoot } from './hook-utils.mjs';

// --- stdin ---

function readStdinSync(timeoutMs = 2000) {
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

// --- detection ---
// isGitCommit lives in hook-utils.mjs — shared with pre-commit-review to
// prevent drift and to fix the substring-match-in-echo-payloads bug.

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- git ---

function getLatestCommit(directory) {
  try {
    const log = execSync('git log -1 --format="%h%x00%s%x00%aI"', {
      cwd: directory, encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    }).trim();
    const [hash, message, date] = log.split('\x00');
    return { hash, message, date: date.slice(0, 10) };
  } catch (err) {
    process.stderr.write(`[guya-scribe] Failed to get commit info: ${err.message}\n`);
    return null;
  }
}

/**
 * Get the current HEAD as a full 40-char SHA. Full SHA (not abbreviated %h)
 * because we compare for equality — short hashes can collide as substrings.
 * Returns null if git isn't available or the repo has no commits yet.
 */
export function getCurrentHeadSha(directory) {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: directory, encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * The scribe persists the HEAD SHA it last processed to this marker file.
 * Purpose: distinguish "a new commit landed since the last scribe run"
 * (HEAD advanced → process + reset gate) from "HEAD is unchanged" (the
 * tool call didn't actually commit → skip everything).
 *
 * Historical bug (2026-04-09 session): the original implementation used
 * STATUS.md contents to decide whether HEAD advanced — if the current
 * commit hash was already logged, assume no advance. This broke in cases
 * where STATUS.md was missing or out of sync, or when short-hash
 * substrings false-deduped. The marker file is the authoritative signal:
 * it's owned by the scribe, written atomically, and compared against
 * full SHAs, not substrings.
 */
function headMarkerPath(directory) {
  return join(directory, '.guya', 'evolution', 'last-scribe-head');
}

export function readHeadMarker(markerPath) {
  try {
    return readFileSync(markerPath, 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

export function writeHeadMarker(markerPath, sha) {
  // Atomic write: temp file in the SAME directory (so rename stays on the
  // same filesystem and is POSIX-atomic), then rename over the target. A
  // crash mid-write leaves the temp file orphaned but never corrupts the
  // marker. Aligns with the session philosophy of "fail closed on transient
  // state" — a partial marker would readHeadMarker() as null, trigger a
  // bogus first-run bootstrap, and risk resetting the gate on the next
  // blocked commit.
  try {
    const parent = dirname(markerPath);
    mkdirSync(parent, { recursive: true });
    const tmpPath = join(parent, `.last-scribe-head.${randomUUID()}.tmp`);
    writeFileSync(tmpPath, sha);
    renameSync(tmpPath, markerPath);
    return true;
  } catch (err) {
    process.stderr.write(`[guya-scribe] Failed to write HEAD marker: ${err?.message || err}\n`);
    return false;
  }
}

function getProjectName(directory) {
  // Try package.json
  try {
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf-8'));
    if (pkg.name) return pkg.name;
  } catch {}

  // Try pyproject.toml
  try {
    const toml = readFileSync(join(directory, 'pyproject.toml'), 'utf-8');
    const match = toml.match(/^name\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch {}

  // Fall back to directory name
  return basename(directory);
}

// --- STATUS.md ---

const SKELETON = (name) => `# ${name} — Status

> Last updated: ${new Date().toLocaleDateString('en-CA')}

## Current Focus
(not set)

## Recent Changes

## In Progress

## TODO

## Decisions & Notes
`;

/**
 * Append a commit entry to STATUS.md's Recent Changes section.
 *
 * Returns:
 *   true  — new entry written (fresh STATUS.md or appended to existing)
 *   false — STATUS.md already contains the commit hash as a substring;
 *           skipped the write to avoid duplicating the human-facing log.
 *
 * IMPORTANT: this return value is NOT used to decide whether HEAD
 * advanced — that decision lives in main() via the last-scribe-head
 * marker file comparison. Conflating the two was the original bug
 * (a blocked commit with missing STATUS.md produced true here but HEAD
 * hadn't actually advanced, so the gate got wiped anyway). Treat this
 * strictly as "was STATUS.md modified" for display purposes.
 */
function appendCommit(directory, commit) {
  const statusPath = join(directory, 'STATUS.md');
  const entry = `- [${commit.date}] \`${commit.hash}\` — ${commit.message}`;

  if (!existsSync(statusPath)) {
    // Fresh STATUS.md — this commit is definitely new to the scribe.
    const name = getProjectName(directory);
    const content = SKELETON(name).replace(
      '## Recent Changes\n',
      `## Recent Changes\n${entry}\n`
    );
    writeFileSync(statusPath, content);
    return true;
  }

  const content = readFileSync(statusPath, 'utf-8');

  // Dedupe on the commit's short hash. Substring match is imprecise
  // (short hashes can collide as substrings of longer ones), but it's
  // only used for display-level deduplication of the human-facing log.
  // The gate-reset decision does NOT depend on this — see main().
  if (content.includes(commit.hash)) return false;

  // Update timestamp
  let updated = content.replace(
    /> Last updated: .*/,
    `> Last updated: ${new Date().toLocaleDateString('en-CA')}`
  );

  // Append after "## Recent Changes" header
  const marker = '## Recent Changes';
  const idx = updated.indexOf(marker);
  if (idx === -1) {
    // No Recent Changes section — append at end
    updated += `\n${marker}\n${entry}\n`;
  } else {
    const insertPos = idx + marker.length;
    // Find the next newline after the header
    const nextNewline = updated.indexOf('\n', insertPos);
    updated = updated.slice(0, nextNewline + 1) + entry + '\n' + updated.slice(nextNewline + 1);
  }

  writeFileSync(statusPath, updated);
  return true;
}

// --- main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {
      return output({ continue: true, suppressOutput: true });
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = resolveProjectRoot(input.cwd || input.directory || process.cwd());

    if (!isGitCommit(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    // HEAD-advance check is the authoritative signal for "a new commit
    // actually landed since the last scribe run". This replaces the old
    // STATUS.md-based dedup heuristic, which broke when STATUS.md was
    // missing, out of sync, or had short-hash substring collisions.
    //
    // Flow:
    //   1. Get current HEAD via `git rev-parse HEAD` (full SHA)
    //   2. Read last-scribe-head marker
    //   3. If they match → HEAD unchanged → skip everything. The Bash
    //      tool call matched isGitCommit but didn't advance HEAD (blocked
    //      commit, duplicate hook fire, or spurious regex hit).
    //   4. If they differ → process: appendCommit + reset gate + update
    //      marker.
    //
    // First-run bootstrap: marker doesn't exist → lastHead is null →
    // currentHead !== null → treat as new → process + write marker.
    // This wipes the gate on the very first scribe invocation per repo,
    // which is the correct one-time cost for establishing the marker.
    const currentHead = getCurrentHeadSha(directory);
    if (!currentHead) {
      // Can't determine git state (no repo, or git not installed).
      // Skip silently — scribe has nothing authoritative to act on.
      return output({ continue: true, suppressOutput: true });
    }

    const markerPath = headMarkerPath(directory);
    const lastHead = readHeadMarker(markerPath);

    if (currentHead === lastHead) {
      process.stderr.write(`[guya-scribe] HEAD unchanged (${currentHead.slice(0, 7)}), skipping — no new commit\n`);
      return output({ continue: true, suppressOutput: true });
    }

    const commit = getLatestCommit(directory);
    if (!commit) {
      return output({ continue: true, suppressOutput: true });
    }

    // Append to STATUS.md (best-effort display log). The return value is
    // just "did we modify STATUS.md" — the gate reset is NOT gated on it.
    appendCommit(directory, commit);

    // Reset review state AFTER confirming HEAD actually advanced —
    // previous implementation wiped on every matched-regex Bash call,
    // even blocked ones, which burned the next commit's evidence.
    //
    // Evidence file lives at .guya/evolution/review-evidence.jsonl (owned
    // by review-evidence.mjs). Deleting the file entirely is the cleanest
    // reset — next readEvidence returns {missing: true} which blocks with
    // the canonical "no review evidence" reason. Also sweeps the legacy
    // `review-evidence.json` file so post-refactor repos don't keep the
    // stale artifact lying around.
    const evolutionDir = join(directory, '.guya', 'evolution');
    try {
      const gateFile = join(evolutionDir, 'review-gate.json');
      if (existsSync(gateFile)) {
        writeFileSync(gateFile, JSON.stringify({ reviewed: false }));
      }
      const newEvidence = join(evolutionDir, 'review-evidence.jsonl');
      if (existsSync(newEvidence)) {
        unlinkSync(newEvidence);
      }
      const oldEvidence = join(evolutionDir, 'review-evidence.json');
      if (existsSync(oldEvidence)) {
        unlinkSync(oldEvidence);
      }
    } catch {
      process.stderr.write('[guya-scribe] Warning: could not reset review state\n');
    }

    // Clear active decision session AFTER commit succeeds
    // This forces the next work to go through the decision harness again
    try {
      const { unlink } = await import('fs/promises');
      const decisionsDir = join(directory, '.guya', 'decisions');
      const activeSessionFile = join(decisionsDir, '.active-session');
      if (existsSync(activeSessionFile)) {
        writeFileSync(activeSessionFile, '');  // Clear instead of delete
        process.stderr.write('[guya-scribe] Cleared active decision session\n');
      }
    } catch {
      process.stderr.write('[guya-scribe] Warning: could not clear active session\n');
    }

    // Persist the new HEAD as the marker — future scribe invocations
    // will see currentHead === lastHead and skip unless HEAD advances
    // again. Writing LAST so a crash between the gate reset and this
    // write will cause the next run to retry the reset (idempotent).
    writeHeadMarker(markerPath, currentHead);

    process.stderr.write(`[guya-scribe] Logged commit ${commit.hash} (${commit.message}) to STATUS.md\n`);
    output({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `<guya-scribe>\nLogged commit ${commit.hash} (${commit.message}) to STATUS.md\n</guya-scribe>`,
      },
    });
  } catch (err) {
    process.stderr.write(`[guya-scribe] ERROR: ${err?.message || err}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

// Only run main() when executed as a script (not when imported by tests).
// Matches the pattern in guya-session-end.mjs / guya-correction-detect.mjs /
// guya-pre-commit-review.mjs — lets appendCommit be unit-tested in isolation.
// Compare realpaths on both sides — Node resolves import.meta.url to the
// realpath, but argv[1] keeps the symlink path (Claude Code plugin marketplace
// installs are symlinks to the source tree). A naive == would silently disable
// main() under symlinked installs. See hooks/CLAUDE.md "Regression History".
const isMain = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();

if (isMain) {
  main();
}

// Exports for testing — appendCommit covers the STATUS.md display path.
// The HEAD marker helpers (getCurrentHeadSha, readHeadMarker,
// writeHeadMarker) are already exported inline where they're defined,
// and together they drive the gate-reset decision in main(). See the
// post-commit-scribe.test.mjs integration test for the end-to-end
// "blocked commit does not wipe evidence" contract.
export { appendCommit, headMarkerPath };
