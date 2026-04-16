# guya

## Session Log
- **2026-03-31**: Built Guya from scratch. All 6 phases implemented. Architecture plan via ralplan consensus. Identity files, MCP server (14 tools), 4 hooks, 4 agents, 5 skills. Installed as Claude Code plugin.
- **2026-03-31 session 2-3**: Learned OMC architecture (agents, skills, hooks, composition). Fixed snake_case bug in trace capture. Added pre-filter for trace classification. Added intent detection hook + SDF archival memory. Active Session Behaviors added to context injection.
- **2026-04-05**: Added pre-commit quality harness (test verification, complexity check, cleanup scan + karpathy-review gate). Growth tracker created with Karpathy-level training guideline. Tone guideline updated — casual, unfiltered, roasting welcome. Fixed Zod schema crash in MCP tools. Learning about OpenClaw for standalone Mac Mini agent.
- **2026-04-06**: Fixed CJS wrapper for hooks (ESM stdin piping issue). Moved growth tracker to global ~/.claude/guya/. Added self-awareness guideline (know where your memory lives). Added code review pause guideline. Pre-commit hook now works across all projects.
- **2026-04-07**: Token budget optimization session. Cut CLAUDE.md files from 663→175 lines (73%). Consolidated soul.md + creed.md + hardcoded session behaviors into single soul.md. Trimmed user.md from 77→33 lines. Extracted LLM Design Patterns to docs/llm-design-patterns.md. Updated session-start hook to load consolidated files. Estimated ~1500-2000 token/session savings from static context alone.
- **2026-04-08 AM**: Tooling audit and skill creation session. Installed Codex CLI (gpt-5.4), tested CCG pipeline with live review on SDF director.py. Created 3 custom slash commands: /optimize, /cr, /learn. Built post-commit scribe hook and pre-push validation hook.
- **2026-04-08 session 2**: Infrastructure + bugfix session. Built pre-push PR readiness hook and post-commit scribe hook. Fixed critical pre-commit hook bypass (git add && git commit). Best collaborative pacing session.
- **2026-04-11**: Self-edit pipeline session. Diagnosed broken evolution loop (API key dead 6 days, reflections write-only, zombie tactical guidelines). Built Phase 0-2: versioned `~/.claude/guya/` as git repo, reflection-driven synthesis function + agent, apply-synthesis-result module, rewrote /guya-evolve as combined synthesize→review→apply→consolidate skill, added SessionStart backlog nudge. First real /guya-evolve: 8 guidelines, 4 user.md additions, 1 growth-tracker edit, consolidator re-ranked 18 guidelines. Key decisions: reflections-over-traces (Daniel's call), manual-over-auto (Daniel's call), tiered blast-radius routing, anti-oscillation guardrail (≥2 reflections for identity edits). Bugs caught during verification: appendBulletToSection blank-line stripping, isMain guard missing on session-start export. Tone feedback: "be more friendly" — consultant mode crept in during long session. 225 tests passing. ~$0.21 total API cost (3 Sonnet synthesis calls).
- **2026-04-08 PM**: Hook testing and evolution pipeline session. Centralized traces (4,052 from 9 projects). Expanded feedback detection 3→13 patterns. Hardened review gate. Wrote claude-code-guide.md. Growth tracker: "ask why" B-, technical writing B+, milestone #3 done.
- **2026-04-08 Late PM**: Review gate reliability session. Fixed race condition (gate consumption moved to post-commit). Enforced two-pass review. Fixed scribe bugs and test regex.
- **2026-04-08 Evening**: Obsidian vault integration. Created 5 wiki pages (entities: guya, sdf, bosonai, daniel-lee + synthesis: growth-tracker). Added session-end hook auto-sync (growth tracker grades/milestones + project entity status). Created /guya-obsidian-sync manual skill. Shipped 3 regex bugs on first pass — caught by testing and review gate.
- **2026-04-08 Session 5**: Committed previous session's work (two-layer commit validation, reflections/archive). Discovered review gate never fired — all files were exempt via pathExempt (hooks/) and reviewExempt (*.md, *.json). Removed hooks/ from pathExempt, tightened small change threshold to 10 lines, removed maxFiles. Learning session on Claude Code hooks: stdin/stdout contract, Pre/Post timing, matchers, gate pattern, git hooks vs Claude hooks trust model.


