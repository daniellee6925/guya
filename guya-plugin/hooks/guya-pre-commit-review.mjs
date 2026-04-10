#!/usr/bin/env node

/**
 * Guya PreToolUse Hook — Review Gate + Evidence Recorder
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, session_id, cwd }
 *   Output: { continue: true } or { decision: "block", reason: "..." }
 *
 *   Three jobs:
 *     1. On Skill call (guya-review / guya-deep-review) → record evidence
 *     2. On git commit --no-verify → block
 *     3. On git commit → check exemptions, small change, evidence → allow or block
 *
 *   Config lookup (loadConfig): project `.guya/pre-commit-config.json`
 *   merged over user-wide `~/.claude/guya/pre-commit-config.json`, project
 *   wins on key collision. Missing-both = fail-open (returns null, gate skips).
 *   User-wide acts as an implicit opt-in for every project.
 *
 *   Quality checks (test existence, complexity, cleanup) are handled by
 *   .git/hooks/pre-commit which runs with accurate staged file state.
 */

import { existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { readStdin, isGitCommit, resolveProjectRoot } from './hook-utils.mjs';
import {
  appendStep,
  validateForCommit,
  deleteOldEvidenceFile,
  readEvidence,
  DEFAULT_GATE_MAX_AGE_MINUTES,
} from './review-evidence.mjs';

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- config ---

// User-wide default lives here. Project-level at `{directory}/.guya/pre-commit-config.json`.
// If only the user-wide file exists, the gate still fires for the project.
// Historical bug: the hook used to hard fail-open when the project config was
// missing, silently disabling the quality harness in every project Daniel
// hadn't explicitly configured (SDF ran ungated for weeks). The user-wide
// fallback makes "default to the quality bar I care about everywhere" the
// out-of-the-box behavior.
const USER_CONFIG_PATH = join(homedir(), '.claude', 'guya', 'pre-commit-config.json');

/**
 * Read a JSON file with tri-state return that distinguishes legitimate
 * absence (ENOENT) from "file exists but is broken" (parse error, other IO).
 *
 * Why tri-state: collapsing both into null (the original implementation)
 * relocates the fail-open bug — a transient partial-write during editor
 * save or a corrupted file would be treated as "no config", silently
 * ungating the commit. Codex caught this in review. The correct policy
 * is "absent = allow fallback; broken = fail closed with reason".
 *
 *   { missing: true }          → file doesn't exist
 *   { data: ... }              → parsed successfully
 *   { error: "reason" }        → exists but unreadable/unparseable; caller
 *                                must fail closed and surface the reason
 */
function readJsonFile(path) {
  if (!existsSync(path)) return { missing: true };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    return { error: `${path}: ${err?.message || String(err)}` };
  }
  // Reject non-object JSON (arrays, numbers, strings, null) — these parse
  // cleanly but spread to `{}`, which would silently degrade to "no config"
  // and reintroduce the fail-open class of bug. A config file accidentally
  // saved as `null` or `[]` should fail closed, not silently disappear.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: `${path}: expected a JSON object at the top level, got ${Array.isArray(parsed) ? 'array' : typeof parsed}` };
  }
  return { data: parsed };
}

/**
 * Normalize a merged config to reject concrete shapes that neuter the gate
 * without obviously being malformed. Scoped intentionally — this is not a
 * full schema validator, just two guardrails for the exploits Codex named:
 *
 *   - `pathExempt: [""]` / `reviewExempt: [""]` match every file via
 *     `file.includes("")` → empty strings filtered out
 *   - `gateMaxAgeMinutes: "foo"` coerces to NaN → Number coercion, fall
 *     back to 30 (matching the default already used in checkEvidence)
 *
 * A full validator belongs in the "hook hardening" followup session along
 * with the other three scribe/gate bugs already on the TODO.
 */
function normalizeConfig(config) {
  const out = { ...config };
  if (Array.isArray(out.pathExempt)) {
    out.pathExempt = out.pathExempt.filter((p) => typeof p === 'string' && p.length > 0);
  }
  if (Array.isArray(out.reviewExempt)) {
    out.reviewExempt = out.reviewExempt.filter((p) => typeof p === 'string' && p.length > 0);
  }
  if (out.gateMaxAgeMinutes != null) {
    const n = Number(out.gateMaxAgeMinutes);
    // Use `>= 0` (not `> 0`) to match validateForCommit's contract in
    // review-evidence.mjs — `0` is a legitimate "expire immediately"
    // debug/strict mode and must round-trip through normalization.
    // Fall back to the shared default on NaN/negative/Infinity.
    out.gateMaxAgeMinutes = Number.isFinite(n) && n >= 0 ? n : DEFAULT_GATE_MAX_AGE_MINUTES;
  }
  return out;
}

