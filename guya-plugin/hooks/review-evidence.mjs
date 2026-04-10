#!/usr/bin/env node

/**
 * review-evidence.mjs — Typed owner for the pre-commit review-evidence file.
 *
 * CALLING SPEC
 * ============
 *
 * Purpose
 * -------
 * Single source of truth for `.guya/evolution/review-evidence.jsonl`.
 * Owns the schema, the reader, the writer, and the commit-time validator
 * used by `guya-pre-commit-review.mjs`. Any disagreement between this file
 * and the spec below is a bug in this file — the spec wins.
 *
 * This module exists because `guya-pre-commit-review.mjs` accreted three
 * coupled concerns (config, evidence, gating) without a schema, producing
 * a family of bugs: dead contentHash code (recorded but never checked),
 * filename-only hash (near-useless even when checked), lost-update race
 * on concurrent writes. Extracting evidence into a typed module with
 * atomic append + content-identity fingerprint kills all three at once.
 *
 * "What counts as reviewed"
 * -------------------------
 * A commit is "reviewed" iff ALL of the following hold at commit time:
 *
 *   1. Both `/guya-review` and `/guya-deep-review` have been run in
 *      the current gate window (age-bounded by gateMaxAgeMinutes, default 30).
 *   2. Followup came after initial (timestamp order).
 *   3. The current staged tree SHA either:
 *      (a) MATCHES the tree SHA captured at the most recent review step, OR
 *      (b) differs by at most `smallChange.maxLines` (same threshold as
 *          the existing small-change exemption — no new knob).
 *
 * Tree SHA = `git write-tree` output. Git's own canonical identity of the
 * current index state: two tree SHAs match iff every staged file is
 * byte-identical (including permissions, filenames, nesting). Git itself
 * uses this to build commits — calling `git commit` runs write-tree
 * internally, so "the tree SHA at review time" is literally "what would
 * be committed if you ran git commit right now."
 *
 * Delta tolerance (rule 3b) shares the existing `smallChange.maxLines`
 * threshold by design: we already trust "≤ N lines of total diff" to ship
 * without review. Extending the same trust to "≤ N lines of delta since
 * review" is internally consistent — no new attack surface, no new knob.
 *
 * Schema
 * ------
 * Evidence is an append-only JSONL file at
 * `{directory}/.guya/evolution/review-evidence.jsonl`. One step per line:
 *
 *   {"v":1,"step":"initial","timestamp":1712345678900,"treeSha":"abc...40hex"}
 *   {"v":1,"step":"followup","timestamp":1712345679900,"treeSha":"def...40hex"}
 *
 * Fields:
 *   v         : schema version, currently 1
 *   step      : "initial" | "followup"
 *   timestamp : ms since epoch (Date.now)
 *   treeSha   : 40-char hex, output of `git write-tree` at the time the
 *               step was recorded, captures the exact staged state that
 *               was reviewed
 *
 * JSONL + append-only is a deliberate choice to kill the lost-update race:
 * each step is a single small line written with O_APPEND. POSIX guarantees
 * write atomicity for sizes under PIPE_BUF (~4KB on macOS/Linux), so two
 * concurrent sessions can append simultaneously without corruption. The
 * reader tolerates partial/corrupt lines (skip + collect errors).
 *
 * API
 * ---
 *   readEvidence(directory) →
 *     { missing: true }                              # file absent
 *     { steps: [...], errors: [...] }                # parsed (errors may be non-empty for corrupt lines)
 *     { error: "reason" }                            # IO error, not ENOENT
 *
 *   appendStep(directory, step, options?) → void
 *     step    : "initial" | "followup"
 *     options : { now?: () => number, gitCmd?: (cmd) => string }
 *               Dependency injection for tests. Defaults are Date.now
 *               and `execSync` against the directory.
 *     Throws on git write-tree failure (fail closed — a missing tree SHA
 *     must never silently be stored as empty).
 *
 *   validateForCommit(directory, config, options?) →
 *     { valid: true }
 *     { valid: false, reason: "human-readable reason, safe to show user" }
 *
 *     Runs the full failure-mode matrix below. Fails closed on every
 *     unexpected condition — there is no silent pass path.
 *
 *   EVIDENCE_FILENAME / OLD_EVIDENCE_FILENAME → exported constants so the
 *   caller hook can delete the legacy `.json` file on sight (Daniel's
 *   decision: prevent future confusion about which file is authoritative).
 *
 * Failure modes (all fail CLOSED with a specific reason)
 * -----------------------------------------------------
 *   - No evidence file                   → "No review evidence found. Run /guya-review."
 *   - Corrupt evidence file (IO error)   → "Evidence file unreadable: <err>"
 *   - Every line corrupt                 → "Evidence file unreadable: no valid entries"
 *   - Missing `initial` step             → "Missing initial review. Run /guya-review first."
 *   - Missing `followup` step            → "Missing followup review. Run /guya-deep-review after fixing issues."
 *   - Followup before initial            → "Followup must come after initial review."
 *   - Stale (age > gateMaxAgeMinutes)    → "Review expired (Xmin ago, max Ymin)."
 *   - Missing treeSha on latest step     → "Evidence file pre-dates content-hash check. Re-run both review steps."
 *   - Tree mismatch, delta > threshold   → "X lines changed since review (max Y). Re-run /guya-deep-review or reduce scope."
 *   - Tree mismatch, delta ≤ threshold   → PASS (logs note, accepts as small post-review fix)
 *   - Tree match                         → PASS
 *
 * Non-goals
 * ---------
 *   - Two concurrent reviewers on different branches of the same repo
 *     (accepted — same trust model as git itself; each branch has its
 *     own staged state anyway)
 *   - Bypass at the existing `isSmallChange` threshold (pre-existing,
 *     same attack surface, not this PR's scope)
 *   - Reviewer colluding with themselves (social engineering, out of scope)
 *   - Pruning old entries from the jsonl (entries are tiny, will be
 *     addressed by the broader "phantom state cleanup" bug if needed)
 *
 * Side effects
 * ------------
 * `git write-tree` writes a small tree object (~100 bytes) to the repo's
 * object database on each review step. These are unreferenced loose
 * objects — harmless, deduplicated, and cleaned up by `git gc` when
 * they age past the default 2-week window.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

// --- constants exported for callers ---

export const SCHEMA_VERSION = 1;
export const EVIDENCE_FILENAME = 'review-evidence.jsonl';
export const OLD_EVIDENCE_FILENAME = 'review-evidence.json';
export const VALID_STEPS = Object.freeze(['initial', 'followup']);

const SHA40_RE = /^[0-9a-f]{40}$/i;

// Exported so the caller hook can interpolate the same default into
// user-facing block messages. Single source of truth — keeps the
// "review expires after X minutes" line in sync with the actual gate
// window if the default ever changes. Historical bug: commit b5b17dc
// bumped the default from 10→30 but the block message stayed at "10".
export const DEFAULT_GATE_MAX_AGE_MINUTES = 30;
export const DEFAULT_MAX_DELTA_LINES = 10;

// --- path helpers ---

/**
 * Absolute path to the new-format evidence file for a given repo root.
 */