## Session 2026-04-08 Late Evening (Decision Harness)

Built decision harness system to force staff-engineer thinking before implementation. Root problem: Daniel delegates scope/constraints decisions to Claude upfront → wrong implementations → rework. Solution: Explicit trigger skills that ask 8-12 probing questions, synthesize into decision doc + full lod-planner plan + task.

**4 skills created:**
- `/feature` (10 questions) — new capability (scope, constraints, success criteria)
- `/bugfix` (8 questions) — debugging/fixing (root cause, blast radius, verification)
- `/refactor` (8 questions) — code quality (specific problems, behavior preservation)
- `/kickoff` (12 questions) — new project from scratch (mirrors lod-planner Phase 0)

**Enforcement hook (UserPromptSubmit):**
- `guya-decision-gate.mjs` detects work intent via regex patterns
- Session-scoped `.active-session` marker prevents circumvention
- Blocks implementation if no harness run in current session
- Post-commit hook clears the marker (one thing per session)

**Code quality:** Reviewed twice (Karpathy + deep review). Fixed defensive checks for tool_input structure. Added observability logging. All tests pass.

**Key insights:**
- Session-scoped enforcement better than time-scoped (one coherent piece of work per session)
- Global skills in guya-plugin work across all projects
- Teaching through questioning forces Daniel to think, not just receive answers
- Hard gate for all projects, no exemptions

**Next:** Restart Claude Code, test `/feature` on SDF idea, iterate on question intensity.


## Session 2026-04-09
- Tools used: unknown, Edit: guya-decision-gate.mjs
- Domains: general
- Traces: 512

## Session 2026-04-10 (pre-commit gate TOCTOU bugfix)
- **Worked on:** Pre-commit review gate silently bypassing for `git add && git commit` combined commands in SDF
- **Root cause:** `isSmallChange` ran `git diff --cached --numstat` before `git add` executed (PreToolUse fires before the bash command) → empty numstat → 0 lines → gate treated it as small change → skipped
- **Fixes shipped (commit 4b83f53, 175 tests):**
  1. Empty numstat + non-exempt files → fail closed (TOCTOU guard)
  2. `matchAll` instead of `.match()` to capture multiple git add segments
  3. Truncate command at `git commit` so commit message body doesn't leak into staged-file parsing (caught ghost `<file>` bug live)
  4. numstat filtered to non-exempt files only
  5. `gateMaxAgeMinutes >= 0` not `> 0` in formatReviewPrompt
  6. `./` prefix normalization in parseAddArgs for numstat Set lookup
- **Key insight:** PreToolUse hooks fire before the bash command runs — this is the source of the entire TOCTOU class of bugs. Git hooks fire after staging; Claude Code PreToolUse hooks fire before. They have different views of the index.
- **Session pattern:** narrow, focused, no scope creep. Daniel stayed on one bug start to finish.


## Session 2026-04-08 Late Night (Hook Hardening)

Session focus: harden the pre-commit review hook after Daniel asked to inspect/configure it.

**What happened:**
- Daniel asked where pre-commit conditions live; first answer was wrong (gave behavior config, he wanted trigger config). Second answer correct.
- Pre-commit hook fired correctly on first commit attempt — blocked staged hook .mjs files.
- Karpathy review found 9 issues. Followup found 1 real bug (find vs findLast) the first pass missed.
- Committed as 6e49e29.

**Fixes shipped:**
- Extracted `readStdin` to shared `hook-utils.mjs` (eliminated duplication)
- `find()` → `findLast()` for evidence ordering (logic bug with re-reviews)
- Added observability logging to silent catches (parse failures, git failures, stdin errors)
- Cleared stale `contentHash` before recompute
- Fixed TOCTOU regex to match end-of-string
- Replaced fragile `--stat` parsing with `--numstat`
- Fixed glob `replace` to use regex for multiple wildcards
- Removed `scripts/` from pathExempt
- Removed enumerated skills from marketplace.json (auto-discovery)

