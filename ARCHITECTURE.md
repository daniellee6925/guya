# guya — Architecture

> Last updated: 2026-05-19 (post constantia-sync daemon ship — container commits / host pushes split, ADR-024; WORK proactive DM destination retired + Discord 2000-char chunker re-wired)

## Current Architecture

### Overview

Guya is a hook-native, plugin-delivered personal agent system. There is no Guya-side daemon. All Guya runtime behavior is driven by Claude Code lifecycle hooks, git hooks, and an MCP server — assembled at session start and triggered by events.

One host-side daemon now lives in the wider system: `constantia-sync` (launchd, on the mini), which owns the `git fetch + rebase + push` for the shared Constantia repo. Telos containers commit locally only; the daemon is the single pusher. Guya's session-start hook reads its heartbeat/status file and surfaces alerts when sync stalls. See ADR-024 and the **constantia-sync daemon (container/host split)** subsystem below.

### Module Map

```
guya/
├── guya-plugin/              # Claude Code plugin (source of truth)
│   ├── hooks/                # Lifecycle hook scripts (run via run.cjs shim)
│   │   ├── hooks.json        # Hook dispatch registry
│   │   ├── run.cjs           # CommonJS shim — loads ESM hook scripts
│   │   ├── guya-session-start.mjs      # SessionStart: assemble context → <guya-context>
│   │   ├── guya-session-end.mjs        # SessionEnd + PreCompact: classify traces → synthesize guidelines
│   │   ├── guya-trace-capture.mjs      # PostToolUse(Write|Edit): record tool use traces
│   │   ├── guya-correction-detect.mjs  # UserPromptSubmit: fast-lane regex correction detection
│   │   ├── guya-intent-detect.mjs      # UserPromptSubmit: detect user intent signals
│   │   ├── guya-pre-bash-dispatch.mjs  # PreToolUse(Bash): single dispatcher → review + push subprocesses (defeats 2.1.101+ matcher dedup)
│   │   ├── guya-pre-commit-review.mjs  # Invoked by dispatcher (Bash) and directly (Skill); PreToolUse:Skill path now auto-records evidence (appendStep) after isMain realpathSync fix
│   │   ├── guya-pre-push-check.mjs     # Invoked by dispatcher: block push if quality checks fail; also runs hooks-smoke as the `guya-hook-smoke` gate when the test file exists
│   │   ├── guya-post-commit-scribe.mjs # Invoked from git post-commit hook (NOT Claude Code hook)
│   │   ├── __tests__/hooks-smoke.test.mjs  # Spawns every registered hook through the symlinked plugin path with a benign payload; asserts non-empty stdout (catches silent-no-op regressions)
│   │   ├── hook-utils.mjs              # Shared utilities (isGitCommit, resolveProjectRoot)
│   │   └── constantia-sync.mjs         # Shared Constantia integration (path resolution, task reading, log writing) + `readSyncStatus(path)` reads daemon heartbeat at `<constantia>/.git/sync-status.json` and returns an alert string when stale/errored
│   ├── tools/                # MCP server (guya-tools)
│   │   ├── server.js         # MCP stdio server; registers all tool groups
│   │   ├── memory-tools.js   # memory_core_update/append, memory_archival_store/search, memory_recall_note, memory_reflect
│   │   ├── introspection-tools.js  # guya_status, guya_guidelines, guya_traces
│   │   ├── evolution-tools.js      # evolve_consolidate, evolve_status, evolve_force_synthesize
│   │   └── identity-tools.js       # identity_propose_change, identity_read
│   ├── skills/               # One directory per skill (SKILL.md inside each)
│   │   ├── guya-setup        # Install git hooks into any repo
│   │   ├── guya-scribe       # Update STATUS.md / ARCHITECTURE.md / CLAUDE.md
│   │   ├── guya-reflect      # Manual reflection cycle + Constantia log write
│   │   ├── guya-evolve       # Combined synthesis → review → apply → consolidate
│   │   ├── guya-learn        # Interactive teaching sessions
│   │   ├── guya-review       # Code review (Karpathy principles)
│   │   ├── guya-deep-review  # Second-pass review after fixes
│   │   ├── guya-optimize     # Simplification and performance analysis
│   │   ├── guya-issue        # Capture a mid-work bug into a GitHub issue, return to task
│   │   ├── guya-status       # Show current Guya state
│   │   ├── guya-skill-creator # Create/improve skills
│   │   ├── guya-decision-bugfix / feature / refactor  # Decision harnesses
│   │   ├── guya-decision-kickoff  # Kickoff harness: 12-question alignment → Project Setup scaffold → lod-planner delegation
│   │   ├── guya-scout        # 2-phase codebase onboarding: Explore subagent → scout-report.md → bidirectional Q&A
│   │   └── AGENTS.md         # Agent catalog (spawnable via Agent tool)
│   └── agents/               # Agent definition files
├── scripts/
│   └── sync-plugin.sh        # rsync guya-plugin/ → Claude Code plugin cache
├── .guya/                    # Project-local Guya state (git-tracked where appropriate)
│   ├── memory/
│   │   ├── core/             # Core memory blocks (injected at session start)
│   │   ├── archival/         # Deep knowledge store (semantic search via MCP)
│   │   └── reflections/      # Dated reflection entries
│   ├── evolution/
│   │   ├── guidelines/       # Tactical guidelines (project-specific, auto-synthesized)
│   │   ├── traces/           # Raw tool-use traces (input to observer)
│   │   ├── last-scribe-head  # Full SHA of last commit processed by post-commit scribe
│   │   ├── review-gate.json  # Pre-commit review gate state { reviewed: bool }
│   │   └── review-evidence.jsonl  # Evidence accumulated by pre-commit review hook
│   └── decisions/
│       └── .active-session   # Active decision harness session marker
├── ~/.claude/guya/           # Global Guya identity — GIT REPO (versioned since 2026-04-11)
│   ├── .git/                 # Full history of identity edits; every /guya-evolve creates commits
│   ├── .commit-log           # NDJSON audit trail of every commit-identity.mjs invocation
│   ├── .last-evolved         # JSON timestamp + summary of last /guya-evolve run
│   ├── .last-consolidated    # ISO timestamp of last consolidator run
│   ├── soul.md               # Identity anchor — the bear, the commitments, session behaviors
│   ├── identity.md           # Presentation: name, origin, vibe
│   ├── user.md               # Daniel's profile, patterns, growth areas
│   ├── growth-tracker.md     # Grades, trajectory, milestones (Karpathy target)
│   ├── pre-commit-config.json # Review gate thresholds (shared across projects)
│   ├── guidelines/strategic/ # Strategic guidelines (cross-project, reflection-synthesized)
│   └── traces/               # Daily JSONL trace files (gitignored, machine state)
├── ~/.claude/guya/constantia.json  # Constantia repo path config (cross-project discovery)
└── .git/hooks/post-commit    # Git hook: sync-plugin.sh → guya-post-commit-scribe.mjs
```

### Hook Dispatch (hooks.json)

| Event | Matcher | Handler |
|-------|---------|---------|
| SessionStart | * | guya-session-start.mjs — assemble `<guya-context>` + read Constantia tasks |
| UserPromptSubmit | * | guya-correction-detect.mjs — fast regex correction |
| UserPromptSubmit | * | guya-intent-detect.mjs — intent signals |
| PreToolUse | Bash | guya-pre-bash-dispatch.mjs — single entry; spawns review then push as subprocesses |
| PreToolUse | Skill | guya-pre-commit-review.mjs — review gate check (Skill matcher safe from dedup) |
| PostToolUse | Write\|Edit | guya-trace-capture.mjs — record trace |
| PreCompact | * | guya-session-end.mjs — evolution pipeline |
| SessionEnd | * | guya-session-end.mjs — evolution pipeline |

**Key constraint discovered 2026-04-10:** PostToolUse with a specific tool name (e.g. `Bash`) does not dispatch in Claude Code. The `*` wildcard and `Write|Edit` compound matchers work. PostToolUse:Bash was removed as dead code.

**Key constraint discovered 2026-04-24:** Claude Code 2.1.101+ semantically deduplicates `PreToolUse` entries by matcher. Multiple top-level entries with `matcher: "Bash"`, or multiple `hooks[]` items inside one matcher block, collapse so only one hook runs per invocation — even when the matcher *strings* differ but compile to equivalent regex. The pre-commit-review gate silently bypassed itself for ~16 days under this regression. Workaround: a single dispatcher (`guya-pre-bash-dispatch.mjs`) is registered under `matcher: "Bash"` and fans out to review + push as subprocesses. Cost: ~150 ms extra Node cold-start per Bash invocation. **Do not re-split into separate hooks.json entries** — the dedup will silently bypass review again.

### PreToolUse:Bash Dispatch Flow

```
Bash tool invocation
        │
        ▼
guya-pre-bash-dispatch.mjs (single registered hook)
        │ readStdin() once
        │
        ├─► spawn guya-pre-commit-review.mjs (5s timeout)
        │     └─ if decision: "block" → return immediately
        │
        └─► spawn guya-pre-push-check.mjs (145s timeout)
              └─ return its decision (or fall through to review's allow)

On any wrapper-level error: fail-open ({continue: true}) — never block on dispatcher crash.
```

### Plugin Delivery Pipeline

```
Edit guya-plugin/ source
        │
        ▼
.git/hooks/post-commit (git hook, fires after every commit)
        │
        ├─ 1. sync-plugin.sh
        │       rsync guya-plugin/ → ~/.claude/plugins/cache/guya/guya/<version>/
        │       (Claude Code reads hooks and MCP server from cache, not source)
        │
        └─ 2. guya-post-commit-scribe.mjs (invoked directly via synthetic payload)
                Reads last-scribe-head marker
                If HEAD advanced: update STATUS.md, reset review gate, clear decision session, write new marker
                If HEAD unchanged: no-op
```

The scribe is invoked from the git hook rather than PostToolUse:Bash because PostToolUse with specific tool names (including Bash) does not dispatch in Claude Code. A synthetic JSON payload `{"tool_name":"Bash","tool_input":{"command":"git commit"},"cwd":"..."}` is piped to the scribe so it passes `isGitCommit()` detection.

### Evolution Pipeline (manual via /guya-evolve)

```
Constantia log/guya/ (primary — cross-project /guya-reflect outputs)
        │   fallback: .guya/memory/reflections/ (project-local, pre-Constantia)
        │
        ├── + Telos profile from Constantia (if available)
        │
        ▼ guya-reflection-synthesizer (sonnet) — blast-radius routing
        │
        ├─ guidelineEdits       → auto-apply to ~/.claude/guya/guidelines/strategic/
        ├─ userProfileAdditions → auto-append to ~/.claude/guya/user.md
        └─ identityProposals    → per-item review with diff (soul.md, growth-tracker.md)
                │                  ≥2 source reflections required (anti-oscillation)
                │
                ▼ guya-consolidator (opus) — merge, prune, re-rank (runs if stale >7d)
                │
                ▼ commit-identity.mjs → git commit to ~/.claude/guya/ (versioned repo)
```

