# guya — Status

> Last updated: 2026-04-09

## Current Focus
**Review-evidence module refactor — bug #2 (contentHash dead/broken) and bug #3 (recordEvidence lost-update race) retired in a single extraction.** The pre-commit review gate's evidence handling was a thicket of accreted concerns in one file: dead content-hash code, a filename-only hash that would've been useless even if checked, and an unlocked read-modify-write on shared state. Rather than patch each in place, extracted everything to a typed `review-evidence.mjs` module with a pinned spec, atomic append, and content-identity fingerprinting via `git write-tree`.

**What "reviewed" now means (spec pinned in code at top of module)**: a commit is reviewed iff (1) both `/karpathy-review` and `/review-followup` ran in the gate window, (2) followup is after initial, AND (3) the current staged tree SHA either exactly matches the tree SHA captured at the last followup OR differs by ≤ `smallChange.maxLines` (same threshold as `isSmallChange`, no new knob). Tree SHA comes from `git write-tree`, which is git's own canonical identity of the staged state — the exact thing `git commit` uses internally.

**Why this kills three bugs at once**:
1. **Dead `contentHash`** → replaced with `validateForCommit` that actually compares the fingerprint at commit time.
2. **Filename-only hash** → replaced with `git write-tree` (content-recursive, byte-perfect identity).
3. **Lost-update race** → replaced with append-only JSONL + `appendFileSync` (POSIX `O_APPEND`, atomic writes for lines under the filesystem-block bound, tested via forked concurrent subprocesses).

**Architecture**:
- `review-evidence.mjs` (new, ~540 LOC) — schema, `readEvidence`/`appendStep`/`validateForCommit`/`deleteOldEvidenceFile`, DI seams for `now` and `gitCmd`, PIPE_BUF invariant assertion
- `guya-pre-commit-review.mjs` (shrank from 421 → 388 LOC) — deleted `recordEvidence`, `checkEvidence`, dead `contentHash` code, `getStateDir`; now a thin orchestrator around the module
- `guya-post-commit-scribe.mjs` (small change) — wipes `review-evidence.jsonl` (new) AND sweeps the legacy `review-evidence.json` file on HEAD advance
- Filename changed: `review-evidence.json` → `review-evidence.jsonl`. Legacy file is deleted on sight by both the gate and the scribe. One authoritative file, no dual-state confusion.