**Lessons:**
- Two-pass review caught a real logic bug the first pass missed — exactly what it's for
- When questions have two valid readings, ask for disambiguation instead of guessing
- Daniel's cache-debugging instinct improving (correctly diagnosed cached hook firing vs source)
- Convergence: clean single-task session, no drift


## Session 2026-04-09
- Tools used: unknown, Write: guya-hook-verify.sh, Edit: hooks.json, Edit: STATUS.md
- Domains: general
- Traces: 517


## Session 2026-04-09 (evolution pipeline bugfix)

Fixed the `traceId`/`id` contract bug that had silently broken the evolution pipeline since Phase 5 shipped. Commit `2e362bf`.

**Root cause**: producer-consumer contract drift. Trace producers wrote `{id: uuid}` but `persistClassifications` keyed lookups on `traceId` — a field no producer wrote. The ternary guard `trace.traceId ? ... : null` silently short-circuited to null every time, so classifications never merged onto traces and `pruneClassifiedTraces` never actually pruned anything. Compounding bug: `guya-observer.md` never specified its output schema, so even fixing the consumer key would've left the code depending on Haiku to guess right. Two contract violations, one fix pass.

**Process**: Daniel drove root-cause thinking via explicit explain-before-implement ("explain the bug so I can drive it"). Full /karpathy-review → apply Medium fixes (extract `mergeClassifications`, Set-of-ids lookup) → /review-followup → apply observability fix (log `mergedCount` on success) → commit. First session where review discipline felt natural, not forced.

**Key decisions**:
- Scope held tight: no cache drift fix (separate HIGH TODO), no logging system (separate TODO), no touching the three latent bugs discovered along the way
- Backfill: self-heal (no script) — though the 20-trace estimate I gave was wrong, real count is 738 due to `tool_call` traces passing the filter. Self-heal still works for normal sessions but backlog needs the batching fix to burn down
- Fixed both contracts in one commit because the consumer fix can't be verified without the observer schema being pinned

**Verified**: end-to-end against real Haiku with 10 real signal traces from today's JSONL. Haiku honored the pinned `[{id, persistence, confidence, domain}]` schema perfectly — all 10 ids echoed verbatim, mergedCount=10, file pruned correctly. Integration tests 7/7 pass.

**What was learned**:
- Producer-consumer contract drift is a class of bug, not a single bug — same root cause bit the pre-filter allowlist (`pushback`/`decision`/`confirmation` dropped) and possibly the phantom `tool_call` producer
- Silent partial failures are more dangerous than crashes — the bug was invisible because the "broken" path looked identical to the "working" path
- Logging ≠ prevention: assertions + tests prevent bugs, logging helps detect them after they ship. Both layers matter but they're not substitutes
- Reviewing your own code in the same context is a conflict — flagged to Daniel, suggested separate code-reviewer pass

**5 latent bugs surfaced (TODO, not in scope)**:
1. Classifier batching can't handle >30 traces per call (measured: 738 backlog traces = 206K tokens > 200K Haiku limit)
2. `hasLearningSignal` drops `pushback`/`decision`/`confirmation` types silently — same drift class as main bug
3. 4,036 orphan `tool_call` traces from unknown producer (dominant signal source by volume)
4. `PLUGIN_ROOT` fallback at `guya-session-end.mjs:30` resolves to hooks/ dir instead of plugin root — latent in prod, breaks manual invocation
5. `~/.claude/guya/.env` had a corrupted API key (trailing Unicode `≈`) — Daniel replaced with clean key at `Desktop/guya/.env`


## Session 2026-04-09
- Tools used: unknown, Edit: guya-session-end.mjs, Write: classify-traces.test.mjs, Write: verify-classifier-batching.mjs, Edit: classify-traces.test.mjs, Edit: STATUS.md, Edit: pre-commit-config.json
- Domains: general
- Traces: 525