export function evidencePath(directory) {
  return join(directory, '.guya', 'evolution', EVIDENCE_FILENAME);
}

/**
 * Absolute path to the pre-refactor JSON evidence file. Exported so the
 * caller hook can delete it on sight, preventing silent dual-file drift.
 */
export function oldEvidencePath(directory) {
  return join(directory, '.guya', 'evolution', OLD_EVIDENCE_FILENAME);
}

// --- internal helpers ---

/**
 * Parse a single JSONL line into a validated step entry. Returns one of:
 *   { valid: true, entry: {v, step, timestamp, treeSha} }
 *   { valid: false, error: "reason" }
 *
 * Strictly validates every field so corrupt-but-parseable lines (e.g. a
 * malformed schema version or missing treeSha) are rejected before they
 * reach validateForCommit, where silent acceptance would create a fail-open.
 */
function parseLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch (err) {
    return { valid: false, error: `invalid JSON: ${err?.message || String(err)}` };
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, error: `expected object, got ${Array.isArray(obj) ? 'array' : typeof obj}` };
  }
  if (obj.v !== SCHEMA_VERSION) {
    return { valid: false, error: `unknown schema version: ${obj.v}` };
  }
  if (!VALID_STEPS.includes(obj.step)) {
    return { valid: false, error: `invalid step: ${obj.step}` };
  }
  if (typeof obj.timestamp !== 'number' || !Number.isFinite(obj.timestamp)) {
    return { valid: false, error: `invalid timestamp: ${obj.timestamp}` };
  }
  if (typeof obj.treeSha !== 'string' || !SHA40_RE.test(obj.treeSha)) {
    return { valid: false, error: `invalid treeSha: ${obj.treeSha}` };
  }
  return {
    valid: true,
    entry: {
      v: obj.v,
      step: obj.step,
      timestamp: obj.timestamp,
      treeSha: obj.treeSha.toLowerCase(),
    },
  };
}