/**
 * Load the pre-commit-config, merging user-wide defaults with project overrides.
 *
 * Lookup order:
 *   1. Project config at `{directory}/.guya/pre-commit-config.json`
 *   2. User-wide default at `~/.claude/guya/pre-commit-config.json` (or the
 *      path passed in `userConfigPath` — dependency injection for tests)
 *
 * Merge strategy: shallow — project top-level keys completely override
 * user-level keys. Nested objects (complexity, smallChange, testRequired,
 * cleanup) are single-concept blocks; overriding one fully is the expected
 * per-project customization unit.
 *
 * Return shape:
 *   { config: {...}, error: null } — usable merged config (possibly fallback-only)
 *   { config: null,  error: null } — both files absent, caller may fail open
 *   { config: null,  error: "reason" } — at least one file exists but is
 *                                        unreadable/unparseable; caller
 *                                        MUST fail closed with reason
 */
function loadConfig(directory, userConfigPath = USER_CONFIG_PATH) {
  const projectPath = join(directory, '.guya', 'pre-commit-config.json');
  const p = readJsonFile(projectPath);
  const u = readJsonFile(userConfigPath);

  // Fail closed if either file exists but is broken — don't silently drop
  // to fallback, that's exactly the class of bug this PR is fixing.
  if (p.error) return { config: null, error: p.error };
  if (u.error) return { config: null, error: u.error };

  if (p.missing && u.missing) return { config: null, error: null };

  // Shallow merge — project wins — then normalize to strip obviously
  // gate-breaking values that are valid JSON but unsafe.
  const merged = { ...(u.data || {}), ...(p.data || {}) };
  return { config: normalizeConfig(merged), error: null };
}

// --- Job 1: Evidence recording ---
//
// Evidence storage is owned by review-evidence.mjs — see that module for
// the schema, atomicity guarantees, and the full "what counts as reviewed"
// spec. This file only wires user-facing skill detection into the module's
// appendStep API.

const REVIEW_SKILLS = ['guya-review', 'deep-review'];

function isReviewSkill(toolName, toolInput) {
  if (toolName !== 'Skill' && toolName !== 'skill') return false;
  const skill = typeof toolInput === 'string' ? toolInput : (toolInput?.skill || toolInput?.name || '');
  return REVIEW_SKILLS.some(s => skill.includes(s));
}

function getSkillStep(toolInput) {
  const skill = typeof toolInput === 'string' ? toolInput : (toolInput?.skill || toolInput?.name || '');
  if (skill.includes('deep-review')) return 'followup';
  return 'initial';
}

function recordReviewStep(directory, step) {
  try {
    appendStep(directory, step);
    process.stderr.write(`[guya-gate] Recorded review evidence: ${step}\n`);
  } catch (err) {
    // Fail LOUD but don't block the skill — the reviewer is mid-skill,
    // throwing here would stall their workflow. Surface to stderr so the
    // problem is visible, and let the commit-time check block if the
    // evidence never actually landed.
    process.stderr.write(`[guya-gate] Failed to record review evidence: ${err?.message || err}\n`);
  }
}

// --- Job 2 & 3: Commit gating ---
// isGitCommit lives in hook-utils.mjs — shared with post-commit-scribe to
// prevent drift and to fix the substring-match-in-echo-payloads bug.

