/**
 * commit-identity.mjs — Commit changes to ~/.claude/guya/ from any hook
 *
 * CALLING SPEC:
 *   Exports:
 *     - commitIdentityChange({ message, files?, repoPath? })
 *         -> { committed: boolean, sha: string|null, reason: string }
 *
 *   Behavior:
 *     1. Verify repoPath is a git repo. Fail loudly if not.
 *     2. Stage files (specific list, or `git add -A` if omitted).
 *     3. If nothing is staged → no-op, return { committed: false, reason: 'nothing-staged' }.
 *     4. Run `git commit -m <message>`. Capture the resulting SHA.
 *     5. Append an entry to `<repoPath>/.commit-log` (NDJSON audit trail).
 *     6. Return { committed, sha, reason }.
 *
 *   Never throws — every failure path returns a structured result so callers
 *   can fail open. Stderr logging is loud (`[guya-commit-identity] ...`).
 *
 *   Why this exists separately:
 *     The new reflection-driven self-edit pipeline needs to commit to
 *     ~/.claude/guya/ from the session-end hook. Past pain (2026-04-10):
 *     PostToolUse:Bash never dispatched, so the scribe "ran" without
 *     running. We don't want a repeat where this writes proposals but
 *     silently never commits them. This module is testable in isolation
 *     and leaves a per-attempt audit log on disk so production failures
 *     are visible to a human (`cat ~/.claude/guya/.commit-log`).
 */

import { existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const DEFAULT_REPO = join(homedir(), '.claude', 'guya');
const LOG_PREFIX = '[guya-commit-identity]';

function nowIso() {
  return new Date().toISOString();
}

function logAudit(repoPath, entry) {
  try {
    const line = JSON.stringify({ ts: nowIso(), ...entry }) + '\n';
    appendFileSync(join(repoPath, '.commit-log'), line, 'utf-8');
  } catch (e) {
    // Audit log failure is non-fatal — stderr is the secondary channel.
    process.stderr.write(`${LOG_PREFIX} audit log write failed: ${e.message}\n`);
  }
}

function isGitRepo(repoPath) {
  if (!existsSync(repoPath)) return false;
  if (!existsSync(join(repoPath, '.git'))) return false;
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: repoPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function hasStagedChanges(repoPath) {
  try {
    // `git diff --cached --quiet` exits 0 if no changes, 1 if changes exist.
    execSync('git diff --cached --quiet', {
      cwd: repoPath, stdio: ['pipe', 'pipe', 'pipe'],
    });
    return false; // exit 0 → nothing staged
  } catch (e) {
    if (e.status === 1) return true; // exit 1 → staged changes present
    // Any other exit code is unexpected (git missing, repo broken).
    process.stderr.write(`${LOG_PREFIX} hasStagedChanges unexpected exit ${e.status}: ${e.message}\n`);
    return false;
  }
}

function getHeadSha(repoPath) {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: repoPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Commit changes to an identity repo (default ~/.claude/guya/).
 *
 * @param {object} opts
 * @param {string} opts.message - Commit message (required, non-empty).
 * @param {string[]} [opts.files] - Specific files to stage. If omitted, stages everything (`git add -A`).
 * @param {string} [opts.repoPath] - Repo path. Defaults to ~/.claude/guya/.
 * @returns {{ committed: boolean, sha: string|null, reason: string }}
 */
export function commitIdentityChange({ message, files, repoPath } = {}) {
  const repo = repoPath || DEFAULT_REPO;

  if (!message || typeof message !== 'string' || !message.trim()) {
    const reason = 'missing-message';
    process.stderr.write(`${LOG_PREFIX} ${reason}\n`);
    logAudit(repo, { action: 'reject', reason });
    return { committed: false, sha: null, reason };
  }

  if (!isGitRepo(repo)) {
    const reason = 'not-a-git-repo';
    process.stderr.write(`${LOG_PREFIX} ${reason}: ${repo}\n`);
    // Don't try to logAudit — the repo doesn't exist, so the log path is meaningless.
    return { committed: false, sha: null, reason };
  }

  // Stage files
  try {
    if (Array.isArray(files) && files.length > 0) {
      const argList = files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ');
      execSync(`git add ${argList}`, { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      execSync('git add -A', { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });
    }
  } catch (e) {
    const reason = `stage-failed: ${e.message}`;
    process.stderr.write(`${LOG_PREFIX} ${reason}\n`);
    logAudit(repo, { action: 'fail', reason });
    return { committed: false, sha: null, reason };
  }

  if (!hasStagedChanges(repo)) {
    const reason = 'nothing-staged';
    process.stderr.write(`${LOG_PREFIX} ${reason} — no commit created\n`);
    logAudit(repo, { action: 'noop', reason });
    return { committed: false, sha: null, reason };
  }

  // Commit. Pass the message via -F /dev/stdin so multiline messages and
  // special characters don't need shell escaping.
  try {
    execSync('git commit -F -', {
      cwd: repo,
      input: message,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    const reason = `commit-failed: ${e.message}`;
    process.stderr.write(`${LOG_PREFIX} ${reason}\n`);
    logAudit(repo, { action: 'fail', reason });
    return { committed: false, sha: null, reason };
  }

  const sha = getHeadSha(repo);
  if (!sha) {
    // Commit succeeded (git commit returned 0) but we can't read HEAD.
    // This is unusual — git is in a weird state. Surface it loudly so the
    // caller's `if (result.sha)` checks don't silently misclassify a real
    // commit as a no-op, and so the audit log records the anomaly.
    process.stderr.write(`${LOG_PREFIX} WARN: commit succeeded but git rev-parse HEAD failed — sha unavailable\n`);
  } else {
    process.stderr.write(`${LOG_PREFIX} committed ${sha.slice(0, 7)}\n`);
  }
  logAudit(repo, { action: 'success', sha, message: message.split('\n')[0] });
  return { committed: true, sha, reason: 'ok' };
}