/**
 * Default git command runner — executes `git <args>` synchronously in the
 * given directory. Returns trimmed stdout; throws on non-zero exit.
 * Extracted so tests can inject a fake runner without a real git repo.
 */
function defaultGitCmd(cwd) {
  return (args) =>
    execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString().trim();
}

// --- API ---

/**
 * Read the evidence file and return its parsed state.
 *
 * Return shape (tri-state, matching the config loader pattern):
 *   { missing: true }              → file does not exist (legitimate absence)
 *   { error: "reason" }            → IO failure other than ENOENT
 *   { steps: [...], errors: [...] } → parsed; `errors` lists corrupt lines
 *                                     with 1-based line numbers, tolerated
 *                                     to survive partial appends from
 *                                     interrupted writes
 *
 * A file that exists but has zero valid lines returns
 * `{ steps: [], errors: [...] }` — not `{ missing: true }`. Callers that
 * treat "no usable state" as a block should check `steps.length === 0`
 * explicitly.
 */
export function readEvidence(directory) {
  const path = evidencePath(directory);
  let contents;
  try {
    contents = readFileSync(path, 'utf-8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { missing: true };
    return { error: `${path}: ${err?.message || String(err)}` };
  }

  const lines = contents.split('\n');
  const steps = [];
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length === 0) continue; // trailing newline, blank line
    const parsed = parseLine(raw);
    if (parsed.valid) {
      steps.push(parsed.entry);
    } else {
      errors.push({ line: i + 1, reason: parsed.error });
    }
  }
  return { steps, errors };
}

/**
 * Append a single review step to the evidence file.
 *
 * Captures the current staged tree SHA via `git write-tree` — that's the
 * canonical identity of what's staged right now, the same SHA `git commit`
 * would use for the tree it wraps in the commit object. If we later find
 * this SHA matches the SHA at commit time, we know byte-for-byte that the
 * reviewed content equals the committed content.
 *
 * Atomicity: uses `appendFileSync` (flag 'a' → O_APPEND). POSIX guarantees
 * atomic writes for sizes under PIPE_BUF (≥4KB on macOS/Linux), and a step
 * line is ~100 bytes. Two concurrent sessions can append simultaneously
 * without interleaving. No locking, no lost updates — this is the fix for
 * STATUS.md bug #3 (recordEvidence lost-update race).
 *
 * Fail-closed: throws if git write-tree fails or returns a non-SHA, so
 * the caller can surface the error instead of silently storing an empty
 * treeSha that would create a fail-open path at validation time.
 *
 * Options (all optional, defaulted):
 *   now:    () => number    timestamp fn (default Date.now) — test seam
 *   gitCmd: (args) => string  git runner (default execSync in directory)
 */
