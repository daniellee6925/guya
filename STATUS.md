# guya — Status

> Last updated: 2026-04-09

## Current Focus
Classifier batching bug fixed — evolution pipeline can now burn down backlogs of arbitrary size. `classifyTraces` chunks into `CLASSIFY_CHUNK_SIZE=25` batches, loops Haiku per chunk, tolerates partial chunk failures (log-and-continue), returns partial results on success / null only on total failure. `classifyChunk` filters each chunk's results to input ids to prevent cross-chunk id bleed + dedupes within-chunk. `PLUGIN_ROOT` fallback fixed via `computePluginRoot` pure helper. 11/11 classifier tests green, 7/7 merge regression tests green, e2e verified against real Haiku on the 738-trace backlog (30/30 chunks succeeded, 728/730 merged, $0.44 cost). Next: plugin cache drift (HIGH), pre-filter allowlist drift (HIGH), or switch projects.

## This Session — What Changed and Why

**Started as**: Fix the two HIGH priority bugs from STATUS.md — (1) `traceId`/`id` mismatch in the evolution pipeline, (2) systemic plugin cache drift.

**Scope chosen**: Bug #1 only, scoped tightly. Cache drift is a separate design decision (symlink vs auto-sync vs script) and gets its own conversation. Daniel drove root-cause thinking via explain-before-implement flow (explicit choice to understand the bug before fixing).

**Root cause**: Producer-consumer contract mismatch across two hops. Trace producers (`guya-trace-capture.mjs`, `guya-correction-detect.mjs`) write `{id: randomUUID()}`. Session-end consumer (`persistClassifications`) keyed lookups on `traceId` — a field no producer writes. The ternary guard `trace.traceId ? ... : null` silently short-circuited to null every time. Compounding bug: `guya-observer.md` never specified its output schema at all, so even fixing the consumer key would leave the code depending on Haiku to guess right. Two contract violations, one fix pass.

**Fix (single commit)**:
- `guya-plugin/agents/guya-observer.md`: pinned output contract as `[{id, persistence, confidence, domain}]` with explicit "echo `id` unchanged from input" rule
- `guya-plugin/hooks/guya-session-end.mjs:424-458`: `persistClassifications` now keys on `r.id` / `trace.id`; added runtime assertion that throws if `classificationResults.length > 0 && mergedCount === 0` (contract-violation tripwire); returns `{mergedCount}` for test observability; added `fileURLToPath` import + `isMain` guard so importing the module for tests doesn't trigger the whole pipeline; added `export { persistClassifications }`
- `guya-plugin/hooks/__tests__/persist-classifications.test.mjs`: new, zero-deps (Node built-in `node:test`), 7 tests — contract-violation regression guard, field-level merge verification, identity-robustness, happy path, pruning, empty no-op, phantom-result tolerance. Two added after review-followup caught a test coverage gap.
- Plugin cache manually synced (drift is still unfixed)

**Verification**: `node --test` → 7/7 pass. `node --check` on source + cache → OK. End-to-end verified against real Haiku with 10 real signal traces from today's backlog: Haiku honored the pinned schema, all ids echoed verbatim, `mergedCount=10`, file pruned correctly. Review gates passed via `/karpathy-review` → apply Medium fixes → `/review-followup` → apply one observability fix → commit.

**Backfill decision**: Deferred. Original plan was "self-heal, next session-end burns down the 20 signal traces." Wrong on two counts:
1. Real signal count is **738**, not 20 — I missed that `tool_call` traces (4,036 of them) pass the pre-filter via their `"Tool: Edit"` content format.
2. The classifier can't handle 738 traces in one call — measured 206,774 input tokens, exceeds Haiku's 200K context. AND `max_tokens: 2048` caps output at ~30 classifications per call.

So the backlog can't self-heal until the batching bug is fixed (new HIGH TODO). For normal-sized sessions (~20-50 signal traces), the current fix works correctly — verified end-to-end below. The backlog specifically is frozen until chunking lands.