// Shell-aware tokenizer for git add argument strings. Handles double-quoted,
// single-quoted, and unquoted paths. Exported for unit testing.
// Input: raw arg string after `git add` (e.g. '"file with spaces.js" normal.js')
// Output: array of filename strings with flags filtered out
function parseAddArgs(argStr) {
  const tokens = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let m;
  while ((m = re.exec(argStr)) !== null) {
    const token = (m[1] ?? m[2] ?? m[3]).trim();
    // Normalize `./relative` → `relative` so paths match git's output format
    // (git diff --name-only never emits a ./ prefix; typed args might).
    const normalized = token.replace(/^\.\//, '');
    if (!normalized.startsWith('-') && normalized.length > 0) tokens.push(normalized);
  }
  return tokens;
}

function hasNoVerify(toolInput) {
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /--no-verify/.test(cmd);
}

function getStagedFiles(directory, toolInput) {
  // Get currently staged files
  const staged = new Set();
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    out.trim().split('\n').filter(Boolean).forEach(f => staged.add(f));
  } catch {
    process.stderr.write('[guya-gate] git diff --cached failed, staged set may be incomplete\n');
  }

  // Also parse git add files from combined commands (TOCTOU mitigation).
  // Use matchAll to capture every `git add` segment — a single command can
  // have multiple: `git add a.py && git add b.py && git commit`.
  // Truncate at `git commit` first: anything after it is a commit message
  // argument, not shell commands. Without this, "git add" mentions inside
  // a heredoc message body are parsed as file paths (ghost staged files).
  const rawCmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  const cmd = rawCmd.split(/\bgit\s+commit\b/)[0];
  for (const m of cmd.matchAll(/\bgit\s+add\s+(.+?)(?:\s*&&|\s*;|\s*\||\s*$)/g)) {
    parseAddArgs(m[1]).forEach(f => staged.add(f));
  }

  return [...staged];
}

function isExempt(file, config) {
  // Check path exemptions
  for (const p of config.pathExempt || []) {
    if (file.includes(p)) return true;
  }
  // Check extension exemptions
  const ext = extname(file);
  for (const pattern of config.reviewExempt || []) {
    const patExt = pattern.replace(/\*/g, '');
    if (ext === patExt) return true;
  }
  return false;
}