export function appendStep(directory, step, options = {}) {
  if (!VALID_STEPS.includes(step)) {
    throw new Error(
      `review-evidence.appendStep: invalid step "${step}", expected one of ${VALID_STEPS.join(', ')}`,
    );
  }

  const now = typeof options.now === 'function' ? options.now : Date.now;
  const gitCmd = typeof options.gitCmd === 'function' ? options.gitCmd : defaultGitCmd(directory);

  let treeSha;
  try {
    treeSha = gitCmd('write-tree');
  } catch (err) {
    throw new Error(`review-evidence.appendStep: git write-tree failed: ${err?.message || String(err)}`);
  }

  if (typeof treeSha !== 'string' || !SHA40_RE.test(treeSha)) {
    throw new Error(`review-evidence.appendStep: git write-tree returned invalid SHA: ${treeSha}`);
  }

  const entry = {
    v: SCHEMA_VERSION,
    step,
    timestamp: now(),
    treeSha: treeSha.toLowerCase(),
  };
  const line = JSON.stringify(entry) + '\n';

  // PIPE_BUF atomicity invariant.
  //
  // The concurrent-append race fix (see the spec comment at top of file)
  // depends on each JSONL line being smaller than PIPE_BUF — the POSIX
  // atomic-write bound. The POSIX minimum is 512 bytes (macOS), Linux is
  // typically 4096. Current lines are ~100 bytes, well under the minimum.
  //
  // This assertion pins the invariant in code. If a future schema addition
  // (e.g., a large `reviewedBy` or `note` field) pushes the line past 512,
  // appends stop being atomic on macOS and the lost-update race reappears
  // silently. Fail loudly here instead, with a clear error that names the
  // invariant so the person hitting it knows exactly what broke.
  if (line.length >= 512) {
    throw new Error(
      `review-evidence.appendStep: serialized line is ${line.length} bytes, `
      + `violating the PIPE_BUF atomic-append invariant (512 bytes). `
      + `Reduce schema footprint or add file locking before bumping this.`,
    );
  }

  const path = evidencePath(directory);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, line);
}

/**
 * Validate whether the current staged state is "reviewed" per the spec.
 *
 * Returns { valid: true } on pass, or { valid: false, reason: "..." } on
 * block. Every non-pass path returns a reason string safe to show the
 * user — no silent false returns, no thrown errors (catches internally).
 *
 * Config inputs used:
 *   config.gateMaxAgeMinutes   (default 30)  — stale-evidence cutoff
 *   config.smallChange.maxLines (default 10) — delta tolerance threshold
 *
 * See the "What counts as reviewed" section at the top of this file for
 * the full rule set this function implements.
 */