**Review cycle found real bugs**:
- **karpathy-review** (first pass): flagged magic-number drift — `DEFAULT_GATE_MAX_AGE_MINUTES` was private to the module but the hook re-hardcoded `30` in `formatReviewPrompt`. Exactly the class of bug I just shipped a fix for (the "10 minutes" stale message). Fixed: export the constant, single source of truth. Also flagged missing observability for corrupt jsonl lines — readEvidence collects errors but the caller never surfaced them. Fixed: main() logs corrupt-line warnings to stderr.
- **review-followup** (second pass): flagged `gateMaxAgeMinutes: 0` silently clamped to 30 by `> 0` check (can't express "expire immediately" strict mode). Fixed: changed to `>= 0`. Also flagged PIPE_BUF invariant was implicit/untested. Fixed: added runtime assertion in `appendStep` + test pins. Added test for `findLast`-by-position semantics to lock in the file-order-vs-timestamp-order assumption against future refactors.
- **Codex independent review** (third pass): caught a **contract drift I introduced an hour earlier** — `validateForCommit` now accepts `>= 0` but the hook's `normalizeConfig` still clamped to `> 0`, so the new behavior was unreachable through the real hook path. Fixed. Also flagged two pre-existing issues deferred to separate TODOs (see below).

**Tests: 160/160 green** (up from 86 at session start): 50 review-evidence unit tests including concurrent-append race, 16 pre-commit-review E2E tests (spawn real hook subprocess + real git fixtures), 2 new scribe integration tests, 6 added during the review cycle. Manual 8-step walkthrough in a scratch repo confirmed every failure mode behaves as specified. Plugin cache synced.

**The meta-lesson**: three sequential review passes (karpathy → followup → codex) each caught things the previous missed, and Codex caught something the self-reviews couldn't — a drift I introduced DURING the review cycle itself. Self-review blindness is real even when you're specifically looking for a bug class. The review discipline is load-bearing.

## This Session — What Changed and Why

**Started as**: Next HIGH TODO after classifier batching. Three candidates — cache drift (still design-decision, not execution-ready), pre-filter allowlist drift (scoped, same class of bug as the traceId/id contract we just fixed), orphan `tool_call` traces (investigation, not fix). Chose allowlist drift: scoped, high-leverage (silently dropping ~8 traces per batch), and fixing it retires a whole class of bug.

**Root cause**: `guya-session-end.mjs` `hasLearningSignal` hardcoded `['correction','preference','reflection']` as the always-classify set. `guya-correction-detect.mjs` PATTERNS emits 5 feedback types: `correction`, `confirmation`, `preference`, `decision`, `pushback`. Three types (`confirmation`, `decision`, `pushback`) silently fell through to `return false`. Same producer-consumer schema drift class as this morning's `traceId`/`id` contract bug — which is exactly why the right fix is structural, not an allowlist expansion.

**Fix strategy — centralize over patch**: Decided against the simpler allowlist expansion because it just resets the drift timer. Instead:
1. Single source of truth: `FEEDBACK_TRACE_TYPES` (frozen array) + `FEEDBACK_TRACE_TYPE_SET` in `hook-utils.mjs`.
2. Producer-side runtime guard: correction-detect throws at module load if PATTERNS emits an unregistered type. Primary defense — fails fast, never reaches production silently.
3. Consumer-side import: `hasLearningSignal` moved to `hook-utils.mjs` (no longer in session-end.mjs) and uses the Set. Pure function, no Anthropic SDK dependency in the test path — Codex's MED #3 fix.
4. Contract test (`trace-schema.test.mjs`): 12 tests. Static PATTERNS → schema, schema → PATTERNS reverse (dead enum entries), `hasLearningSignal` acceptance sweep, `detectCorrection` emit sweep (crucial — this covers escape-hatch paths like `INSTEAD_OF_PATTERN` that bypass PATTERNS entirely), null-guard boundary, behavior preservation for non-feedback paths.

**Review cycle — this is where the real learning happened**:

- `/cr` (Claude + Karpathy + Codex synthesis):
  - **Karpathy** flagged 4 items, I **disagreed with 3** as scope creep (pre-existing duplicate code in readStdin, pre-existing hasLearningSignal scope conflation, isMain gate duplication). Agreed with 0. The one I agreed on (removing unused `detectCorrection` export) I later reverted because Codex caught why it was needed.
  - **Codex** caught 2 HIGH bugs I missed plus 1 MED I agreed with:
    - **HIGH #1 (INSTEAD_OF escape hatch)**: `detectCorrection` has a return path (`INSTEAD_OF_PATTERN` on line 50) that emits `'correction'` outside the PATTERNS loop. My contract test only scanned PATTERNS, so a future escape-hatch with a new type would evade it. Same bug-class I was trying to prevent, reappearing in the prevention code itself. **Fix**: hoisted `INSTEAD_OF_TYPE` const, added it to the runtime guard, and added a `detectCorrection` emit-sweep test that probes every known emit path and asserts all outputs are in the set.
    - **HIGH #2 (runtime enforcement)**: Test-time drift detection is weaker than runtime drift detection. Someone editing a hook without running tests would silently ship broken code. **Fix**: added module-load assertion in correction-detect — throws immediately on drift, making the test a secondary safety net rather than the primary defense.
    - **MED #3 (test coupling)**: Contract test imported `hasLearningSignal` from session-end.mjs, which dragged in the entire Anthropic SDK as a transitive dep just to test a pure function. **Fix**: moved `hasLearningSignal` to `hook-utils.mjs` (where it always belonged — it's a pure function with no session-end dependencies).

- `/review-followup` (deeper categorical review):
  - Found 2 LOW items worth fixing:
    - PATTERNS was exported mutable (asymmetry with the frozen FEEDBACK_TRACE_TYPES on the other side of the contract). **Fix**: `Object.freeze(PATTERNS)`.
    - `hasLearningSignal` didn't guard against null/undefined input — safe in current call sites (`preFilterTraces` only passes real traces) but since it's now shared code importable from new sites, widening the call surface widens the input risk surface. **Fix**: added `if (!trace || typeof trace !== 'object') return false;` + test case.

**The key growth moment this session**: I presented my first pass to the user as "done" with confidence. Codex immediately found a HIGH bug (INSTEAD_OF escape hatch) in the exact code meant to prevent that bug class. Reminder that independent review catches what self-review misses — even when you're specifically hunting for a known pattern. Karpathy caught style issues but missed the semantic hole that Codex caught. Different reviewers catch different layers.

**Tests**: 30/30 green (19 existing classify-traces/persist-classifications + 12 new trace-schema + 1 follow-up null-guard). `detectCorrection` sweep confirmed every pattern class (5 distinct types) is actually emitted by at least one probe. 
**Files changed**:
- `guya-plugin/hooks/hook-utils.mjs` — added `FEEDBACK_TRACE_TYPES`, `FEEDBACK_TRACE_TYPE_SET`, `hasLearningSignal` (moved from session-end.mjs)
- `guya-plugin/hooks/guya-session-end.mjs` — deleted local `hasLearningSignal`, imported from hook-utils, removed from test exports
- `guya-plugin/hooks/guya-correction-detect.mjs` — frozen PATTERNS, hoisted `INSTEAD_OF_TYPE`, runtime drift guard, `isMain` gate for test isolation, exports PATTERNS + detectCorrection
- `guya-plugin/hooks/__tests__/trace-schema.test.mjs` — NEW, 12 tests
- `STATUS.md` — session narrative, TODO cleanup
- Plugin cache synced (hook-utils.mjs, guya-session-end.mjs, guya-correction-detect.mjs)

**Known latent bugs**:
1. 4,036 orphan `tool_call` traces from an unknown producer — investigate origin. MED.
2. **NEWLY SPOTTED**: `hasLearningSignal` tool-name parser expects `content: "Tool: X"` format (e.g., `"Tool: Edit"`), but `trace-capture.mjs` writes `content: "Edit: foo.js"`. After `.replace('Tool: ', '')` the content is still `"edit: foo.js"` which doesn't exact-match `['write','edit','notebookedit']`. file_edit traces may fall through to `return false`. Needs trace-level verification before fixing. LOW.
3. `~/.claude/guya/.env` ANTHROPIC_API_KEY may still be corrupted (U+2248 trailing byte). LOW — manual fix.
4. Pre-existing: `guya-session-end.mjs` has its own `readStdinWithTimeout` duplicating `hook-utils.mjs:readStdin`. Same for `isMain` gate pattern in both session-end and correction-detect. Both valid DRY follow-ups, flagged by Karpathy, deferred as scope creep for this PR.

## Recent Changes
- [2026-04-10] `pending` — fix: auto-sync plugin cache on commit via post-commit hook
- [2026-04-09] `5cce60f` — refactor: extract review-evidence module with content-identity fingerprint
- [2026-04-09] `abaf6f0` — fix: drive scribe gate-reset from HEAD marker, harden isGitCommit
- [2026-04-09] `e1e067d` — docs: update STATUS.md session narrative for classifier batching fix
- [2026-04-09] `b5b17dc` — chore: bump pre-commit review gate window from 10 to 30 minutes
- [2026-04-09] `a78b8f5` — fix: chunk Haiku classification calls to unblock backlog burndown — plus cross-chunk id safety and PLUGIN_ROOT fallback
- [2026-04-09] `2e362bf` — fix: repair evolution pipeline traceId/id contract — classifications now merge
- [2026-04-09] `932595d` — refactor: remove decision-gate hook, keep harness marker for other hooks
- [2026-04-08] `6e49e29` — fix: harden hooks — extract shared stdin util, fix evidence ordering, improve observability
- [2026-04-08] `32b424c` — fix: correct skills path in plugin.json to match omc convention
- [2026-04-08] `a508ff8` — fix: register 4 decision harness skills in plugin marketplace discovery
- [2026-04-08] `ec2169c` — feat: implement decision harness system with 4 interactive skills
- [2026-04-08] `28c6181` — fix: tighten review gate — remove hooks/ exemption, lower small change to 10 lines
- [2026-04-08] `ef1bc6f` — feat: implement two-layer commit validation with automatic evidence tracking
- [2026-04-08] `be794f4` — feat: add Obsidian vault sync to session-end hook and new sync skill
- [2026-04-08] `9ec809f` — feat: enforce two-pass review in pre-commit gate
- [2026-04-08] `dad8416` — fix: require review report proof in pre-commit gate

## In Progress
- [ ] Comprehensive logging system for guya plugin hooks — original ask from 2026-04-08 late night, never scoped, still outstanding
- [ ] Evolution pipeline — first real classify→synthesize cycle pending (needs correction data from sessions)
- [ ] Claude code guide — living doc, update as new patterns discovered

## TODO
- [x] **[FIXED 2026-04-09] Post-commit scribe wipes evidence on blocked/failed commits** (the stop-the-bleeding bug). `appendCommit` now returns boolean; `main()` skips reset when dedup fires. Dedup is the signal that HEAD didn't advance to a new commit.
- [x] **[FIXED 2026-04-09] `isGitCommit` regex matches substrings in `echo` payloads**. Helper extracted to `hook-utils.mjs`, now strips single- and double-quoted substrings before the regex test. Shared by pre-commit-gate and post-commit-scribe.
- [x] **[FIXED 2026-04-09] `contentHash` recorded but never validated** — Retired via the `review-evidence.mjs` extraction. The fix replaced the filename-only `contentHash` with a `git write-tree` content-identity fingerprint and wired it into `validateForCommit`. Tree SHA at commit time is compared to tree SHA at last followup; mismatch blocks unless the delta is under `smallChange.maxLines`. Detail in Current Focus.
- [x] **[FIXED 2026-04-09] `recordEvidence` lost-update race across concurrent sessions** — Retired in the same extraction. Evidence is now an append-only JSONL file written with `appendFileSync` (POSIX `O_APPEND`). Each line is ~100 bytes, well under the atomic-append bound. Concurrent-append race test (forked subprocesses) pins the fix.
- [ ] **[HIGH — new, Codex catch 2026-04-09] `getStagedFiles` combined-command parser is bypassable for quoted paths.** `guya-pre-commit-review.mjs:~204` uses `split(/\s+/)` to tokenize filenames out of combined `git add ... && git commit` commands (the PreToolUse TOCTOU mitigation). Quoted paths like `git add "big feature.js" && git commit -m x` split into `['"big', 'feature.js"']`, neither of which is a real file. `git diff --cached` is empty (nothing staged yet because PreToolUse fires first), so `isSmallChange` sees 0 lines and returns true → bypass. Deterministic gate bypass via a one-line shell command. Needs its own session — fix options: (A) block any combined `git add ... && git commit`, (B) only allow `git add -- <path>` form, (C) give up on TOCTOU mitigation and rely on PostToolUse verification. Leans toward A or C.
- [ ] **[MED — new, Codex catch 2026-04-09] Unknown schema versions silently dropped by `parseLine`.** `review-evidence.mjs` rejects any entry with `v !== SCHEMA_VERSION` as a "corrupt line" and adds it to the errors array. Warned but not fatal. If a future schema bump introduces `v: 2` entries, the validator would silently ignore them while older `v: 1` entries remain usable — a fail-open against schema evolution (stale evidence accepted). Fix: fail closed on any unknown `v`, or at minimum fail if the latest-by-position entry is an unknown version. Low urgency because today there is no `v: 2`, but pin before the next schema bump.
- [ ] **[HIGH] cwd-based phantom `.guya/` state dirs** — don't cause the burn-the-evidence loop but are real. When I `cd guya-plugin && ...` earlier, subsequent hook fires received `cwd=guya-plugin` and created phantom `.guya/` state dirs there. Not just a session footgun — the pre-refactor trace-capture created 43 phantom traces in `guya-plugin/.guya/` on 2026-03-31 that sat there until I found them today. Fix: resolve `directory` to git repo root via `git rev-parse --show-toplevel`, with fallback to raw cwd for non-repo scenarios.
- [x] **[FIXED 2026-04-10] Fix plugin cache drift systemically** — Added `scripts/sync-plugin.sh` (rsync source → cache, excludes `__tests__/`, `.guya/`, `.omc/`, `node_modules/`) and `.git/hooks/post-commit` that calls it automatically. Every commit now syncs; if Claude Code reinstalls the plugin, next commit self-heals without manual intervention. Manual sync available mid-session: `bash scripts/sync-plugin.sh`.
- [x] **[RESOLVED 2026-04-09] 4,036 orphan `tool_call` traces — root cause: pre-refactor `trace-capture.mjs` from 2026-03-31 Guya bootstrap.** Investigation spawned from today's phantom-state investigation in `guya-plugin/.guya/` (phantom dir that Claude Code's cwd-based hook dispatch had silently created when working inside the plugin subdir). Found 43 phantom traces there, all `type: 'tool_call'`, `content: 'Tool: unknown'`, timestamped 2026-03-31. All 43 IDs verified as duplicates of traces in `~/.claude/guya/traces/2026-03-31.jsonl` (712 traces on that day alone, most with the same legacy shape). Pre-refactor `trace-capture.mjs` wrote this generic format before the current version switched to `type: 'file_edit'` + `content: 'Tool: {toolName}'`. No action needed — historical artifact, not a live producer. Phantom `guya-plugin/.guya/` dir + `guya-plugin/STATUS.md` deleted.
- [ ] **[LOW — spotted during allowlist drift fix] `hasLearningSignal` tool-name parser doesn't match `file_edit` trace content format.** `trace-capture.mjs:113` writes `content: "Edit: app.py"` but `hasLearningSignal` does `(trace.content || '').replace('Tool: ', '').toLowerCase()` then does an exact match against `['write','edit','notebookedit']`. After replace, the content is still `"edit: app.py"` which ≠ `'edit'`. file_edit traces fall through to the default `return false`. Needs verification against real traces (test with a sample) before fixing. If confirmed, fix is either: parse `content` up to the first `:`, or change trace-capture to write `"Tool: Edit"` format like `tool_call` traces.
- [ ] **[LOW — DRY follow-up, flagged by Karpathy review but deferred]** Extract `isMain` gate pattern into `hook-utils.mjs` — currently duplicated in `guya-session-end.mjs` and `guya-correction-detect.mjs`. Also extract `readStdinWithTimeout` in `guya-session-end.mjs:42` — duplicates `hook-utils.mjs:readStdin`. Both require touching multiple files, so deferred from the allowlist drift PR to avoid scope creep.
- [ ] **[MED] `hasLearningSignal` reads fields no producer writes.** `trace.context` and `trace.toolOutput` — neither is written by any known trace producer. Dead code paths in the filter. Either remove them or start writing the fields.
- [ ] **[LOW] `~/.claude/guya/.env` may still have corrupted ANTHROPIC_API_KEY.** Hex-confirmed a trailing Unicode `≈` (U+2248, 0xe28988) on the key today. Daniel provided a clean replacement at `Desktop/guya/.env` but the home-dir copy may still need manual fix. Verify: `grep ANTHROPIC_API_KEY ~/.claude/guya/.env | tail -c 20 | xxd`
- [ ] Follow-up commit: apply review findings from 2026-04-08 karpathy-review pass — add `console.error` logging to silent catches in `hook-utils.mjs:36,40`, `intent-detect.mjs:91`, `correction-detect.mjs:101`; consolidate the 3 remaining duplicate `readStdin` implementations to use the shared `hook-utils.mjs` version
- [ ] Clean up stray `# test` heading at `guya-plugin/CLAUDE.md:46`
- [ ] Decide fate of line 52 in `~/.claude/guya/traces/2026-04-09.jsonl` — "I have noticed while working on SDF" preference, borderline real signal
- [ ] Growth tracker milestone #2: read and critique someone else's code
- [ ] Growth tracker milestone #5: review code Guya writes — pick one function per session