function isSmallChange(nonExempt, config, directory) {
  // Use nullish coalescing so `smallChange: {}` doesn't silently drop maxLines.
  const maxLines = config.smallChange?.maxLines ?? 10;
  const nonExemptSet = new Set(nonExempt);

  if (nonExempt.length === 0) return true;

  try {
    const numstat = execSync('git diff --cached --numstat', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    // TOCTOU: combined `git add && git commit` fires the hook before anything
    // is staged. numstat returns empty while getStagedFiles found files via the
    // git-add arg parse. Can't verify size → require review (fail closed).
    const numstatLines = numstat.trim().split('\n').filter(Boolean);
    if (numstatLines.length === 0) return false;
    // Each line: "added\tremoved\tfile" — sum added + removed for non-exempt
    // files only. Exempt files (config/docs/etc.) can have large diffs without
    // requiring review; counting them inflates the threshold unfairly.
    let totalLines = 0;
    for (const line of numstatLines) {
      const [added, removed, file] = line.split('\t');
      if (file && !nonExemptSet.has(file)) continue;
      const a = parseInt(added, 10);
      const r = parseInt(removed, 10);
      if (!isNaN(a)) totalLines += a;
      if (!isNaN(r)) totalLines += r;
    }
    return totalLines <= maxLines;
  } catch {
    return false;
  }
}

// checkEvidence moved to review-evidence.mjs as validateForCommit —
// see that module for the full failure-mode matrix including the new
// content-identity check via git write-tree and the delta tolerance
// for small post-review fixes.

function formatReviewPrompt(stagedFiles, config) {
  // Pull the default from the review-evidence module rather than
  // re-hardcoding 30 here. Single source of truth prevents the message
  // from going stale when the default changes (as it did in b5b17dc).
  // Mirror normalizeConfig's condition exactly — `>= 0` not `> 0` so that
  // gateMaxAgeMinutes=0 (legitimate "expire immediately" debug mode) shows
  // the correct value instead of falling back to the default.
  const n = Number(config?.gateMaxAgeMinutes);
  const maxAgeMinutes = Number.isFinite(n) && n >= 0 ? n : DEFAULT_GATE_MAX_AGE_MINUTES;
  return `Review required for ${stagedFiles.length} non-exempt files. Follow this process:

1. Run /guya-review on the staged files
2. Fix any issues found
3. Run /guya-deep-review on the staged files
4. Fix any issues found
5. Retry the commit

The hook records evidence automatically when you run these skills.
Review expires after ${maxAgeMinutes} minutes.

Staged files: ${stagedFiles.join(', ')}`;
}

// --- Main ---

async function main() {
  let input = {};
  try {
    const stdinData = await readStdin(4000);
    try { input = JSON.parse(stdinData); } catch {
      process.stderr.write('[guya-gate] Failed to parse stdin — failing open\n');
      return output({ continue: true, suppressOutput: true });
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = resolveProjectRoot(input.cwd || input.directory || process.cwd());

    // Pre-refactor evidence file lived at `.guya/evolution/review-evidence.json`.
    // Delete it on sight so there's only one authoritative file and nobody
    // mistakes the stale JSON for live state during debugging. Safe no-op
    // after the first run.
    deleteOldEvidenceFile(directory);

    // Job 1: Record evidence for review skills
    if (isReviewSkill(toolName, toolInput)) {
      recordReviewStep(directory, getSkillStep(toolInput));
      return output({ continue: true, suppressOutput: true });
    }

    // Only gate git commits from here
    if (!isGitCommit(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    // Job 2: Block --no-verify
    if (hasNoVerify(toolInput)) {
      return output({ decision: 'block', reason: 'Cannot skip git hooks. Remove --no-verify.' });
    }

    // Job 3: Review gate
    const { config, error: configError } = loadConfig(directory);
    if (configError) {
      // File exists but is broken — fail CLOSED. Silent fallback here
      // would reintroduce the exact fail-open bug this PR fixes.
      process.stderr.write(`[guya-gate] Blocking commit due to unreadable config: ${configError}\n`);
      return output({
        decision: 'block',
        reason: `Pre-commit config is unreadable: ${configError}. Fix or delete the file, then retry.`,
      });
    }
    if (!config) {
      // Both project and user-wide config absent — nothing to gate against.
      // This is the only path that still fails open, matching pre-PR behavior
      // for projects that opted out entirely.
      return output({ continue: true, suppressOutput: true });
    }

    const stagedFiles = getStagedFiles(directory, toolInput);
    if (stagedFiles.length === 0) {
      return output({ continue: true, suppressOutput: true });
    }

    // Check if all files are exempt
    const nonExempt = stagedFiles.filter(f => !isExempt(f, config));
    if (nonExempt.length === 0) {
      process.stderr.write(`[guya-gate] All ${stagedFiles.length} files exempt, skipping review\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Check if small change
    if (isSmallChange(nonExempt, config, directory)) {
      process.stderr.write(`[guya-gate] Small change (${nonExempt.length} files), skipping review\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Surface corrupt-line warnings BEFORE running validation. readEvidence
    // tolerates partial/interrupted appends (skips bad lines and keeps the
    // valid ones), but the caller needs visibility — otherwise a silent
    // partial read masks file system or producer bugs. This only reads
    // the file a second time when there's actually something to warn about
    // (validateForCommit itself reads once internally).
    const rawEvidence = readEvidence(directory);
    if (rawEvidence.errors && rawEvidence.errors.length > 0) {
      const detail = rawEvidence.errors
        .map((e) => `line ${e.line}: ${e.reason}`)
        .join('; ');
      process.stderr.write(
        `[guya-gate] warning: ${rawEvidence.errors.length} corrupt evidence line(s) ignored (${detail})\n`,
      );
    }

    // Check evidence via the review-evidence module. validateForCommit
    // runs the full spec matrix: step presence, order, staleness, tree
    // SHA identity, and delta tolerance (same threshold as isSmallChange).
    const evidence = validateForCommit(directory, config);
    if (evidence.valid) {
      if (evidence.note) {
        process.stderr.write(`[guya-gate] ${evidence.note}\n`);
      }
      process.stderr.write(`[guya-gate] Review evidence valid, allowing commit\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Block with review instructions
    output({ decision: 'block', reason: `${evidence.reason}\n\n${formatReviewPrompt(nonExempt, config)}` });
  } catch (err) {
    process.stderr.write(`[guya-gate] ERROR: ${err?.message || err}\n${err?.stack || ''}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

// Only run main() when executed as a script (not when imported by tests).
// Matches the pattern in guya-session-end.mjs / guya-correction-detect.mjs —
// lets loadConfig be unit-tested in isolation.
const isMain = (() => {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; }
  catch { return false; }
})();

if (isMain) {
  main();
}

// Exports for testing — loadConfig is the primary unit under test;
// USER_CONFIG_PATH is exported so tests can point it at a tmp fixture.
export { loadConfig, USER_CONFIG_PATH, parseAddArgs };