export function validateForCommit(directory, config, options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const gitCmd = typeof options.gitCmd === 'function' ? options.gitCmd : defaultGitCmd(directory);
  // Both defaults use `>= 0` (not `> 0`) so callers can set either
  // value to 0 for legitimate debug/strict modes:
  //   gateMaxAgeMinutes: 0 → review expires immediately (block every commit)
  //   smallChange.maxLines: 0 → strict tree match, no delta tolerance
  // Non-numeric / negative inputs still fall back to defaults.
  const maxAgeRaw = Number(config?.gateMaxAgeMinutes);
  const maxAgeMinutes = Number.isFinite(maxAgeRaw) && maxAgeRaw >= 0
    ? maxAgeRaw
    : DEFAULT_GATE_MAX_AGE_MINUTES;
  const maxDeltaRaw = Number(config?.smallChange?.maxLines);
  const maxDeltaLines = Number.isFinite(maxDeltaRaw) && maxDeltaRaw >= 0
    ? maxDeltaRaw
    : DEFAULT_MAX_DELTA_LINES;

  // --- Read + parse ---

  const read = readEvidence(directory);
  if (read.missing) {
    return { valid: false, reason: 'No review evidence found. Run /guya-review.' };
  }
  if (read.error) {
    return { valid: false, reason: `Evidence file unreadable: ${read.error}` };
  }
  if (read.steps.length === 0) {
    return { valid: false, reason: 'Evidence file has no valid entries. Run /guya-review.' };
  }

  // --- Step presence + order ---

  const latestInitial = read.steps.findLast((s) => s.step === 'initial');
  const latestFollowup = read.steps.findLast((s) => s.step === 'followup');

  if (!latestInitial) {
    return { valid: false, reason: 'Missing initial review. Run /guya-review first.' };
  }
  if (!latestFollowup) {
    return {
      valid: false,
      reason: 'Missing followup review. Run /guya-deep-review after fixing issues.',
    };
  }
  if (latestFollowup.timestamp <= latestInitial.timestamp) {
    // Re-running initial after a followup resets the "reviewed" invariant —
    // the followup no longer applies to the post-initial state.
    return {
      valid: false,
      reason: 'Initial review ran after followup. Re-run /guya-deep-review on the current state.',
    };
  }

  // --- Age ---
  //
  // Bound by the initial step timestamp (the earliest required step in the
  // chain). "How long ago did this review cycle start" is the cleaner
  // stale signal than "when was the last refresh." Re-running initial
  // resets the clock because latestInitial advances.
  const age = now() - latestInitial.timestamp;
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  if (age > maxAgeMs) {
    return {
      valid: false,
      reason: `Review expired (${Math.round(age / 60000)}min ago, max ${maxAgeMinutes}min). Re-run /guya-review.`,
    };
  }

  // --- Content identity ---
  //
  // The latest followup's treeSha is "what was reviewed" — the exact
  // staged state at the most recent followup pass. We enforced above
  // that followup.timestamp > initial.timestamp, so latestFollowup is
  // also the most recent step overall.
  const reviewedTreeSha = latestFollowup.treeSha;
  if (!reviewedTreeSha || !SHA40_RE.test(reviewedTreeSha)) {
    // Defense in depth — parseLine already rejects bad treeSha, so this
    // branch should be unreachable unless the schema changes. Fail closed.
    return {
      valid: false,
      reason: 'Evidence file pre-dates content-hash check. Re-run both review steps.',
    };
  }

  let currentTreeSha;
  try {
    currentTreeSha = gitCmd('write-tree');
  } catch (err) {
    return {
      valid: false,
      reason: `Could not compute current tree SHA: ${err?.message || String(err)}`,
    };
  }

  if (typeof currentTreeSha !== 'string' || !SHA40_RE.test(currentTreeSha)) {
    return { valid: false, reason: `git write-tree returned invalid SHA: ${currentTreeSha}` };
  }

  // Happy path: staged state byte-identical to reviewed state.
  if (currentTreeSha.toLowerCase() === reviewedTreeSha.toLowerCase()) {
    return { valid: true };
  }

  // --- Delta tolerance ---
  //
  // Trees differ. Compute how much by asking git to numstat the diff
  // between the two tree objects. Both SHAs exist in the object db by
  // construction (we wrote them via write-tree), so this should only
  // fail under genuinely exceptional conditions (GC'd objects during
  // a very long gate window, disk corruption, etc.) — fail closed.
  let deltaLines = 0;
  try {
    const numstat = gitCmd(`diff ${reviewedTreeSha} ${currentTreeSha} --numstat`);
    for (const ln of numstat.split('\n')) {
      const trimmed = ln.trim();
      if (trimmed.length === 0) continue;
      const [added, removed] = trimmed.split('\t');
      // Binary files show as "-\t-\tfile". We can't count binary changes
      // in "lines", and any binary change is a signal that something
      // material shifted — fail closed rather than guess.
      if (added === '-' || removed === '-') {
        return {
          valid: false,
          reason: 'Binary file changed since review. Re-run /guya-deep-review.',
        };
      }
      const a = parseInt(added, 10);
      const r = parseInt(removed, 10);
      if (Number.isFinite(a)) deltaLines += a;
      if (Number.isFinite(r)) deltaLines += r;
    }
  } catch (err) {
    return {
      valid: false,
      reason: `Could not compute delta since review: ${err?.message || String(err)}. Re-run /guya-deep-review.`,
    };
  }

  if (deltaLines <= maxDeltaLines) {
    // Same trust model as isSmallChange: small enough that the gate is
    // OK skipping re-review. Caller may log the note to stderr for
    // auditability.
    return {
      valid: true,
      note: `Small delta since review: ${deltaLines} lines (≤ ${maxDeltaLines}).`,
    };
  }

  return {
    valid: false,
    reason: `${deltaLines} lines changed since review (max ${maxDeltaLines}). Re-run /guya-deep-review or reduce scope.`,
  };
}

/**
 * Delete the pre-refactor `review-evidence.json` file if present.
 *
 * Returns true if a file was deleted, false if the file didn't exist or
 * could not be removed. Safe to call unconditionally on every hook
 * invocation — no-op when the file is already gone. Exists so the caller
 * hook can clean up old state proactively (Daniel's decision: delete
 * rather than ignore, to prevent confusion about which file is
 * authoritative).
 */
export function deleteOldEvidenceFile(directory) {
  const path = oldEvidencePath(directory);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