## Decisions & Notes
- [2026-04-09] **Evolution pipeline contract bug — fix scope and backfill decision.** Two coupled contract violations (producer-consumer `id`/`traceId` mismatch + unspecified observer output schema) fixed together in one commit because fixing only the consumer would code against a moving target. Added a runtime assertion in `persistClassifications` that throws if `classificationResults.length > 0 && mergedCount === 0` — future drift fires loudly instead of silently no-op'ing. Backfill: option 1 (self-heal, no script) because only 20 of 4,311 backlog traces pass the pre-filter — next session-end handles it in one Haiku call at ~$0.008. Rejected: (a) logging-as-prevention — logging detects, assertions + tests prevent; logging TODO stays separate; (b) extracting `persistClassifications` into a new module — function was already top-level, a single `export` line + `isMain` guard was sufficient for test isolation, no need to restructure. Also rejected: touching the three latent bugs this investigation surfaced (pre-filter allowlist drift, orphan `tool_call` traces, dead `hasLearningSignal` fields). Each belongs in its own decision session.
- [2026-04-09] **Decision-gate hook removed.** Triggering data: Daniel typed "fxi" (intentional typo to test) during normal workflow and the hook still blocked. Rationale: regex pattern matching can't distinguish real "implement X" intent from quick fixes, clarifying questions, or typos — every session finds a new false positive and tightening the regex is whack-a-mole. The hook was trying to enforce discipline externally when the real discipline comes from Daniel choosing when to invoke `/feature` etc. Friction-to-benefit ratio was bad. Skills still exist and work; they're now opt-in not opt-out. Kept the harness-marker infrastructure for the other two UserPromptSubmit hooks since suppression during manual harness sessions is still valuable (prevents archival reload spam + fake corrections from domain answers).
- [2026-04-09] Hook suppression marker design: TTL-only (2h) at `.guya/decisions/.harness-active`, NOT session_id-keyed. Chose TTL because skills can't easily obtain current session_id from inside their execution context, and 2h crash-recovery window is acceptable blast radius for the worst case ("previous harness crashed and new session still sees marker for up to 2h"). Simpler skill instructions won over theoretical robustness.
- [2026-04-09] Root cause of harness-blocking bug: `.active-session` marker lifecycle is "written at end, not at start". During Q1–Q10 the marker doesn't exist, so decision-gate had no signal that a harness was running. Classic "whoever wrote this skill never actually ran the full flow" bug. Fix adds a separate `.harness-active` marker with the opposite lifecycle (written at start, removed at end).
- [2026-04-09] Discovered systemic plugin cache drift: commit `6e49e29` (2026-04-08 late-night hardening) introduced `hook-utils.mjs` in source, but the running plugin at `~/.claude/plugins/cache/guya/guya/0.1.0/hooks/` still had the pre-hardening versions. Meaning: last session's hook work never actually executed. Manually synced 9 files this session. Recurring issue — every plugin edit session silently requires manual re-sync. Needs a proper fix (see TODO).
- [2026-04-09] Removed one false-positive correction-detect trace (id `d77ed65a-...`) from today's JSONL: "pushback: are you sure you understand what the issue is?" — Daniel challenging my misdiagnosis of the hook bug, not behavioral feedback to Guya. Kept line 52 (SDF architecture preference) as borderline legitimate signal — left for classifier to decide.
- [2026-04-09] Process note: drifted into scope creep twice this session — first diagnosed the wrong hook (intent-detect then correction-detect) before Daniel corrected me to decision-gate, then piled on cache-drift discovery + marker format redesign mid-edit. Daniel called it out and I re-organized via TaskCreate. Lesson: when fix scope widens, STOP and re-announce the design decision before touching more code.
- [2026-04-08] Removed hooks/ from pathExempt — hook code should be reviewed, not exempt from its own quality system
- [2026-04-08] Tightened small change threshold: maxLines 30→10, removed maxFiles (line count alone is sufficient)
- [2026-04-08] Obsidian vault sync: entity pages only to start (no sub-concepts), wiki synthesis format for growth tracker, semi-auto via SessionEnd hook + manual via /guya-obsidian-sync skill
- [2026-04-08] Centralized all traces to ~/.claude/guya/traces/ — single source of truth across 9 projects (4,052 traces merged)
- [2026-04-08] Pre-commit gate hardened: requires filesHash, timestamp, reviewIssues, fixesApplied, verifiedAt + review-report.json proof
- [2026-04-08] Feedback detection expanded from 3→13 patterns: corrections, confirmations, pushback, preferences, decisions
- [2026-04-08] MAX_FUNC_LINES bumped from 50→80 (50 was too aggressive for orchestrator functions)