**Reflection source resolution (changed 2026-05-06, commit `d589953`).** The synthesizer reads from Constantia's `log/guya/` directory as the primary source — every entry there is a `/guya-reflect` output, regardless of which project it was written from. Project-local `.guya/memory/reflections/` is consulted only as a fallback when Constantia is unreachable (and as the home for pre-2026-04-17 entries written before Constantia integration). Synthesis runs against ONE source per call to avoid duplicates; `forceLocal: true` skips Constantia for testing. This closes a cross-project signal leak: reflections written from non-Guya projects (lina_platform, sdf-dev, auto_eval) land in Constantia and were previously invisible to evolve when run from `/Users/daniel/Desktop/guya`. Aligns the pipeline with vision.md §3.1 — Constantia is the canonical cross-project shared truth; project-local `.guya/` is project-specific context only.

**Key decision (2026-04-11):** Manual invocation over auto session-end trigger. Reflections are written deliberately (via /guya-reflect), so consumption should be deliberate too. Auto-fire invited silent rot — the API key died for 6 days with no one noticing because the auto loop ran unattended. SessionStart surfaces a backlog nudge ("📝 N reflections accumulated") when /guya-evolve hasn't run recently.

Legacy trace-driven pipeline (guya-observer → guya-synthesizer in session-end) is still wired but produced near-zero useful output. The reflection-driven pipeline replaces it as the primary evolution mechanism.

### Constantia Integration (three-identity architecture)

```
Guya (executor)                    Telos (mentor)
   │                                  │
   ├── session-start reads ◄──────── tasks/MANIFEST.md
   ├── /guya-reflect writes ──────► log/guya/YYYY-MM-DD-{project}-{session}.md
   ├── /guya-evolve reads ◄──────── profile/ (strengths, weaknesses, trajectory)
   │                                  │
   └────────── Constantia ────────────┘
               (shared git repo)
```

**Constantia** (`~/Desktop/constantia`) is the shared memory repo between Guya and Telos. Path resolved via `~/.claude/guya/constantia.json`. The `constantia-sync.mjs` module provides shared utilities for path resolution, task manifest reading, and log writing.

**Write ownership (no shared-write files):**
- Guya: `log/guya/` (via /guya-reflect), task status updates
- Telos: `log/telos/`, `evidence/`, `profile/`, `goals/`, task assignments + grades

**Log layout (reorganized 2026-05-04 PM).** `log/` was previously flat with `YYYY-MM-DD-{author}-{project}-{session}.md` files; it is now split by author:
- `log/guya/YYYY-MM-DD-{project}-{session}.md` — one file per Guya session
- `log/telos/YYYY-MM-DD-tick.md` — one file per day, all action+no-op tick sections appended in order
- `log/telos/YYYY-MM-DD-reflection.md` — nightly synthesized reflection (one per day)