**End-to-end verification (real Haiku, real backlog subset, 10 signal traces from `2026-04-09.jsonl`)**:
- Haiku honored the pinned `{id, persistence, confidence, domain}` schema perfectly — all 10 classifications had the right keys
- All output `id` fields echoed input trace `id`s verbatim
- `persistClassifications` merged all 10, returned `mergedCount=10`
- `pruneClassifiedTraces` deleted the file because every trace was classified
- Runtime assertion did NOT spuriously fire on the happy path
- Cost: 1,781 input + 653 output tokens = ~$0.004
- Confidence scores ranged 0.45–0.88 (not a flat hallucination — real classification behavior)

**Files in this commit**:
- `guya-plugin/agents/guya-observer.md` — output schema pinned
- `guya-plugin/hooks/guya-session-end.mjs` — consumer fix, assertion, export, `isMain` guard
- `guya-plugin/hooks/__tests__/persist-classifications.test.mjs` — NEW, 7 tests
- Plugin cache at `~/.claude/plugins/cache/guya/guya/0.1.0/` manually synced (drift unfixed)

**Latent bugs surfaced during investigation (NOT in scope — see TODO)**:
1. `hasLearningSignal` pre-filter hardcodes `correction|preference|reflection` but producers also write `pushback`, `decision`, `confirmation` — ~8 signal traces per batch currently dropped (same producer-consumer drift class as the main bug)
2. **4,036 orphan `tool_call` traces from an unknown producer** — no current hook writes `type: 'tool_call'`. Possibly legacy format, possibly a phantom producer. Note: these traces DO pass the `hasLearningSignal` pre-filter because their `content` is formatted `"Tool: Edit"` which matches the `['write','edit','notebookedit']` allowlist, so they're not dead data — they're the dominant signal source by volume (738 of 738 signal traces in the backlog).
3. **Classifier batching scales poorly.** `classifyTraces` makes ONE Haiku call with ALL filtered traces stuffed into the user message. Measured against real backlog: 738 traces = 206,774 tokens, exceeds Haiku's 200K context. Even at context limit, `max_tokens: 2048` caps output at ~30 classifications per call (measured: 10 traces produced 653 output tokens). Needs chunking.
4. **`PLUGIN_ROOT` fallback at `guya-session-end.mjs:30` is wrong.** Falls back to `dirname(import.meta.url)` which resolves to `hooks/` dir, not the plugin root. `readAgentPrompt` then looks for `hooks/agents/*.md` which doesn't exist. Latent in prod because Claude Code sets `CLAUDE_PLUGIN_ROOT` env var, but breaks every manual invocation and any testing that bypasses the plugin runtime.
5. **`~/.claude/guya/.env` had a corrupted ANTHROPIC_API_KEY** — tailing Unicode `≈` (U+2248) character caused 401 auth errors on every session-end classification/synthesis call. Daniel replaced with clean key at `Desktop/guya/.env`. Home-directory copy may still be corrupted — needs manual fix by Daniel.

## Recent Changes
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
- [ ] **[HIGH] Fix plugin cache drift systemically** — `~/.claude/plugins/cache/guya/guya/0.1.0/` is a copy not a symlink, every hook edit currently requires manual cache sync, and this has silently hidden at least one session's hook work. Options: dev symlink, auto-sync on commit, `/omc-sync-plugin` script. Pick one.
- [ ] **[HIGH — same class of bug as the traceId/id contract bug] Pre-filter `hasLearningSignal` silently drops trace types.** `guya-session-end.mjs:156-177` hardcodes `['correction', 'preference', 'reflection']` as always-classify, but `guya-correction-detect.mjs` also writes `pushback`, `decision`, `confirmation`. Those never pass the filter. ~8 traces in current backlog silently dropped. Same producer-consumer drift. Fix: expand the allowlist, or better — centralize the trace-type enum in a shared schema module so both producer and consumer import it.
- [ ] **[MED — investigate] 4,036 orphan `tool_call` traces in the backlog.** No current hook writes `type: 'tool_call'` — trace-capture writes `file_edit`, correction-detect writes the correction family. These DO pass the pre-filter (their `content` is `"Tool: Edit"` which hits the allowlist via `replace('Tool: ', '')`). They're the dominant signal source by volume. Where are they coming from? Possibilities: legacy format from a pre-refactor version, MCP server writing traces, a hook I haven't audited. First step: `grep -rn "tool_call" ~/.claude/plugins/ ~/.claude/guya/ guya-plugin/` and check git log.
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
