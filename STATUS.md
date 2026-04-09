# guya — Status

> Last updated: 2026-04-09 ~11:20 PT

## Current Focus
Decision-gate hook removed + harness-marker suppression retained for remaining UserPromptSubmit hooks. Verification done (7/7 tests via real `run.cjs` execution path). Ready to commit.

## This Session — What Changed and Why

**Started as**: Run the 6-test verification matrix from last session's uncommitted hook suppression fix, then commit.

**Pivoted to**: After verifying the fix (all 7 tests green through the real `run.cjs` path — closing the gap previous session flagged), Daniel typed "fxi" (intentional typo) during normal workflow and the decision-gate hook still fired. That was the final data point — the regex gate is whack-a-mole and creates more friction than discipline. Decision: **delete the decision-gate hook entirely**. Daniel will invoke `/feature`, `/bugfix`, `/refactor`, `/kickoff` manually when he wants staff-engineer thinking.

**What stayed**: The harness-marker suppression work for `guya-intent-detect.mjs` and `guya-correction-detect.mjs` is still valuable — during a manually-invoked `/feature` session, we still don't want archival reloads on every Q&A answer (intent-detect) or fake "corrections" saved from domain answers (correction-detect). The `isHarnessActive` helper and SKILL.md marker writes remain.

**What's gone**:
- `guya-plugin/hooks/guya-decision-gate.mjs` (deleted)
- `guya-decision-gate.mjs` entry in `hooks.json` UserPromptSubmit block
- Cache equivalents removed + hooks.json synced

**Verified in real execution path (this session, via `node run.cjs <hook>`)**:
1. No marker + work verb → decision-gate blocked ✓ (pre-removal baseline)
2. Marker + work verb → continue:true ✓
3. Marker + correction phrase → no trace written, traces count unchanged ✓
4. Marker + "guya" archival keyword → no context injection ✓
4b. (control) No marker + archival keyword → injects correctly ✓
5. Marker removed → block restored ✓
6. Stale marker (mtime >2h) → auto-deleted + block restored ✓

Test script preserved at `/tmp/guya-hook-verify.sh` for re-running if needed.

**Files in this commit**:
- `guya-plugin/hooks/guya-decision-gate.mjs` — DELETED
- `guya-plugin/hooks/hooks.json` — removed decision-gate entry
- `guya-plugin/hooks/hook-utils.mjs` — `isHarnessActive` helper (kept for other hooks)
- `guya-plugin/hooks/guya-intent-detect.mjs` — harness suppression kept
- `guya-plugin/hooks/guya-correction-detect.mjs` — harness suppression kept
- `guya-plugin/hooks/guya-session-end.mjs` — stale marker safety-net cleanup kept
- `guya-plugin/skills/guya-decision-{feature,bugfix,refactor,kickoff}/SKILL.md` — marker management instructions kept

All synced to `~/.claude/plugins/cache/guya/guya/0.1.0/`.

## Recent Changes
- [2026-04-09] (uncommitted, this session) Remove decision-gate hook entirely; keep harness-marker suppression for intent-detect + correction-detect
- [2026-04-09] (verified this session, was uncommitted from prior) Marker-based suppression infrastructure for UserPromptSubmit hooks during decision harnesses
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
- [ ] **[HIGH — evolution pipeline broken] `traceId` vs `id` mismatch in classification persistence.** Found during today's review-followup pass. `guya-session-end.mjs:425` builds `classById = Map(classificationResults.map(r => [r.traceId, r]))` and L429 looks up `trace.traceId`. But all trace producers write `id: randomUUID()` (`guya-trace-capture.mjs:108`, `guya-correction-detect.mjs:137`), never `traceId`. Result: `cls` is always null, classifications are NEVER persisted onto traces, and the evolution pipeline silently no-ops since day one. Compounding issue: `guya-observer.md` doesn't specify the output schema at all, so Haiku is free to key by anything. This likely explains why the "first real classify→synthesize cycle" TODO has been open for weeks. Fix: standardize on `id`, update observer prompt to specify `{id, persistence, confidence, domain}`, update session-end to lookup by `id`. Add integration test asserting classification fields land on traces.
- [ ] Follow-up commit: apply review findings from today's karpathy-review pass — add `console.error` logging to silent catches in `hook-utils.mjs:36,40`, `intent-detect.mjs:91`, `correction-detect.mjs:101`; consolidate the 3 remaining duplicate `readStdin` implementations to use the shared `hook-utils.mjs` version
- [ ] Follow-up: extract `persistClassifications` from `session-end.mjs` into a pure testable function (risk found during follow-up review — orchestrator hides bugs that unit tests would catch)
- [ ] Clean up stray `# test` heading at `guya-plugin/CLAUDE.md:46`
- [ ] Decide fate of line 52 in `~/.claude/guya/traces/2026-04-09.jsonl` — "I have noticed while working on SDF" preference, borderline real signal
- [ ] Growth tracker milestone #2: read and critique someone else's code
- [ ] Growth tracker milestone #5: review code Guya writes — pick one function per session

## Decisions & Notes
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