## Session 2026-04-09 Afternoon (review-evidence module refactor)

Retired three coupled pre-commit gate bugs in one extraction. Landed as `5cce60f`. Started as a single bug fix ("contentHash recorded but never validated"), escalated into a redesign when Daniel asked the rabbit-hole meta-question: "maybe the system is too complex?"

**Scope**: extracted `review-evidence.mjs` (new, ~540 LOC) as the single owner of `.guya/evolution/review-evidence.jsonl`. Killed three bugs at once:
1. Dead `contentHash` (recorded but never checked by `checkEvidence`)
2. Filename-only hash (hashed `git diff --cached --name-only`, would've been useless even if checked)
3. Lost-update race on concurrent writes (unlocked read-modify-write)

**The spec**: a commit is "reviewed" iff both `/karpathy-review` and `/review-followup` ran in the gate window AND the current staged tree SHA either matches the followup's tree SHA or differs by ≤ `smallChange.maxLines`. Tree SHA comes from `git write-tree` — git's own canonical identity of the staged index state, the same thing `git commit` uses internally to build commits.

**Race fix**: append-only JSONL with `appendFileSync` (flag `'a'` → POSIX `O_APPEND`). Each line ~100 bytes, well under the atomic-append bound. Pinned by a runtime assertion in `appendStep` and a concurrent-append test that forks two subprocesses.

**Process**: Daniel explicitly asked for spec-first workflow — "after we settle on what counts as reviewed, lets create a concrete plan." The spec was pinned as a calling-spec comment at the top of the new module BEFORE any implementation. This turned out to be load-bearing: when Codex later caught a contract drift I introduced mid-cycle, the spec was the ground truth to diff against.

**Three review passes, all caught real bugs**:
- **karpathy-review**: `DEFAULT_GATE_MAX_AGE_MINUTES` magic-number drift (module exported a const, hook re-inlined `30`); missing stderr warning when `readEvidence` returns corrupt lines. Both fixed.
- **review-followup**: `gateMaxAgeMinutes: 0` silently clamped to 30 (strict debug mode unreachable); `PIPE_BUF` atomicity invariant undocumented and untested; `findLast`-by-position semantics unpinned. All three fixed with new pin tests.
- **Codex independent**: caught contract drift I introduced DURING the review cycle — `validateForCommit` was updated to accept `>= 0` but `normalizeConfig` in the hook still clamped `> 0`, making the fixed behavior unreachable through the real commit path. Also surfaced 2 pre-existing bugs (deferred as TODOs): combined-command parser bypass in `getStagedFiles` via `split(/\s+/)` on quoted paths; unknown schema version fail-open in `parseLine`.

**Tests**: 86 → 160 (+74). Split `review-evidence.test.mjs` into two files when it crossed the 800 LOC cap — local pre-commit gate caught this, proving the complexity checker works. Three test suites: schema/IO (422 LOC), validateForCommit failure-mode matrix (475 LOC), and E2E (400 LOC spawning real hook subprocess against real git fixtures). Manual 8-step walkthrough in a scratch repo confirmed every failure mode.

**Key decisions**:
- Extract a typed module rather than patch in place — the seam was "evidence file has no owner, no schema" and patching couldn't fix that
- Append-only JSONL over locking — cleaner race fix, self-documenting via the file format
- New filename (`.jsonl` instead of `.json`) + delete legacy file on sight — single authoritative file, no dual-state confusion
- Delta tolerance shares `smallChange.maxLines` threshold, no new config knob — same trust model as existing isSmallChange exemption
- Shipped `gateMaxAgeMinutes: 0` as a legitimate strict-debug mode, not clamped — aligns with the existing `maxLines: 0` pattern

**Growth signal**: Daniel's rabbit-hole meta-question was the best move of the session. Most people patch until exhausted; stopping to ask "is the approach wrong?" is staff-engineer behavior. Combined with his spec-first insistence, this was the highest-leverage session in weeks. Growth tracker: convergence discipline C+ → B-, deep debugging C+ → B-.

**What was learned**:
- Self-review blindness is real even with the full discipline — I fixed 5 things, then introduced a 6th mid-cycle that the followup review missed because it was testing the wrong layer. Independent review (Codex) caught what 2 self-review passes missed.
- When fixing a value in one file, grep for the field name across ALL files that could clamp it before reaching the fix.
- The three-pass discipline (karpathy → followup → codex) is worth it for refactors of this scope. Each pass caught different classes of issues.
- `git write-tree` is exactly the primitive I needed — content-recursive fingerprint of the staged state, the same thing `git commit` uses. Filename-only hashes are a red flag for "author was guessing at what to hash."

**2 new TODOs added (pre-existing, deferred)**:
1. [HIGH] `getStagedFiles` combined-command parser bypass via `split(/\s+/)` on quoted filenames — deterministic gate bypass via `git add "file with spaces" && git commit`
2. [MED] `parseLine` treats unknown schema versions as "corrupt lines" — fail-open against schema evolution, pin before next schema bump


## Session 2026-04-10 (cache drift + phantom state dirs)

Two HIGHs from STATUS.md closed. Focused, operational session — no drift, no scope creep. Commits `40750fa` and `2f22658`.

**Bug 1 — Plugin cache drift (40750fa):**
Claude Code runs hooks from `~/.claude/plugins/cache/guya/guya/0.1.0/` (a static copy installed by the plugin manager), not from the source repo. Every hook edit required a manual sync step, and one session's work silently never ran. Root cause: Claude Code's plugin system is a package manager — installs to a managed path, has no concept of a "source repo." Fix: `scripts/sync-plugin.sh` (rsync source → cache, excludes `__tests__/`, `.guya/`, `.omc/`, `node_modules/`) + `.git/hooks/post-commit` that calls it automatically. Self-heals after plugin reinstall on next commit. Manual sync available mid-session: `bash scripts/sync-plugin.sh`. Review fixed 2 issues: `ls | head -1` → `find -type d | sort -V | tail -1` (semver order + no `.DS_Store` false match); added `rsync` presence check.

**Bug 2 — cwd-based phantom `.guya/` state dirs (2f22658):**
All hooks determined their state directory via `input.cwd || input.directory || process.cwd()`. Claude Code injects `cwd` as whatever directory its shell was in when the hook fired — if working inside `guya-plugin/`, hooks wrote state to `guya-plugin/.guya/` instead of the repo root. Pre-refactor trace-capture created 43 phantom traces there in 2026-03-31 that sat undetected for 10 days. Fix: `resolveProjectRoot(cwd)` added to `hook-utils.mjs` — runs `git rev-parse --show-toplevel`, falls back to raw cwd for non-git paths. All 6 hooks now wrap their `directory` assignment. 6 new tests pin happy path, fallback, and unexpected-failure behaviors. 160 → 166 tests.

**Key decisions:**
- Chose auto-sync-on-commit over symlink for cache drift — Daniel had prior incident where symlink was silently overwritten on plugin reinstall. Incident-based rejection of the "cleaner" option.
- `getStagedFiles` bypass (HIGH #3) deferred — needs A/B/C design decision before any code

**Growth signals:**
- Daniel asked "explain the issue first" both times without prompting — this is now default behavior
- Asked "why does Claude Code reference the cache?" out of genuine curiosity mid-session, not blocking need
- Rejected symlink with an incident, not a preference — evidence-based decision making

**Recurring issue flagged for next session:**
Post-commit scribe creates duplicate entries in STATUS.md when there's a `pending` line already written manually. I've been silently cleaning this up — needs a real fix, not housekeeping.


## Session 2026-04-10
- Tools used: unknown, correction: no, that is wrong, Edit: guya-pre-commit-review.mjs, Edit: pre-commit-review-e2e.test.mjs, Edit: parse-add-args.test.mjs, Write: 2026-04-10-manual-2.md, Edit: guya.md, Edit: STATUS.md
- Domains: general
- Traces: 529


## Session 2026-04-10 (skill rewrite session)

Rewrote all review skills and four core skills following Anthropic's doc-skill.md format. Two commits: `cfaa7bb` (review skills), `14bcbf8` (core skills).

**Review skill stack redesigned:**
- `guya-karpathy-review` → `guya-review`: inlined Karpathy's 3 principles as distinct categories (Simplicity, Surgical Changes, Goal Verification); expanded Security/Race Conditions; added auto-fix step (Step 4) for unambiguous structural issues
- `guya-review-followup` → `guya-deep-review`: added Performance category (algorithmic complexity, hot path allocations); added auto-fix step with behavioral fix patterns; flags test gaps to guya-tester
- `guya-cr` → `guya-pr`: redesigned from redundant 3-pass review to pre-PR preparation skill — Codex fresh-eyes pass, readiness checklist (scope, breaking changes, migrations), PR summary generation. Removed from pre-commit gate entirely.

**Core skills rewritten:** guya-learn, guya-optimize, guya-reflect, guya-evolve — all reformatted with Steps structure, WHY framing, and argument-hints.

**Key decisions:**
- guya-pr is report-only (optimizations have trade-offs requiring judgment); guya-review/guya-deep-review auto-fix (unambiguous findings)
- "report vs fix" is now an explicit design decision for each skill, not a default
- Skill descriptions are the primary trigger mechanism — must be pushy and specific

**What was learned:**
- Always read source material before rewriting a skill that references it — I reconstructed Karpathy guidelines from memory and missed Goal Verification entirely; Daniel caught it
- Format mismatch (agent format vs skill format) causes rewrites — confirm format before writing
- Daniel's guya-pr redundancy call: systems-level insight that the pre-commit gate already enforces review on every commit, so re-running categories at PR level adds no value

### 2026-04-13
- Created guya-scout skill: 2-phase codebase onboarding (Explore subagent → scout-report.md with 8 sections → bidirectional Q&A session). Eval showed ~17% token efficiency gain over baseline; structural consistency strong; Phase 2 (interactive session) is the real differentiator — baseline has zero concept of it.
- Updated guya-decision-kickoff: added Project Setup phase (scaffolds context/core-beliefs.md, context/vision.md, ARCHITECTURE.md, STATUS.md seeded from 12-question answers; prompts guya-setup for clean repos). Plan output path aligned to docs/plans/PLAN_*/ to match lod-planner. Explicit lod-planner delegation added.

### 2026-04-13 session 2 (docs + licensing)
- Built public-facing documentation. PHILOSOPHY.md: personal thesis doc from thoughts.txt — rider > harness, ralplan failure story, two failure patterns (session amnesia + lessons dying), mental model (context/memory/planning, agents/skills/hooks), closes on "adaptation goes both ways." README.md: product-style, modeled after oh-my-claudecode — badges, hero image, quick start, command tables grouped by function, architecture overview, project structure, links to PHILOSOPHY.
- Licensing: added MIT LICENSE at root; updated plugin.json and guya-plugin/package.json license fields from UNLICENSED → MIT.
- Repo hygiene: moved image.png → assets/guya.png; added thoughts.txt to .gitignore as personal draft; removed guya-plugin/skills/guya-scout-workspace/ (930 lines of iteration-1 eval scratch artifacts that didn't belong in shipped plugin).
- Pattern observed: accept-all-pushbacks in one message. Daniel got 4 substantive critiques of thoughts.txt (co-adaptation reframe, scaffold-vs-crutch tension, rider/horse metaphor breaking, missing "why a plugin") and accepted all without tradeoff-testing. Editorial instincts on structural calls (TLDR to top, closer to end, cutting sneaking-past-gates story) were strong though — contrast suggests the accept-first pattern hits hardest when being agreed with, not when being asked to execute.
- Commits: cf5283a (docs scaffold + LICENSE + image move), dc994b1 (PHILOSOPHY restructure — TLDR top, closing revised), 2d0f6c3 (scout-workspace removal).