23 existing logs were migrated. The Constantia pre-commit hook validates per-author filename regex and rejects any new file at `log/` root. The post-commit manifest hook walks subdirectories via `find` and includes a Path column in `log/MANIFEST.md`. Hooks are now installed as symlinks on both laptop and mini — the mini was the silent-validation gap that allowed `tick.md` filenames to commit despite not matching the old flat regex (the hook simply wasn't running there).

**Session-start:** reads `tasks/MANIFEST.md`, injects active tasks at priority 0 (same as soul/user). Alerts if Constantia unavailable — never silently degrades.

**Reflect:** writes structured log entries with YAML frontmatter + full body (session metadata, reflection content, growth observations, open threads) into `log/guya/`. Filename includes project + session ID to prevent cross-repo collisions. Append logic for same-session re-reflects.

**Evolve:** `readConstantiaProfile()` reads Telos's non-stub profile assessments as additional synthesis input, so Guya can calibrate proposals against Telos's longitudinal view.

### constantia-sync Daemon (container/host split, shipped 2026-05-16 — ADR-024)

The Constantia repo is shared across two filesystems: it lives on mini's native APFS at `/Users/guya/constantia` and is bind-mounted into Telos containers at `/workspace/extra/constantia`. Docker's bind-mount layer breaks git's `unpack-trees` safety check during `rebase` — the same git binary fails on the bind mount and succeeds on the container's overlay FS, confirmed by side-by-side experiment. The structural fix is to keep all working-tree mutations off the bind mount; the bind-mount side does commits only.

```
┌─────────────────────────────────────────┐      ┌─────────────────────────────────────────┐
│ Telos container (bind-mounted view)     │      │ Host (mini, native APFS)                │
│ /workspace/extra/constantia             │      │ /Users/guya/constantia                  │
│                                         │      │                                         │
│ MCP tool fires                          │      │ launchd: com.guya.constantia-sync        │
│   │                                     │      │   /Users/guya/constantia/scripts/        │
│   ▼                                     │      │   constantia-sync.sh                     │
│ helpers.ts:commitOnly(message, paths)   │      │                                         │
│   git add -A <paths>                    │      │ loop every 5s:                          │
│   git commit -m "<message>"             │      │   abort stale rebase/merge              │
│   (NO fetch, NO rebase, NO push)        │      │   if local==last_pushed → heartbeat     │
│                                         │      │   git fetch origin main                 │
│ Returns {sha, committed:true}           │      │   git rebase origin/main                │
└─────────────────────────────────────────┘      │     on conflict → abort + status=conflict│
                       │                          │   git push origin main                  │
                       │ local commit lands on    │   write status.json (atomic tmp+rename) │
                       │ mini's main (same repo,  │                                         │
                       │ different FS view)       │ status fields: last_cycle_ts,           │
                       └────────────────────────► │   last_cycle_outcome, last_push_sha,    │
                                                  │   last_local_sha, heartbeat_age_ms      │
                                                  └─────────────────────────────────────────┘
                                                                       │
                                                                       ▼
                                                    Guya session-start hook
                                                    constantia-sync.mjs:readSyncStatus()
                                                    emits `constantia-sync-alert` section
                                                    when heartbeat >5min OR last cycle errored
                                                    (silent in the healthy case)
```

**Container side (`shared/telos-tools/helpers.ts`, telos fork — mounted into every Telos session container).** `commitAndPush(message)` was renamed to `commitOnly(message, paths)` and reduced to `git add -A <paths>` + `git commit`. All 10 MCP-tool callers pass the specific paths they wrote (eliminating a latent `git add -A` race surface across concurrent containers). `appendTickLogSection` now returns its log path so callers can include it in the `paths` array. The container never fetches, rebases, or pushes — those operations fail through the bind mount.

**Host side (`/Users/guya/constantia/scripts/constantia-sync.sh`, launchd job `com.guya.constantia-sync` via `~/Library/LaunchAgents/com.guya.constantia-sync.plist`).** Polls every 5s on mini's native APFS where git's safety checks return correct answers. Aborts any stale rebase/merge from a prior killed cycle, fetches origin, rebases local main, pushes. On rebase conflict: aborts cleanly, writes `last_cycle_outcome: "conflict"`, retries next cycle (self-clears once Daniel resolves). Writes `<constantia>/.git/sync-status.json` atomically (tmp + rename) every cycle so readers see consistent state without locking.

**Guya side (`guya-plugin/hooks/constantia-sync.mjs`).** Exports `readSyncStatus(path)` which reads `<constantia>/.git/sync-status.json` and returns an alert string when the heartbeat is stale (>5 min) or the last cycle ended in conflict/push failure. `guya-session-start.mjs` calls it and emits a `constantia-sync-alert` section in `<guya-context>`. Silent in the healthy case — never adds noise when the daemon is doing its job.

**What the daemon replaces.** The post-commit hook's auto-push and `check_reminders.sh`'s inline pull/push are both dropped — the daemon is the only pusher. The post-commit `trunc` helper was also rewritten in pure bash to drop a stray `python3` dependency that was masking the bind-mount issue with a different failure (partial MANIFEST writes dirtying the working tree).

**Anti-rot watches.** The daemon's heartbeat is now the single point of trust — if it dies and `readSyncStatus`'s staleness check ever drifts (e.g., status file path changes, `.git/` ignore semantics shift), commits silently pile up on mini's local main again. The session-start surface must remain load-bearing. The `unpack-trees` safety check is still wrong inside containers, so any future Telos work that needs `checkout`, `merge`, `cherry-pick`, or any other working-tree mutation must also push to the host daemon — not run in-container. See ADR-024 for the full diagnosis.

**Task schema (post 2026-05-08 reorg — supersedes ADR-017's T/P prefix).** `tasks/` is now four sibling subdirs, each with its own ID prefix and lifecycle:

| Dir | Prefix | Lifecycle | Purpose |
|-----|--------|-----------|---------|
| `tasks/proposals/` | `P-NNN` | `proposed → accepted \| rejected` | Recommendations awaiting accept/reject. Carry `target: task\|learn\|curriculum` field. |
| `tasks/tasks/` | `T-NNN` | `assigned → in-progress → complete → graded` (+ `blocked`, `abandoned`) | Committed T-task work. |
| `tasks/learn/` | `L-NNN` | same as tasks | Curriculum-paced learning, references curriculum + module. |
| `tasks/learn/curricula/` | `<slug>.md` | n/a (free-form) | Durable structured plans (e.g., `bytebytego-systems.md`). |
| `tasks/reminders/` | `R-NNN` | `pending→fired→archived` (one-shot) or `active→paused\|retired` (cron) | Scheduled fires with flat `schedule_type` + `schedule_at`/`schedule_expr`. |
| `tasks/archive/2026-05-07/` | `TASK-NNN` (legacy) | `status: archived` (read-only) | 17 pre-reorg TASK files preserved for audit. Validator skips. |

**Priority is plain numeric `1|2|3`** across proposals/tasks/learn (no T/P prefix — the ADR-017 prefix scheme is dropped). Validator enforces explicit re-grade at proposal acceptance (`acceptProposal` requires `priority` arg; not auto-carried from `target_priority` hint). Reminders skip priority entirely. **Pillar enum is `1 | 2 | 3 | none`** on the same three categories. Reminders skip pillar.

**Terminal-without-grade for tasks is `abandoned`** (was `rejected`). `rejected` is now reserved for proposals only. Mirrors the proposal-vs-committed split semantically.

**Reminder schedule is flat fields** (not nested YAML — keeps the existing flat frontmatter parser working without YAML deps):
- `schedule_type: once` requires `schedule_at: <ISO-timestamp>`. Status: pending→fired→archived.
- `schedule_type: cron` requires `schedule_expr: <5-field cron>`. Status: active→paused→retired.

**MANIFEST is one file with 4 sections** (`tasks/MANIFEST.md`): Tasks (T-tasks), Learn (L-tasks), Proposals (P-proposals), Reminders (R-tasks). Post-commit hook walks all four dirs and rewrites sections. Session-start reads this single file at priority 0.

**Curriculum reference flow.** L-tasks carry `curriculum: <slug>` + `module: <num|name>` + `success: <criterion>` + `by: <due-YYYY-MM-DD>`. Curriculum file at `tasks/learn/curricula/<slug>.md` must exist (validator + tool-runtime both check). At 10pm learn tick, `grade_learn` evaluates Daniel's writeup against the L-task's `success` criterion via knowledge-check Q (live Q&A, not async-only) and writes evidence with `{strength|habit|tentative}` calibration.

**Backlog ownership (still: Constantia is single source of truth).** Surfaced ideas flow: Telos `propose_task` (target=task|learn|curriculum) → P-proposal in `tasks/proposals/` → Daniel/Telos triages via `accept_proposal` → spawns the right artifact in the right dir.

### Context Assembly (session-start)

At every SessionStart, `guya-session-start.mjs` reads and assembles into a `<guya-context>` system-reminder block (3000 token budget / ~12000 chars):

1. Global identity files from `~/.claude/guya/` (soul, user profile, growth tracker)
2. Constantia active tasks from `tasks/MANIFEST.md` (via `constantia-sync.mjs`)
3. Strategic guidelines from `~/.claude/guya/guidelines/strategic/`
4. Project-local core memory from `.guya/memory/core/`
5. Project-local tactical guidelines from `.guya/evolution/guidelines/tactical/`
6. Reflection backlog nudge (if /guya-evolve hasn't run recently)

The assembled block is injected as a system-reminder; Guya does not need to manually read identity files during a session.

### Pre-Commit Review Gate

`guya-pre-commit-review.mjs` is invoked by `guya-pre-bash-dispatch.mjs` on every Bash command (and directly on `PreToolUse:Skill`). It checks `review-gate.json` and `review-evidence.jsonl`. If no review evidence exists or the gate is not cleared, the hook returns a `block` decision and instructs Daniel to run a review first. After a successful commit, the post-commit scribe resets the gate and deletes the evidence file.

The dispatcher pattern was introduced 2026-04-24 specifically because the gate was silently bypassed for 16 days under Claude Code's 2.1.101+ matcher-dedup regression — same failure mode as ADR-011 (auto-fire silently breaks): rely on hook execution, verify hook execution.

**Auto-evidence recording (working as of 2026-04-27, ADR-013):** When `/guya-review` or `/guya-deep-review` is invoked via `PreToolUse:Skill`, `guya-pre-commit-review.mjs` calls `appendStep()` to write a row into `review-evidence.jsonl` automatically — no manual Step 0 in the SKILL.md required. This had been silently no-op'ing since the symlinked plugin install became the dispatch path, because every hook gated `main()` with `fileURLToPath(import.meta.url) === process.argv[1]` and Node 24 resolves the LHS to the realpath while the RHS keeps the symlink path. Five hook scripts were patched to wrap both sides in `realpathSync()`: `guya-pre-commit-review`, `guya-correction-detect`, `guya-post-commit-scribe`, `guya-session-start`, `guya-session-end`.

### Hook Smoke Test (defense against silent-no-op class)

`guya-plugin/hooks/__tests__/hooks-smoke.test.mjs` walks every entry in `hooks.json`, spawns the script through the **symlinked** plugin install path with a benign payload, and asserts non-empty stdout. Empty stdout is the universal signature of the silent-no-op failure mode (hook registered, hook dispatched, `main()` never reached). It is wired into `guya-pre-push-check.mjs` as a gate named `guya-hook-smoke`, which runs only when the test file exists (skipped cleanly in repos that don't ship it). Verified by reverting `realpathSync` to the broken `===` comparison in one hook — smoke fails with the bug name in the assertion message; restoring the fix turns it green. This is a structural defense against the class of regression captured in ADR-011/012/013, not a fix for any single instance.

### MCP Server (guya-tools)

The MCP server runs as a stdio process (registered in Claude Code's MCP config). It exposes 14 tools across four groups: memory, introspection, evolution, and identity. Tool groups are loaded conditionally so the server starts even if a group file is missing.

### guya-setup Skill

The `guya-setup` skill installs the git post-commit hook into any repo's `.git/hooks/post-commit`. The installed hook: checks that `.guya/` exists in the repo root (guard against non-guya repos), resolves the versioned plugin cache path dynamically, and invokes the scribe with a synthetic payload. This makes the post-commit scribe portable to any guya-enabled project without requiring the full guya source tree.

### Telos Runtime — Cross-Repo Architecture

Telos (the mentor agent in the three-identity architecture, ADR-009) is no longer just identity files — as of 2026-05-04 it is a running, autonomous agent with hands. It has its runtime in a separate git repo (a fork of nanoclaw at `daniellee6925/nanoclaw`, checked out locally at `~/Desktop/telos` and on the Mac Mini at `/Users/guya/telos`), writes into a third repo (`daniellee6925/constantia`), and gets woken on a schedule.

**Post 2026-05-11 reorg snapshot (Phase 4 deployed — all three Telos sessions live).** The full design + plan + content checklist is in `docs/2026-05-08-telos-reorg.md` (canonical reference for the new state). Per-phase rollback in `docs/2026-05-08-rollback-runbook.md`. Pre-reorg state snapshot in `docs/2026-05-08-pre-reorg-state.md`. Phase 3 mini deployment runbook + 5-pattern lessons-learned appendix in `docs/2026-05-10-phase3-deploy-runbook.md`. Phase 4 mini deployment runbook (with L1-L5 baked in as inline `[L#]` callouts, plus two new L6/L7 patterns from this deploy) in `docs/2026-05-11-phase4-deploy-runbook.md`.

Key shifts from prior state:
- **Constantia task schema** split into 4 sibling dirs: `tasks/{proposals,tasks,learn,learn/curricula,reminders,archive/2026-05-07}/`. Plain numeric priority `1|2|3` across proposals/tasks/learn (supersedes ADR-017's T/P prefix). Per-dir lifecycle enums. Reminder `schedule_type` + flat `schedule_at`/`schedule_expr` fields. 17 legacy TASK files archived.
- **Telos work session** runs new tick rhythm: 9am morning + 1pm midday (NEW) + 9pm evening + 11pm reflection. New tick prompts in `groups/telos/tick-{morning,midday,evening}-prompt.md`. Reflect prompt unchanged. CLAUDE.local.md tool inventory updated. **As of 2026-05-10**, work session migrated from Discord DM (`@me:1497671629008801843`) to server channel `discord:1497671232139825232:1503157287416496242` (#telos-work). Agent group `ag-1777143186174-ykqd40`, session `sess-1777143186178-0bacbi`.
- **MCP tool inventory grew from 7 to 12.** New: `propose_task` (writes T-NNN with target field), `assign_learn` (writes L-NNN with curriculum check), `add_reminder` (R-NNN with flat schedule fields), `grade_learn` (mirrors grade_task for L-tasks), `read_curriculum` (read-only fetch). `acceptProposal` rewritten for target-field routing (target=task spawns P-NNN; target=learn spawns L-NNN with curriculum existence check; target=curriculum promotes proposal body to `learn/curricula/<id>.md`).
- **Shared MCP tools dir (NEW 2026-05-10, fork commit `ce5b0d5`).** Per-group `tools/` directories retired in favor of a single source of truth at `shared/telos-tools/` in the nanoclaw fork. Each Telos session container mounts this same dir at `/workspace/extra/telos-tools/` via `additionalMounts`; `mcpServers.<name>.command` invokes `bun run /workspace/extra/telos-tools/mcp-server.ts`. Closes the ADR-013-style drift risk that 3 copies of mcp-server.ts (one per session) would have created. Fork `.gitignore` allowlists `shared/telos-tools/**`. Mount allowlist on mini extended to include `~/telos/shared/telos-tools` as an allowed root.
- **3-session Telos architecture (all three live as of 2026-05-11).**
  - **Work session (live):** existing session preserved (114-message history retained); now bound to #telos-work server channel. Group folder `groups/telos/`. Tick cadence: 9am morning / 1pm midday / 9pm evening / 11pm reflection. **As of 2026-05-19:** WORK's proactive-DM destination row was removed from the central `agent_destinations` table (v2.db on mini) and from the per-session `destinations` projection. WORK now has channel-only routing for proactive tick output (#telos-work). Reactive DM replies to Daniel still work via the scratchpad-fallback path on incoming routing (the incoming message's `platform_id`/`channel_type` is reused for the reply).
  - **Learn session (live as of Phase 3):** Socratic mentor + /guya-learn methodology + WebSearch/WebFetch. Group folder `groups/telos-learn/`. Agent group `ag-1778451576000-learn`, session `sess-1778451576000-learn`, Discord channel `discord:1497671232139825232:1503155725785104524` (#telos-learn). Five tick crons at 10am/1pm/4pm/7pm/10pm PT. End-to-end smoke verified.
  - **Life session (live as of Phase 4, 2026-05-11):** Korean default + 두식 persona (off-duty register, 아버지 facet leading) + 5 daily ticks. Group folder `groups/telos-life/`. Agent group `ag-1778531816000-life`, session `sess-1778531816000-life`, messaging_group `mg-1778531816000-life`, messaging_group_agents `mga-1778531816000-life`, Discord channel `discord:1497671232139825232:1503157300922417232` (#telos-life). Five tick crons at 10am morning / 12pm bodycheck / 6pm transition / 8pm workout / 11pm close PT. End-to-end smoke verified: Daniel-DM `안녕` → routed → spawn → 두식 voice (`오늘 어떻게 지내셨어요, 형님. 몸은요?`). LIFE addendum is the first place to use **합쇼체 and 해요체 modulated fluidly within messages** (vs WORK's single-register baseline) — openers and pattern calls lean 합쇼체; pushback and direct demands lean 해요체. Audrey is referred to as **매님** (cohabitation context); reminders are **알림 not 알람**. Pattern detection is presence-quality based (3+ friction mentions in 2 weeks), not absence-streak based — life is cohabiting, not periodic. Tool subset is narrow on purpose: `add_reminder`, `read_today_transcript`, `do_nothing` only — NO `write_evidence`, NO `grade_*`, NO `propose_task` (LIFE is presence, not portfolio). Profile writes to `profile/relationship.md` + `profile/health.md` allowed via Edit/Write directly when meaningful sustained shift surfaces. Reminders will fire into this session's `inbound.db` via launchd in Phase 5.
  - Sessions share Constantia for memory; per-session CLAUDE.local.md addenda enforce tone separation. All three sessions share `shared/telos-tools/` for MCP code.
- **`messaging_group_agents` is a load-bearing routing row (discovered 2026-05-10).** Wiring a new Telos session to a Discord channel requires FOUR coordinated rows in nanoclaw's `v2.db`, not three: (1) `messaging_groups` defines the destination, (2) `agent_groups` defines the agent, (3) `sessions` links agent_group to messaging_group, (4) **`messaging_group_agents`** is the routing link that tells nanoclaw "incoming messages on this messaging_group should wake this agent_group." Without (4), the bot still receives Gateway events but silently drops them — no `Message routed` log, no inbound DB row, no Telos response. Mandatory for any future session bootstrap. See ADR-020.
- **Constantia post-commit hook now guards rebase/cherry-pick/merge state (NEW 2026-05-10, constantia commit `7095f49`; partially superseded 2026-05-16).** Hook used to run `git commit --amend` + `git push` unconditionally. When `commitAndPush` did `git rebase origin/main` and replayed N local commits, the hook fired per replayed commit, amend failed during cherry-pick (illegal operation), MANIFEST regeneration dirtied the working tree, the next rebase step aborted, and the local commit stayed unpushed. 9 Telos commits stranded for 2 days before noticed. Fix: hook checks for `$GIT_DIR/{rebase-merge,rebase-apply,CHERRY_PICK_HEAD,MERGE_HEAD}` at top and exits 0 with a stderr log line if any exists. See ADR-019. **Update post-ADR-024:** containers no longer rebase at all (the daemon does, on host APFS where rebase actually works), and the post-commit hook's auto-push has been removed (the daemon is the only pusher). The guard is still in place — it now defends the host-side daemon's own rebase cycle, since the daemon shells the same hook when it commits during conflict-recovery operations.
- **Mini-side launchd plist patched for Docker discovery (NEW 2026-05-10).** `~/Library/LaunchAgents/com.nanoclaw-v2-53edea47.plist` `EnvironmentVariables.PATH` now prepends `/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:` to the original launchd-spawn PATH. Required because launchd's strict env doesn't inherit shell env, and nanoclaw's `docker info` startup check needs Docker.app bin reachable or it crash-loops on every restart. Backup at `<plist>.pre-phase3.bak`. See ADR-021.
- **Reminder firing infra planned** (Phase 5): launchd plist `com.guya.reminder-fire.plist` runs `scripts/check_reminders.sh` every minute. Script reads `tasks/reminders/R-*.md` as single source of truth, evaluates schedule + last_fired, inserts message into life session's `inbound.db` when due, updates last_fired in R file. No second state store (no nanoclaw cron rows for reminders) — drift impossible. Per Phase 3 lesson 4, the plist will need Docker.app + Homebrew in PATH if the script ever shells to docker.

The historical narrative (3-layer build through 2026-05-04 PM, 6-tool MCP server, twice-daily tick, single session) is preserved below for context — **but the current state is post-reorg.** Where they conflict, the post-reorg snapshot above is authoritative.

The runtime spans three layers — **action**, **memory**, **reflection** — built incrementally through 2026-05-04 PM, then schema-migrated and tool-extended through 2026-05-08.

**Cross-repo map.**

| Repo | Path on local | Path on mini | What lives there |
|------|---------------|--------------|------------------|
| guya | `~/Desktop/guya` | — | Design docs (`telos context/vision.md`, `core-beliefs.md`, `goal.md`, `STATUS.md`); operations runbook |
| nanoclaw fork | `~/Desktop/telos` | `/Users/guya/telos` | Runtime harness + per-session Telos identity (`groups/telos/`, `groups/telos-learn/`, future `groups/telos-life/`) + **shared MCP tools (`shared/telos-tools/mcp-server.ts`)** mounted into all session containers + per-session tick prompts (`groups/<group>/tick-*.md`) |
| constantia | `~/Desktop/constantia` | `/Users/guya/constantia` (mounted into container at `/workspace/extra/constantia`) | Runtime data: `tasks/`, `log/guya/`, `log/telos/` (tick + reflection), eventually `evidence/` and `profile/`; `goals/pillars.md` |

The split honors core-beliefs §5 ("fork the harness, hand-roll the mentor core"): the harness — channels, containers, scheduling, credential vault, skill system — comes from nanoclaw and is modified directly. The mentor core — soul, operating contract, tick reasoning loop, MCP tools — is hand-rolled inside `groups/telos/`. Soul straddles both: it lives with the runtime (so the agent loads it directly into its system prompt) but its design rationale lives in `telos context/vision.md` §7.

**Identity layer (shipped 2026-05-03, fork commits `03604e6`, `ae13524`).** `groups/telos/soul.md` (long-form identity) and `groups/telos/CLAUDE.local.md` (binding operating contract — voice register, behavioral bans, first-contact protocol, language rule, pushback calibration, asymmetric-knowledge handling, calibration samples, Constantia-awareness section) are committed and version-controlled via `.gitignore` overrides on the fork. `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` reads `/workspace/agent/CLAUDE.local.md` at every spawn and injects it as the system-prompt identity block (replacing the auto-generated "Your name is **Telos**"). Empty file preserves auto block — non-breaking for other groups.

**Layer 1 — Action layer. MCP server `telos-constantia` (shipped 2026-05-04, fork commit `a0c7909`; expanded same day; relocated to shared dir 2026-05-10, fork commit `ce5b0d5`).** Hand-rolled stdio JSON-RPC at `shared/telos-tools/mcp-server.ts` (was `groups/telos/tools/mcp-server.ts` pre-Phase-3; now ~1255 LOC after Phase 2b growth — over the 800 LOC limit; helpers extract cleanly into a separate file as a follow-up). No `@modelcontextprotocol/sdk` dep — keeps surface area visible, avoids npm install at container spawn. Each session container mounts the shared dir at `/workspace/extra/telos-tools/` via `additionalMounts` and points `mcpServers.telos-constantia.command` at `bun run /workspace/extra/telos-tools/mcp-server.ts`. Single source of truth across work / learn / future life sessions — no N-copy drift risk (ADR-022). Six tools (pre-reorg snapshot — Phase 2 grew this to 12):

| Tool | Layer | Purpose | Constantia file |
|------|-------|---------|-----------------|
| `assign_task` | action | Create new task with structured frontmatter (id, status=assigned, **priority P1\|P2\|P3 — required**, pillar 1\|2\|3\|none, assigned_by, purpose ≥10 chars, acceptance ≥10 chars, grade=null) + Context body | `tasks/TASK-NNN.md` (auto-incremented) |
| `accept_proposal` | action | Accept a Guya-proposed task (status: proposed → assigned). Requires **priority P1\|P2\|P3** (T → P conversion is unbound — picked fresh by Telos, not bound to the proposal's T value). Pillar may be rewritten to `1\|2\|3\|none` for rubric anchoring. Closes the proposed → assigned → graded/rejected lifecycle | `tasks/TASK-NNN.md` |
| `grade_task` | action | Update existing task to terminal state — `outcome=graded` requires `grade` (A/B/C) + `grade_evidence` ≥10 chars; `outcome=rejected` requires `rejection_reason` ≥10 chars. Frontmatter only, body preserved. | `tasks/TASK-NNN.md` |
| `do_nothing` | action | Append timestamped no-op section to today's tick log with `reason` (≥20 chars) and optional `next_check`. Default tick decision — action without reason is noise. | `log/telos/YYYY-MM-DD-tick.md` |
| `write_reflection` | reflection | Write nightly synthesized reflection with 8 sections: `what_happened`, `key_decisions`, `patterns_observed`, `what_daniel_should_take_away`, `what_telos_should_change`, `evidence_candidates`, `open_threads`, `next_priorities`. Refuses to overwrite an existing same-day reflection (file-existence guard is the truth source — not the conversation transcript) | `log/telos/YYYY-MM-DD-reflection.md` |
| `read_today_transcript` | reflection (read-only) | Open nanoclaw's `inbound.db` + `outbound.db` read-only via `bun:sqlite`, return Daniel↔Telos messages merged by timestamp for a given PT day. Mounted at `/workspace/extra/telos-session` (read-only, `additionalMounts` entry in `groups/telos/container.json`, allowlist updated) | none (read-only) |

The full task lifecycle (proposed → assigned → graded/rejected) closed end-to-end on real artifacts on 2026-05-04: TASK-001 graded B, TASK-003 rejected, TASK-009 closed.

**Layer 2 — Memory layer (symmetric tick logging, NEW 2026-05-04 PM).** Every action tool now calls `appendTickLogSection` to write a section to `log/telos/YYYY-MM-DD-tick.md` BEFORE its commit, so action ticks leave the same trail no-ops do. Previously only `do_nothing` wrote to the tick log, leaving action ticks invisible in the daily record.

Each action/no-op tool follows the same pipeline (post ADR-024 — container commits only; the host daemon owns push):

```
validate args
        │
        ▼
write atomically: fs.writeFile(`${path}.tmp.${pid}`) → fs.rename(tmpPath, path)
        │ (POSIX-atomic rename — process kill mid-write leaves either old file
        │  intact OR new file complete, never half-written)
        │
        ▼
appendTickLogSection → log/telos/YYYY-MM-DD-tick.md
        │ (every action tool writes a section before committing — symmetric
        │  with do_nothing; action ticks no longer invisible in the daily log)
        │ (returns its log path so the caller can include it in commitOnly's paths)
        │
        ▼
commitOnly(message, paths):
        git add -A <paths>           (explicit paths — no naked `git add -A`)
        git commit -m "<message>"     (NO fetch, NO rebase, NO push)
        git rev-parse HEAD
        │
        └─► return {sha, committed: true}

        ─── host-side, asynchronously ──────────────────────────────────────
        constantia-sync daemon polls every 5s on mini's native APFS:
          git fetch + rebase + push, writes .git/sync-status.json.
        See "constantia-sync Daemon" subsystem above + ADR-024.
```

Pre-ADR-024 the tool itself ran `git fetch + rebase + push` and surfaced `pushed: false` in the Discord report on failure. That layer is gone — push happens out-of-band on the host. The tool's contract is "your write is committed locally on mini's main"; the daemon ensures it reaches origin. Concurrent containers no longer race on `git add -A` (each call specifies the paths it wrote). Handlers are still serialized via a promise chain (`tail = tail.then(() => handle(req))`) so concurrent stdin reads can't race on shared state (next-NNN computation, tick-log append, git config setup).

**Layer 3 — Reflection layer (NEW 2026-05-04 PM; reasoning-bug patched 2026-05-05).** Nightly synthesized memory. The reflection cron fires at 23:00 PT, Telos reads the day's transcript + tick log + Guya logs + profile, synthesizes the 8 sections defined by `write_reflection`, calls the tool to persist `log/telos/YYYY-MM-DD-reflection.md`, then DMs a synthesis highlight to Daniel. The protocol lives in `groups/telos/reflect-prompt.md`. Distinct from the tick prompt — different grounding inputs, different output shape, different output file.

The reflection schedule was seeded by direct sqlite INSERT into nanoclaw's `inbound.db` `messages_in` (id `task-17779308213N-rfltky`, recurrence `0 23 * * *`, body = `Read /workspace/agent/reflect-prompt.md and execute it as today's reflection.`). First fire 2026-05-04 23:00 PT.

**Reflect-prompt reasoning-bug fix (2026-05-05, fork commit `44a54fe`).** Two bugs surfaced when the 23:00 PT cron fired against an intentionally-cleared reflection slot:
- **(A) Truth source confusion.** Telos saw "duplicate cron fire" chatter in its own DM transcript and pre-judged the reflection already-written without checking the file. It then wrote placeholder content over the cleared slot. Fix: §1 explicit instruction "the truth source is the file, not the transcript" — `write_reflection`'s file-existence guard is the only authoritative duplicate check.
- **(B) DM contract violation.** The bug-report DM ("overwrite protection isn't working") replaced the synthesis DM, so Daniel got a debug message instead of the day's synthesis. Fix: §4 reframed — the synthesis DM is the daily contract that always sends; anomalies go in a SEPARATE second DM. Restored the 2026-05-04 reflection content from constantia commit `807fb0b` after the placeholder overwrite (constantia commit `80dad30`).

Git auth uses an ed25519 deploy key at `~/.config/nanoclaw/constantia-deploy-key` on the mini, public half attached to `daniellee6925/constantia` GitHub Deploy Keys with write access. Bind-mounted as a single file at `/workspace/extra/ssh-key/constantia-deploy-key` (sidesteps the mount-allowlist `.ssh` directory block). `GIT_SSH_COMMAND` in `container.json` `mcpServers.telos-constantia.env` references it with `StrictHostKeyChecking=no UserKnownHostsFile=/dev/null`. Narrow blast radius — a compromised container can write only to constantia.

**Scheduled tick (shipped 2026-05-04).** Telos is autonomous. The reasoning loop fires twice daily without anyone pinging it.

```
nanoclaw inbound.db `messages_in`
  id:          task-1777913406295-908sio
  recurrence:  0 9,21 * * *   (9am + 9pm PT)
  first fire:  2026-05-04 21:00 PT
  prompt:      "Read /workspace/agent/tick-prompt.md and execute it as a tick."
        │
        ▼ on fire
        │
nanoclaw delivers prompt to Telos's Discord session path (same wake mechanism as a DM)
        │
        ▼
Telos reads `groups/telos/tick-prompt.md` and runs the protocol:
        │
        ├─ 1. Ground   → read pillars.md, tasks/MANIFEST.md (incl. priority column), log/ (3 most recent), profile/
        ├─ 2. Decide   → exactly one of {assign_task, accept_proposal, grade_task, do_nothing}; default do_nothing
        │                action priority: grade > accept > kill-stale > assign > nothing
        │                within a category: pick highest task priority (P/T); pillar work wins over `pillar: none` at equal priority
        ├─ 3. Act      → call MCP tool (priority arg required for assign/accept); receive {sha, pushed}
        └─ 4. Report   → DM-only synthesis; mention pushed:false if it occurred
```

The schedule was registered by Telos itself calling nanoclaw's existing `schedule_task` MCP tool. Persisted in `inbound.db` `messages_in`, survives container kills and daemon restarts. Manually invoking a tick mid-day = DM Telos with the tick-prompt content directly, or trigger `schedule_task` for a one-shot run. Full Operations Runbook (edit → kill container → clear continuation cycle, MCP server hot-reload, per-agent image rebuild conditions, deploy-key setup) lives in `telos context/STATUS.md` §A–§I.

**Container prerequisites baked into base Dockerfile (fork commit `de945fd`).** Two additions required for `git push` from inside the container, both idempotency-guarded:
1. `openssh-client` in the apt list — `node:22-slim` ships without it, so `GIT_SSH_COMMAND` had nothing to invoke (failed with `ssh: not found`).
2. Synthetic `agent:x:501:20::/tmp:/bin/bash` `/etc/passwd` entry, guarded by `getent passwd 501 || ...` — the container runs as host uid 501 on macOS, which has no passwd entry by default, so ssh's `getpwuid(501)` returned null and ssh refused (`No user exists for uid 501`).

Both additions are in the base image as of `de945fd`; fresh installs of this fork won't need a per-agent rebuild for them. The currently-running per-agent image on the mini (`nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40`, referenced in `container.json` `imageTag`) was built manually before the bake-in landed and carries the same modifications.

**Constantia data flow (Telos's writes).**

```
Telos tick fires (cron: 0 9,21 * * *)
    │
    ├─► assign_task      ──► tasks/TASK-NNN.md           (status: assigned)
    │                        + log/telos/YYYY-MM-DD-tick.md (action section)
    ├─► accept_proposal  ──► tasks/TASK-NNN.md           (proposed → assigned)
    │                        + log/telos/YYYY-MM-DD-tick.md (action section)
    ├─► grade_task       ──► tasks/TASK-NNN.md           (status: graded|rejected)
    │                        + log/telos/YYYY-MM-DD-tick.md (action section)
    └─► do_nothing       ──► log/telos/YYYY-MM-DD-tick.md (no-op section)

Telos reflection fires (cron: 0 23 * * *)
    │
    └─► write_reflection ──► log/telos/YYYY-MM-DD-reflection.md
                            (8 sections; refuses overwrite for same day)
                            │
                            ▼ (every tool, same path — post ADR-024)
                    commitOnly(message, paths): git add -A <paths> + commit
                    (NO push — container can't push through the bind mount)
                            │
                            │ local commit on mini's main
                            ▼
                    constantia-sync daemon (host APFS, every 5s):
                        fetch + rebase + push to daniellee6925/constantia
                            │
                            ▼
                    Guya reads on next session-start
                    (+ readSyncStatus surfaces daemon health in <guya-context>)
                    (tasks/MANIFEST.md → priority-0 context; profile/ via /guya-evolve)
```

**Cross-repo HEAD snapshot (2026-05-11 PT — post reorg Phase 4).** All three converged at the SHAs below.

| Repo | HEAD | Pre-reorg tag |
|------|------|---------------|
| `daniellee6925/guya` | `ff58f86` (5/8 design docs + 5/10 STATUS + 5/11 Phase 4 STATUS update + Phase 4 deploy runbook) | `pre-reorg-2026-05-08` at `7f11634` |
| `daniellee6925/nanoclaw` | `317e4e6` (Phase 4 fork-side: telos-life group skeleton + 두식 LIFE addendum + 5 tick prompts + container.example; deployed to mini) | `pre-reorg-2026-05-08` at `2270de8` |
| `daniellee6925/constantia` | `b14215a` (carry-over from Phase 3 — no Constantia changes in Phase 4; LIFE has not yet produced any commits since first natural fire is tonight 6pm PT) | `pre-reorg-2026-05-08` at `b5b6873` |

**Known carry-forwards.**
- `mcp-server.ts` grew to 1255 LOC in Phase 2b (was 834 LOC pre-reorg). Now well over the 800 LOC LLM-design-pattern limit. Time to extract: per-tool handler files (one per category — tasks, learn, reminders, evidence, reflection, etc.) + a shared validators module. Phase 3 relocation to `shared/telos-tools/` did not change LOC.
- Inline validation logic across 9 tool handlers — extract to `validators.ts` to lock the calibration rule and other invariants under unit tests.
- Test debt: Phase 2 added ~600 lines TS with zero new tests. Phase 3 added the rebase-guard interaction (constantia hook + commitAndPush) with zero new tests. Phase 1 helpers tests still cover only pure functions.
- Post-commit manifest hook globs working-tree files including untracked. Low priority.
- nanoclaw spawns the shared-dir MCP server via `bun /workspace/extra/telos-tools/mcp-server.ts` directly — no compile step for the tools themselves (only `src/` compiles to `dist/`). Future Telos tool changes deploy via push + pull on mini + restart, no `pnpm build` for tools.
- ~~`commitAndPush` returns `pushed: false` silently on rebase abort.~~ **Resolved 2026-05-16 (ADR-024):** `commitAndPush` was retired in favor of `commitOnly(message, paths)`; the container no longer attempts rebase/push. The host-side `constantia-sync` daemon owns push and surfaces failures via `<constantia>/.git/sync-status.json`, which Guya's session-start hook reads and alerts on. The original silent-rot mode (rebase abort burying a real bind-mount issue for 2 days) was the diagnostic trigger for ADR-024.
- `guya-hook-smoke` does not yet have a synthetic-rebase test that asserts the constantia post-commit hook guard fires correctly. Without it, a future hook edit could re-introduce the silent-rot regression that ADR-019 fixed.

---

## Target Architecture

### Daemon (v2 — deferred)

ADR-004 deferred a Guya-side background daemon to v2. The current hook-native architecture still has no persistent process between sessions for Guya itself. Two other persistent processes now exist in the wider system but neither fills the executor-side daemon role: (a) Telos runs as a persistent process via nanoclaw on the mini — that's the mentor surface; (b) `constantia-sync` (ADR-024) runs as a launchd job on the mini — that's the data-plane sync between container-side commits and origin. Both are infrastructure for the three-identity system, not the Guya-executor daemon ADR-004 contemplated. A future Guya-side daemon would still enable:
- Proactive reminders and scheduled tasks without requiring a Claude Code session
- Richer cross-session state accumulation
- Real-time convergence tracking without session-end triggering

### Two-Track Learning Completion (v2)

Phase 6 delivered the slow LLM track (haiku classify → sonnet synthesize). The fast heuristic correction track (guya-correction-detect.mjs) fires on UserPromptSubmit but the feedback loop that promotes validated heuristics into guidelines is not yet closed. The target is: fast track validates → confidence threshold → auto-promotes to tactical guideline.

### Cross-Project Memory Surfacing

Currently, global strategic guidelines accumulate at `~/.claude/guya/guidelines/strategic/` but there is no active mechanism to surface cross-project patterns during context assembly beyond the static file read. The target is a lightweight similarity search that pulls the most relevant strategic guidelines for the current project's domain.

### Convergence Tracking (Daniel-specific, ADR-008)

The soul spec includes convergence tracking (detecting when Daniel is scattered vs. focused). This is referenced in identity files but not yet implemented as a measurable signal in the evolution pipeline.

### Telos — Phase 5 (reminder firing infra)

`scripts/check_reminders.sh` in Constantia (~50 LOC: read R-*.md, evaluate `schedule_type` + `schedule_at`/`schedule_expr` + `last_fired`, insert message into life session's `inbound.db` when due, update `last_fired`). Installed as `~/Library/LaunchAgents/com.guya.reminder-fire.plist` on mini (every-minute cron). **Plist PATH must include `/Applications/Docker.app/Contents/Resources/bin` and `/opt/homebrew/bin`** if the script ever shells to docker — same lesson as ADR-021. Smoke test with synthetic R-task at "now+90s" + recurring `* * * * *` (then immediately retire). R-files are single source of truth — no nanoclaw cron rows for reminders, drift impossible by design.

### Telos — Phase 6 (validation + cutover)

24-hour observation: all 13 ticks fire across work/learn/life. Day-2 review with Daniel. Add ADR-018 entry to CLAUDE.md (post-reorg schema). Mark ADR-017 as superseded by ADR-018. Update STATUS + ARCHITECTURE.

### Telos — `write_evidence` MCP Tool

The next deferred surface area on `telos-constantia` — Cut B continues. Mirrors `assign_task` shape: validate → atomic write → commit → push. Creates `evidence/EVD-NNN.md` with frontmatter (`id`, `category`, `source`, `confidence`, `observation`, `assessment`). The reflection layer already flags evidence candidates each night via the `evidence_candidates` section of `write_reflection` — `write_evidence` is what asserts those candidates as formal claims with confidence + source. Gated on first observing reflection judgment quality across a few nights — more surface area should follow trust in the current surface, not precede it.

### Telos — Profile Maintenance

After `write_evidence` lands. Telos appends evidence-pointed claims to `profile/strengths.md`, `profile/weaknesses.md`, `profile/trajectory.md`, etc. Each claim cites the EVD-NNN that grounds it (no orphan assertions). Open question: dedicated `update_profile` MCP tool versus direct `Read`+`Edit` on the mounted files. Direct edit is simpler but loses the validate→atomic-write→commit pipeline; a tool inherits it for free.

### Telos — Pattern Detection Layer

A separate process (not the tick) that watches the log/evidence stream, applies the active-threshold (3-in-2-weeks) and absence-threshold (2 consecutive weeks of an expected recurring behavior failing to occur) rules, and produces a `patterns-active.md` file Telos's tick reads during grounding. Decouples slow pattern recognition from per-tick reasoning. Discussed in the asymmetric-knowledge architecture conversation.

### Telos — Critic Sub-Agent (vision §M3, Belief #1)

Required for core-ring decisions (vision §5 three-ring friction model — core/adjacent/outer). Critic challenges proposed task assignments and grading judgments before they ship. Architecture pattern from Belief #1: independent reasoner reading the same grounding context, returning veto + reason rather than rewriting the action. Comes after the basic tick + evidence loop is observed reliable.

### Telos — Director Role with Multi-Hypothesis Paths (vision §M4, Belief #6)

Director proposes multiple hypothesis paths for a pillar gap rather than a single task. Tick selects across paths instead of acting on the first viable assignment. Far out — depends on profile, pattern detection, and critic all being live so the director has signal to weigh paths against.

### Telos — Three-Ring Friction Model (vision §5)

Adjacent + outer ring routing on top of the core-ring tick. Core ring is the current tick (assign/grade/do_nothing on Daniel's pillars). Adjacent ring is work that touches a pillar but isn't the central path. Outer ring is mentor-of-mentor reflection (Telos critiquing its own profile updates). Comes after core-ring reliability is established.

### Telos — Long-Horizon Observability / Mentor-Health Report (vision §M5)

Drift detection on Telos's own behavior — is the tick defaulting to `do_nothing` because state is healthy or because grounding is failing? Are assignments distributing across pillars or biasing toward one? Mentor-health report is a periodic (weekly?) synthesis Daniel reads to verify Telos hasn't quietly degraded. Same meta-pattern as the guya hook smoke test (ADR-013) — silent rot of trusted enforcement is the failure mode to defend against.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-30 | Hybrid platform (ADR-001) | Core owns identity; Claude Code provides hooks/skills/MCP |
| 2026-03-30 | Fully autonomous evolution, no approval gates (ADR-002) | Minimum friction |
| 2026-03-30 | Universal scope (ADR-003) | Daniel uses Guya across all domains |
| 2026-03-30 | Hook-native v1, daemon deferred (ADR-004) | Minimal infra, ship fast |
| 2026-03-30 | Global identity + project-local memory (ADR-005) | Recognition everywhere + project specificity |
| 2026-03-30 | Two-track learning: fast regex + slow LLM (ADR-006) | Immediate corrections + async pattern learning |
| 2026-03-30 | Challenge first, support second (ADR-007) | Genuine care + growth over comfort |
| 2026-03-30 | Daniel-specific amendments: convergence, SCOPE, teaching, emotional awareness (ADR-008) | Generic agent behavior does not serve Daniel's growth |
| 2026-04-10 | PostToolUse:Bash does not dispatch in Claude Code; specific tool names other than wildcards and compound matchers are dead | Confirmed via debug commits 70cd82a–c96c71a |
| 2026-04-10 | Post-commit scribe invoked from .git/hooks/post-commit via synthetic payload rather than PostToolUse:Bash | PostToolUse:Bash non-dispatch; git hook is the reliable trigger |
| 2026-04-10 | sync-plugin.sh + git post-commit hook together form the plugin delivery pipeline | Claude Code reads from plugin cache, not source; sync must happen before scribe runs the latest scripts |
| 2026-04-10 | guya-setup skill added: installs post-commit hook into any guya-enabled repo | Makes scribe portable without requiring full guya source tree |
| 2026-04-10 | PostToolUse hooks.json simplified to Write\|Edit only; Bash entry removed as dead code | Removes maintenance burden of a non-dispatching entry |
| 2026-04-11 | `~/.claude/guya/` initialized as git repo | Every /guya-evolve self-edit lands as a discrete commit; full revert history for identity-layer changes |
| 2026-04-11 | Reflection-driven synthesis replaces trace-driven synthesis | Reflections are pre-distilled high-signal input; traces were raw noise that produced near-zero useful guidelines over 6 days |
| 2026-04-11 | Manual /guya-evolve invocation, not auto session-end trigger (amends ADR-002) | Auto-fire invited silent rot (API key died for 6 days unnoticed). Reflections are deliberate; consumption should be too |
| 2026-04-11 | Tiered blast-radius routing: auto-apply for guidelines + user.md additions; per-item approval for soul/identity/growth-tracker edits | Low-blast edits don't need per-item gates; identity edits do |
| 2026-04-11 | Anti-oscillation guardrail: identity proposals require ≥2 source reflections | Single-reflection identity edits risk mood-of-the-day oscillation; momentum threshold filters noise |
| 2026-04-11 | guya-evolve and guya-self-edit merged into single skill | Less complexity; the review IS the application; no proposed-edits queue needed |
| 2026-04-11 | SessionStart backlog nudge: soft one-liner showing reflection count + days since last evolve | Prevents "forgot to evolve" drift without being aggressive; computeReflectionNudge reads .last-evolved marker |
| 2026-04-13 | guya-scout skill added: 2-phase codebase onboarding (Explore subagent → scout-report.md → bidirectional Q&A) | Eval-validated: ~17% token efficiency gain; Phase 2 bidirectional Q&A is primary differentiator over baseline |
| 2026-04-13 | guya-decision-kickoff updated: Project Setup phase scaffolds context/core-beliefs.md, context/vision.md, ARCHITECTURE.md, STATUS.md for clean repos; guya-setup prompted for fresh repos; plan path aligned to docs/plans/PLAN_*/ (lod-planner format) | New repos need standard scaffolding to be guya-compatible from day 1; plan path alignment removes friction with lod-planner delegation |
| 2026-04-22 | Three-identity architecture: Guya (executor) + Telos (mentor) + Constantia (shared git repo) | Single source of truth between two independent agents; no memory divergence |
| 2026-04-22 | Constantia write ownership: no shared-write files. Guya writes log + task status; Telos writes evidence + profile + goals + grades | Eliminates merge conflicts by design |
| 2026-04-22 | Meaningful-only Constantia writes via /guya-reflect, not auto session-end | Signal over noise; every log entry has actual content |
| 2026-04-22 | Guya proposes tasks, Telos assigns | Clear authority boundary; no shared-write contention on task files |
| 2026-04-23 | Token budget raised from 2000→3000 tokens | Soul+user consumed 92% of old budget; no room for tasks or growth tracker |
| 2026-04-23 | Growth-tracker stays with Guya; guya-evolve reads Telos profile as additional input | Different purposes (session-level vs longitudinal); one reads the other, no sync needed |
| 2026-04-23 | Log filename: YYYY-MM-DD-{author}-{project}-{session_id}.md with pre-commit enforcement | Prevents cross-repo overwrites; each session gets its own file |
| 2026-04-24 | Single PreToolUse:Bash dispatcher (`guya-pre-bash-dispatch.mjs`) fans out to pre-commit-review + pre-push-check (ADR-012) | Claude Code 2.1.101+ semantically dedups matcher entries; multiple hooks per matcher silently collapse. Same failure mode as ADR-011 — silent rot of trusted enforcement |
| 2026-04-27 | `realpathSync` isMain guard in 5 hook scripts + symlink-path smoke test wired into pre-push-check as `guya-hook-smoke` (ADR-013) | Third silent-rot regression of trusted enforcement (after ADR-011 auto-fire and ADR-012 matcher dedup). `import.meta.url === argv[1]` quietly failed under the symlinked plugin install path, so `main()` never ran on `PreToolUse:Skill` and review evidence never recorded. Patching the guard fixes the instance; the smoke test (asserts non-empty stdout for every registered hook spawned through the symlinked path) is the defense layer for the class |
| 2026-05-03 | Belief #5 rewritten: fork the harness, hand-roll the mentor core (replaces "reference, don't fork") | Hand-rolling the harness was duplicative work that didn't teach Pillar 2; nanoclaw already solves containers/channels/scheduling. Hand-rolling the mentor core (tick loop, profile, critic, three-ring routing) is where taste develops. Sharp fork/scratch line determines structure of all future Telos code |
| 2026-05-03 | Vision §7 rewritten: three voices → unified 두사부일체 character with three facets (스승/아버지/보스) | One character, two cultural frames (두식/Telos). Mother→father swap is deliberate; warmth dimension replaced by "loyalty as investment" framing. All three facets always operative; default register 보스 |
| 2026-05-03 | Telos identity layer shipped — soul.md + CLAUDE.local.md committed to nanoclaw fork at groups/telos/, version-controlled via gitignore override | Identity is the spine the rest of Telos hangs off of; needed before tick loop, critic, or profile work. Gitignore override (`!groups/telos/soul.md`, `!groups/telos/CLAUDE.local.md`) keeps the two source-of-truth files versioned while leaving per-installation state (container.json, .claude-fragments, regenerated CLAUDE.md) local. Fork commit `03604e6` |
| 2026-05-03 | Telos identity injected via nanoclaw system-prompt addendum (ADR-014) | Project-memory loading was treated as background context; helper-bot defaults were winning attention. Patched `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` to read `/workspace/agent/CLAUDE.local.md` and use it as the identity block (replacing auto "Your name is X"). Empty file preserves auto block — non-breaking. Validated by 2026-05-03 14:52 PT smoke-test (5/5 prompts in-character). Fork commit `ae13524` |
| 2026-05-04 | Telos mentor MCP server shipped: 3-tool hand-rolled stdio JSON-RPC server | Telos can now write into Constantia (assign_task / grade_task / do_nothing) and push via deploy key. Hand-rolled (no `@modelcontextprotocol/sdk` dep) keeps surface area visible and avoids npm install at spawn. Each tool: validate → atomic write (tmp + rename) → git add → commit → push. Push failures don't fail the tool. Lives in nanoclaw fork at `groups/telos/tools/mcp-server.ts` (~500 LOC). Fork commit `a0c7909` |
| 2026-05-04 | Telos autonomous via scheduled tick using nanoclaw's `schedule_task` primitive | Twice daily (cron `0 9,21 * * *`, first fire 2026-05-04 21:00 PT). Tick prompt at `groups/telos/tick-prompt.md` walks Telos through ground → decide → act → report protocol. Fires the prompt as a regular message into the same Discord session path. Persists in `inbound.db` across restarts. Telos is now a mentor that runs without being pinged |
| 2026-05-04 | Constantia deploy-key strategy: ed25519, single-purpose, single-file mount | `~/.config/nanoclaw/constantia-deploy-key` on mini, public half attached to `daniellee6925/constantia` GitHub Deploy Keys with write access. Bind-mounted as a single file (sidesteps mount-allowlist's `.ssh` directory block) at `/workspace/extra/ssh-key/`. `GIT_SSH_COMMAND` in container.json `mcpServers.env` references it with `StrictHostKeyChecking=no UserKnownHostsFile=/dev/null`. Narrow blast radius — compromised container can write only to constantia |
| 2026-05-04 | openssh-client + uid-501 passwd entry baked into base nanoclaw Dockerfile | Two prerequisites for `git push` from inside the container, discovered during smoke-test arc: (1) base `node:22-slim` lacks ssh client (so GIT_SSH_COMMAND has nothing to invoke); (2) container runs as host uid 501 with no `/etc/passwd` entry (so `getpwuid(501)` returns null and ssh refuses). Both now in fork commit `de945fd`, idempotency-guarded (`getent passwd 501 || ...`). Fresh installs of this fork won't need the per-agent rebuild we did manually on mini |
| 2026-05-04 PM | Tick prompt rewritten with priority-ordered decision tree | `grade > triage proposed > kill stale > fill gap > do_nothing`. Forced rubric reads before any pillar-N grade or assign. `assign_task` hardened against synthetic pillar-slot-filling — pillars are lenses Telos grades through, not work-sources. Triage cap at 3 proposals queued. Validated same day on real artifacts: TASK-003 rejected (expired Slice 5 milestone, no rubric anchor), TASK-001 graded B (competent constantia-hooks implementation). Fork commit `87d2c4a` |
| 2026-05-04 PM | `accept_proposal` MCP tool — closes proposed→assigned transition | Previously Telos could create new tasks (`assign_task`) or reject any non-terminal task (`grade_task` rejected), but had no path for accepting a Guya-proposed task. New tool flips status to `assigned`, sets `assigned_by: telos`, optionally rewrites pillar/purpose/acceptance for rubric anchoring, optionally appends a context-addition note. ~60 LOC mirroring `assign_task` shape. Fork commit `87d2c4a` |
| 2026-05-04 PM | Symmetric tick logging via shared `appendTickLogSection` helper | Refactored `do_nothing`'s log-write into a helper called by every action tool (`assign_task`, `accept_proposal`, `grade_task`). Single commit per tool now writes both the task file (or no-op marker) AND the tick log entry. Fixes the inversion where action ticks left LESS trail than no-ops. Daily record in `log/telos/YYYY-MM-DD-tick.md` is now complete. Fork commit `87d2c4a` |
| 2026-05-04 PM | Nightly reflection layer: `write_reflection` + `read_today_transcript` (ADR-015) | Reflection-as-architecture: every night at 23:00 PT, Telos reads the day's actual conversational record (not just breadcrumbs he remembered to log), synthesizes 8 sections, writes structured reflection to Constantia, DMs Daniel a 2-3 sentence highlight. `read_today_transcript` opens nanoclaw's `inbound.db` + `outbound.db` read-only via `bun:sqlite` (mounted at `/workspace/extra/telos-session` per new `additionalMounts` entry + `mount-allowlist.json` update + daemon kickstart). 8 sections borrowed from `/guya-reflect`'s shape and extended with Telos-specific *evidence_candidates* + *next-tick priorities*. Includes self-accountability section (`what_telos_should_change`) — reflection is two-sided, not sycophancy with structure. Refuses to overwrite same-day reflection (cron double-fire safety). Schedule seeded directly via sqlite INSERT into `messages_in` (id `task-17779308213N-rfltky`, recurrence `0 23 * * *`) — automatic from day 0, no Telos self-scheduling step. Fork commit `87d2c4a` |
| 2026-05-04 PM | Constantia log layout: `log/guya/` + `log/telos/` subdirs (ADR-016) | 26+ flat files in `log/` were unscannable. Split by author (mirrors the architecture's ownership boundary). Filenames drop redundant `-{author}-` segment — author is now the directory. Telos uses single-trailing-segment names: `YYYY-MM-DD-tick.md` (combined daily action+no-op log) and `YYYY-MM-DD-reflection.md` (nightly synthesized memory). Pre-commit hook validates per-author regex and rejects log/ root with explicit error. Post-commit hook walks subdirs via `find` and adds Path column to log manifest. 23 existing logs migrated in single commit (`d33aa4e`). Hooks installed as symlinks in `.git/hooks/` on both laptop AND mini — closed the silent rot where mini's hook was missing entirely (only `pre-commit.sample` existed), letting `tick.md` filenames commit despite not matching the regex. Daniel's call (author-based) over my type-based proposal (`sessions/` + `reflections/`) — author-split mirrors ownership boundary cleanly |
| 2026-05-04 PM | DM-only routing locked at three layers | Earlier today Telos's first scheduled tick sent the substantive report to a Discord guild channel and a brief ack to the DM — inverted from intended. Three-layer fix: (a) tick-prompt step 4 explicit "DM only, do not broadcast"; (b) reflect-prompt step 4 same; (c) deleted server channel binding from `agent_destinations` + `messaging_group_agents` rows in `v2.db` so Telos can no longer route there even if the prompt drifts. Belt + suspenders against the next prompt-rewrite cycle |
| 2026-05-04 PM | Constantia hooks installed as symlinks (data-tier silent-rot fix; ADR-013 family) | Mini's `.git/hooks/` had only `pre-commit.sample` — Telos's commits had been bypassing all schema validation since Constantia's setup. Same meta-pattern as ADR-011/012/013 (silent rot of trusted enforcement living in a "this can't fail" guard), but at the data-validation tier instead of the harness tier. Both clones now symlink `.git/hooks/{pre,post}-commit` to `hooks/` source files; future hook edits auto-apply, no copy drift. The next fresh clone of constantia onto a new machine will need the symlink installed (consider a setup script if a third clone ever happens) |
| 2026-05-04 | ADR-017 task priority field shipped — T/P split namespaces, pillar `none` for cross-cutting work, ideas.md → Constantia migration | Required field `priority` on tasks with status-conditional enum: `proposed` → T1\|T2\|T3 (Guya's hint); `assigned`/`in-progress`/`complete`/`graded` → P1\|P2\|P3 (Telos's stamp); `rejected` preserved as-was. T → P at acceptance is unbound — Telos picks P fresh against portfolio, T is a hint not a contract. `pillar` enum extended to `1\|2\|3\|none` for cross-cutting infra/process work; pillar work wins at equal priority. `assign_task` and `accept_proposal` MCP tools now require `priority` arg. Tick-prompt rewritten: action priority dominates (grade > accept > kill-stale > assign > nothing); within a category, highest P/T wins. Constantia is now single source of truth for backlog — `ideas.md` deleted at Guya repo root; 7 entries migrated to Constantia tasks TASK-010..016 as `status: proposed`. Affected commits: guya `9b08d96` (ADR + ideas.md deletion), constantia `bd0359e` (schema), nanoclaw fork `ca38dac` (priority-aware MCP tools + tick-prompt) |
| 2026-05-04 | reflect-prompt.md reasoning-bug fix — explicit "truth is the file, not the transcript" + synthesis-DM-always rules; restored 807fb0b reflection content lost when 23:00 PT cron wrote a "duplicate check" placeholder over an intentionally-cleared slot | Two reasoning bugs surfaced when the cron fired into a cleared slot. (A) Telos pre-judged "duplicate cron fire" from its own DM transcript instead of trusting `write_reflection`'s file-existence guard, and wrote placeholder content over the intentionally-cleared 2026-05-04 reflection. (B) The bug-report DM ("overwrite protection isn't working") replaced the synthesis DM, so Daniel got debug output instead of the daily synthesis. Fix: reflect-prompt §1 says "the truth source is the file, not the transcript"; §4 reframes the synthesis DM as the daily contract that always sends — anomalies go in a SEPARATE second DM. Reflection content restored from constantia `807fb0b` via constantia commit `80dad30`. Fork commit `44a54fe` |
| 2026-05-06 | Evolve reads reflections from Constantia primary, project-local fallback (commit d589953). Closed cross-project signal leak per vision.md §3.1. |
| 2026-05-08 | Telos reorg: 4-namespace task split + 3-session Telos plan + 13 ticks/day + numeric priority (supersedes ADR-017's T/P prefix) — full design in `docs/2026-05-08-telos-reorg.md` | 5 blockers surfaced by Daniel: legacy task accumulation, single conflated namespace, sparse 2x-daily tick cadence, undefined Pillar 1, single Telos chat. Single working session locked 12 design decisions and shipped Phases 0-2c. Schema: `tasks/{proposals,tasks,learn,learn/curricula,reminders,archive/2026-05-07}/`. Priority becomes plain numeric `1|2|3` across proposals/tasks/learn — validator enforces explicit re-grade at proposal accept (the actual anti-rot mechanism, prefix theater dropped). Reminders skip priority/pillar; flat `schedule_type` + `schedule_at`/`schedule_expr` fields (avoids YAML dep). Terminal-without-grade for tasks is `abandoned` (rejected reserved for proposals). 3-session Telos planned (work=existing session preserved, learn=Socratic+web-tools fresh, life=Korean+두식 fresh) — supersedes the 5/5 split-language-Telos plan; sessions share Constantia for memory propagation. Reminder firing infra (Phase 5): launchd cron + `check_reminders.sh` reads R-files as single source of truth, no nanoclaw cron drift. Implementation: Phase 0 snapshots + runbook + state capture; Phase 1 schema + hooks (constantia `cd6651a` + `536522b`); Phase 2a helpers + 2 tools (telos `c0be63f`); Phase 2b acceptProposal rewrite + 5 new tools (telos `26fe607`); Phase 2c work session prompts + addendum + 1pm cron + mini deploy + smoke (telos `df6c829`). Discovery during deploy: nanoclaw spawns per-group MCP server via `bun .ts` directly — only nanoclaw core compiles via `pnpm build`; future Telos tool changes deploy via push+pull+restart, no build step. 4 review passes caught + auto-fixed 8 issues in TS work, including curriculum-overwrite-of-unreadable-file (fs.access broad catch). Phases 3+4+5+6 pending. ADR-018 entry in CLAUDE.md pending Phase 6 cutover; ADR-017 to be marked superseded then |
| 2026-05-10 | Constantia post-commit hook must guard against rebase/cherry-pick/merge state (ADR-019) | Hook ran `git commit --amend` + `git push` unconditionally. When `commitAndPush` did `git rebase origin/main` and replayed N local commits, the hook fired per replayed commit, amend failed during cherry-pick (illegal during in-progress rebase), MANIFEST regeneration dirtied the working tree, the next rebase step aborted with "your local changes would be overwritten," local commit stayed unpushed, next tick repeated the cycle. 9 Telos commits accumulated on mini over 2 days before noticed. Fix: hook checks for `$GIT_DIR/{rebase-merge,rebase-apply,CHERRY_PICK_HEAD,MERGE_HEAD}` at top and exits 0 with stderr log line if any exists (constantia commit `7095f49`). Architectural impact: any code that does `git rebase` against Constantia can now safely fire the post-commit hook per replayed commit. Same meta-pattern as ADR-011/012/013/016 — silent rot of trusted enforcement, this time at the git-hook tier. Diagnosed after 9 stranded commits surfaced during Phase 3 pre-deploy investigation |
| 2026-05-10 | nanoclaw routing requires a `messaging_group_agents` row (ADR-020) | Wiring a new agent_group to a Discord channel requires FOUR coordinated rows in `v2.db`, not three: (1) `messaging_groups` defines the destination, (2) `agent_groups` defines the agent, (3) `sessions` links agent_group to messaging_group, (4) `messaging_group_agents` is the routing link that tells nanoclaw "incoming messages on this messaging_group should wake this agent_group." The fourth row is easy to miss — no validation surfaces its absence — and silently drops all messages from the channel. Bot still receives Gateway events but no `Message routed` log fires, no inbound DB row appears, Telos never responds. Surfaced during Phase 3 deploy when learn-Telos's first user-message attempt produced no response despite a healthy session container. Fix: insert a `messaging_group_agents` row for every new agent_group (schema in `docs/2026-05-10-phase3-deploy-runbook.md` lesson 5). For all future session bootstraps the wiring sequence is: messaging_groups → agent_groups → **messaging_group_agents** → sessions → destinations. Same meta-pattern family as ADR-011/012/013/016/019 — silent rot at the routing tier |
| 2026-05-10 | nanoclaw plist PATH must include Docker.app explicitly (ADR-021) | launchd's strict env only contains the plist's `EnvironmentVariables`; it does not inherit shell env. After any `launchctl unload + load` cycle, nanoclaw entered a 10-second crash loop with `Failed to reach container runtime: dial unix /Users/guya/.docker/run/docker.sock: connect: no such file or directory` because the docker context resolution couldn't find Docker.app's CLI under the original PATH (`/usr/local/bin:/usr/bin:/bin:/Users/guya/.local/bin`). Manual `docker info` from the user's shell worked because the shell PATH had the right entries. Fix: edit `~/Library/LaunchAgents/com.nanoclaw-v2-53edea47.plist` `EnvironmentVariables.PATH` to prepend `/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:`. After unload/load, nanoclaw boots cleanly. Backup at `<plist>.pre-phase3.bak`. Same family as the May 8 "Nanoclaw LaunchAgent Missing Homebrew in PATH" memory entry (Homebrew side); this is the Docker.app side. Both belong in plist PATH for any LaunchAgent that calls docker. Audit other LaunchAgents on mini for the same gap. Same meta-pattern family as ADR-011/012/013/016/019/020 — silent rot at the launchd-env tier |
| 2026-05-10 | Telos shared MCP tools at `shared/telos-tools/` in nanoclaw fork, mounted into each session group via additionalMounts (ADR-022) | Replaces per-group `tools/` directories (one copy per Telos session) with a single source of truth. Each session container (work, learn, future life) mounts `shared/telos-tools/` at `/workspace/extra/telos-tools/` via `additionalMounts` and points `mcpServers.<name>.command` at `bun run /workspace/extra/telos-tools/mcp-server.ts`. Avoids the ADR-013-style drift risk that 3 copies of mcp-server.ts would have created — a fix in one would silently rot the other two. Fork `.gitignore` allowlists `shared/telos-tools/**`. Mount allowlist on mini extended to include `~/telos/shared/telos-tools` as an allowed root. Fork commit `ce5b0d5`. Critical deploy sequencing per `docs/2026-05-10-phase3-deploy-runbook.md`: stop work session BEFORE pulling the fork (the fork move breaks the old `groups/telos/tools/` path), update mount-allowlist + work container.json BEFORE restart |
| 2026-05-15 | Central `agent_destinations` is the durable seed layer + tick-wake routing context refreshes on chat-sdk follow-ups (CLAUDE.md ADR-023) | Per-session `destinations` table is a projection cache wiped by `writeDestinations()` (`src/modules/agent-to-agent/write-destinations.ts:54`) on every container wake; ADR-019's and ADR-022 step-3's per-session-INSERT fixes were at the wrong layer. WORK survived only because it had a central row from initial Phase 2 setup. Correct fix: INSERT into central `agent_destinations` in `v2.db` with `agent_group_id`, `local_name`, `target_type='channel'`, `target_id=<messaging_group_id>`. Done for LIFE + LEARN. Separate fix: `poll-loop.ts:96`'s `extractRouting` captures the initial batch's routing once; chat-sdk follow-ups pushed into the active-query pollHandle never updated the shared routing object, so agent responses to user messages used the task-wake's NULL routing and the scratchpad-with-routing fallback never fired. Patched in telos fork `ce84b19`: pollHandle iterates new messages and refreshes routing fields when a follow-up has populated `platform_id`+`channel_type`. Also documented: synthetic `/clear` injection via raw `chat-sdk` row + `docker kill` (active-query pollHandle filters /clear OUT of follow-ups per line 275; only initial-batch wakes process it). Same meta-pattern family as ADR-011/012/013/016/018/019/020/021/022 — silent rot of trusted enforcement, this time at the projection-cache tier AND the in-flight routing-context tier simultaneously. ADR-019 and ADR-022 amended with corrections referencing ADR-023 |
| 2026-05-15 | Routing fallbacks use `\|\|` not `??` to treat empty string as missing (CLAUDE.md ADR-021) | Hand-seeded `messages_in` row from ADR-019 cron-seed step used `''` (empty string) instead of `NULL` for `thread_id`; recurrence inserts copied it forward; `??`-based fallbacks at `extractRouting` (`container/agent-runner/src/formatter.ts:100`), `writeMessageOut` (`container/agent-runner/src/db/messages-out.ts:72`), and `chat-sdk-bridge.deliver/setTyping` (`src/channels/chat-sdk-bridge.ts:354,440`) only catch `null`/`undefined`, so the empty string flowed through to Discord adapter's `decodeThreadId("")` and threw `ValidationError: Invalid Discord thread ID:` after 3 retries. WORK 23:00 series silently failed 5/12, 5/13, 5/14; masked by chat-sdk session-memory inheritance until /clear (ADR-018 validation) stripped the masking. Fix is three-layer change of `??` → `\|\|` so empty string also triggers fallback, plus a data UPDATE `SET thread_id = NULL WHERE thread_id = ''` across WORK inbound + outbound DBs (12 + 8 rows). Telos fork commit `4698f79`. Same meta-pattern family as ADR-011/012/013/016/019/020/021/022/023 — silent rot of trusted enforcement, this time at the SQL-typing tier (TEXT column accepts NULL and `''` indistinguishably in `sqlite3` default output). Anti-rot watches: future ad-hoc `INSERT INTO messages_in` MUST use literal `NULL` keyword for missing thread context, not `''`; consider a CHECK constraint `thread_id IS NULL OR thread_id != ''` |
| 2026-05-15 | `formatTaskMessage` falls back through `content.prompt → content.text → ''` to preserve raw-XML rem-row payloads (CLAUDE.md ADR-022) | `check_reminders.sh` (constantia repo) inserts raw `<reminder>...</reminder>` XML into `messages_in.content` — not JSON-wrapped. `formatTaskMessage` calls `parseContent(msg.content)` which falls back to `{text: raw}` on JSON parse failure, then emits `'Instructions:'` + `content.prompt \|\| ''`. With no `content.prompt` key, the rendered Instructions section is empty. Agent sees `[SCHEDULED TASK]\n\nInstructions:\n` (nothing after) and decides there's nothing to do. LIFE 7pm reminder R-004 failed silently this way 5/14; LIFE 10pm R-005 still delivered because it fired alongside a JSON-wrapped close-task that directed Telos to check Constantia and recover R-005 from `tasks/reminders/R-005.md` via the filesystem. Three-part fix: (a) telos fork `51184b2` — `formatTaskMessage` extended to `content.prompt \|\| content.text \|\| ''`; (b) constantia `3d38800` — `check_reminders.sh insert_reminder_message()` JSON-wraps the XML body via `python3 -c 'import sys, json; print(json.dumps({"prompt": sys.stdin.read()}))'` before INSERT, so the content arrives JSON-shaped at the formatter (defense in depth); (c) LIFE + LEARN `destinations` table re-seeded with `name=platform_id` (rows had been wiped between noon and night 5/14 — separate regression). Container-side patches deploy via host→container bind mount of `container/agent-runner/src/` at `/app/src` (per Dockerfile comment: *"Source is never baked in. Source-only changes never require an image rebuild."*); ADR-020's docker-build keychain blocker does NOT apply to source-only changes. **Convergent diagnosis:** Telos's own outbound at 22:42 PT 5/14 explicitly named the symptom — *"7시에 빈 메시지가 왔는데 내용이 없어서"* (an empty message came at 7pm because there was no content) — Guya initially dismissed as guess-from-symptom; was wrong. Lesson: when a system component diagnoses its own state with specific evidence claims, that's data not opinion — verify before dismissing. Same meta-pattern family as ADR-011/012/013/016/019/020/021/022/023 + this session's ADR-021 — silent rot of trusted enforcement, this time at the content-shape contract tier. The formatter trusted that every `messages_in.content` is JSON with a `prompt` key; `check_reminders.sh` in a sibling repo doesn't honor that contract; nothing enforces the boundary |
| 2026-05-11 | Phase 4 (life session bootstrap) shipped + two new silent-rot lessons captured (ADR-023) | Third Telos session live. 두식 LIFE voice deployed with deliberate register differences from WORK: (a) **both 합쇼체 and 해요체 used fluidly within messages** based on speech act (openers/pattern calls lean 합쇼체; pushback/direct demands lean 해요체) — the first place in Telos's surface where register modulates inside a single response; (b) Korean default regardless of input ambiguity (vs WORK's mirror-input rule) — only switches to English when Daniel actively initiates English; (c) Audrey referenced as **매님** (in-chat referent Daniel chose), reminders as **알림** (not 알람); (d) cohabitation reframe — patterns are presence-quality based (3+ friction mentions in 2 weeks, sustained parallel-tracking, planned together-time falling through), not absence-streak based as the original sketch assumed; (e) slang permitted (ㅋㅋ ㄷㄷ etc) but NOT default — none of the three calibration anchors Daniel wrote use slang. Calibration anchors locked verbatim from Daniel's own Korean in `groups/telos-life/CLAUDE.local.md` "Calibration" section. Tool subset narrowed: `add_reminder` + `read_today_transcript` + `do_nothing` only — explicitly NO `write_evidence`, NO `grade_*`, NO `propose_task` (LIFE is presence, not portfolio). Profile writes to `profile/relationship.md` + `profile/health.md` allowed via Edit/Write directly when sustained shift crystallizes (synthesis, not transcript-dump). Mini deploy followed `docs/2026-05-11-phase4-deploy-runbook.md` with Phase 3's L1-L5 baked in as inline `[L#]` callouts. Two new silent-rot patterns surfaced and captured: **L6 — transient code 125 on first container spawn after `launchctl kickstart` of nanoclaw.** First spawn after restart exited 125 in 159ms; second spawn one minute later (same config) ran cleanly. Probably Docker socket warm-up under launchd's strict env. Nanoclaw's retry loop handled it. Watch-trigger: TWO consecutive 125s for the same session within 2 minutes (one is transient, two is a real bug). **L7 — synthetic test messages without `platform_id`/`channel_type` contaminate long-lived agent session state.** Injected a wakeup message into LIFE's inbox without Discord routing fields. The agent correctly noted "no destination → response to scratchpad" for that message. Then Daniel's real Discord message arrived in the SAME poll-loop session, and the agent stuck with the scratchpad pattern from the previous turn rather than producing a `<message to="discord:...">` block. Killing the container reset the session state and the next real message produced a correct Discord-bound response. Mitigation: always kill the container after injecting a synthetic test, before any real message arrives. Same meta-pattern family as ADR-011/012/013/016/019/020/021 — silent rot of trusted enforcement, now at the runtime session-state tier. Fork commit `317e4e6` (Phase 4 fork-side: telos-life group skeleton + addendum + 5 tick prompts). Guya commit `cb388c8` (STATUS + Phase 4 runbook) |

- [2026-05-16] decided container commits + host pushes (constantia-sync daemon) because Docker bind-mount breaks git rebase's unpack-trees safety check on macOS. See ADR-024.

- [2026-05-21] T/P prefix swap — `T`=Task, `P`=Proposal (was backwards). Task-schema table above updated. Spans 3 repos so atomicity is per-repo, not one commit; deployed via a Mini freeze→push→pull→resume cut-over (no container rebuild — `telos-tools` is bind-mounted live). Dated history left immutable with a CLAUDE.md legend (Daniel's append-only rule), only live state migrated. See ADR-025 + `docs/2026-05-21-tp-swap-migration.md`.

- [2026-05-21] **Visibility-fix pattern for user-facing SessionStart hook output (guya#3, commit `8e5ae79`).** `hookSpecificOutput.additionalContext` is the only field reliably injected at SessionStart, and it is **model-only** — never rendered in the chat UI. `systemMessage` (the documented user-facing field) is silently suppressed for plugin-sourced SessionStart hooks in Claude Code 2.1.x. So when a hook needs to reach Daniel (not just Guya), the **load-bearing path is to bake the imperative INTO `additionalContext`** so the agent relays it in its first reply — that's the channel guaranteed to reach the chat. `systemMessage` is set as best-effort native-CLI insurance, not the primary mechanism. Implemented in `formatNudgeDirective()` for the evolve backlog nudge: wraps the bare nudge in a "🔔 SHOW DANIEL FIRST — he cannot see this block" prefix so the relay instruction travels with the nudge to every project with zero CLAUDE.md dependency. **Self-detecting** (Daniel notices missing nudges) — the opposite of the silent-rot meta-pattern ADR-011/012/013 guard against. Applies to any future hook that needs user-visible output.
