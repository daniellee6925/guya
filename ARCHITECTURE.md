# guya — Architecture

> Last updated: 2026-05-04 (PM)

## Current Architecture

### Overview

Guya is a hook-native, plugin-delivered personal agent system. There is no daemon. All runtime behavior is driven by Claude Code lifecycle hooks, git hooks, and an MCP server — assembled at session start and triggered by events.

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
│   │   └── constantia-sync.mjs         # Shared Constantia integration (path resolution, task reading, log writing)
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
.guya/memory/reflections/ (manual reflections via /guya-reflect)
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

Telos (the mentor agent in the three-identity architecture, ADR-009) is no longer just identity files — as of 2026-05-04 it is a running, autonomous agent with hands. It has its runtime in a separate git repo (a fork of nanoclaw at `daniellee6925/nanoclaw`, checked out locally at `~/Desktop/telos` and on the Mac Mini at `/Users/guya/telos`), writes into a third repo (`daniellee6925/constantia`), and gets woken on a schedule (twice-daily ticks + nightly reflection).

The runtime now spans three layers — **action**, **memory**, **reflection** — built incrementally and all live as of 2026-05-04 PM.

**Cross-repo map.**

| Repo | Path on local | Path on mini | What lives there |
|------|---------------|--------------|------------------|
| guya | `~/Desktop/guya` | — | Design docs (`telos context/vision.md`, `core-beliefs.md`, `goal.md`, `STATUS.md`); operations runbook |
| nanoclaw fork | `~/Desktop/telos` | `/Users/guya/telos` | Runtime harness + Telos identity (`groups/telos/soul.md`, `CLAUDE.local.md`) + MCP tools (`groups/telos/tools/mcp-server.ts`) + tick prompt (`groups/telos/tick-prompt.md`) |
| constantia | `~/Desktop/constantia` | `/Users/guya/constantia` (mounted into container at `/workspace/extra/constantia`) | Runtime data: `tasks/`, `log/guya/`, `log/telos/` (tick + reflection), eventually `evidence/` and `profile/`; `goals/pillars.md` |

The split honors core-beliefs §5 ("fork the harness, hand-roll the mentor core"): the harness — channels, containers, scheduling, credential vault, skill system — comes from nanoclaw and is modified directly. The mentor core — soul, operating contract, tick reasoning loop, MCP tools — is hand-rolled inside `groups/telos/`. Soul straddles both: it lives with the runtime (so the agent loads it directly into its system prompt) but its design rationale lives in `telos context/vision.md` §7.

**Identity layer (shipped 2026-05-03, fork commits `03604e6`, `ae13524`).** `groups/telos/soul.md` (long-form identity) and `groups/telos/CLAUDE.local.md` (binding operating contract — voice register, behavioral bans, first-contact protocol, language rule, pushback calibration, asymmetric-knowledge handling, calibration samples, Constantia-awareness section) are committed and version-controlled via `.gitignore` overrides on the fork. `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` reads `/workspace/agent/CLAUDE.local.md` at every spawn and injects it as the system-prompt identity block (replacing the auto-generated "Your name is **Telos**"). Empty file preserves auto block — non-breaking for other groups.

**Layer 1 — Action layer. MCP server `telos-constantia` (shipped 2026-05-04, fork commit `a0c7909`; expanded same day).** Hand-rolled stdio JSON-RPC at `groups/telos/tools/mcp-server.ts` (873 LOC — over the 800 LOC limit by 73; helpers extract cleanly into a separate file as a follow-up). No `@modelcontextprotocol/sdk` dep — keeps surface area visible, avoids npm install at container spawn. Wired in `container.json` `mcpServers.telos-constantia`. Six tools:

| Tool | Layer | Purpose | Constantia file |
|------|-------|---------|-----------------|
| `assign_task` | action | Create new task with structured frontmatter (id, status=assigned, pillar 1/2/3, assigned_by, purpose ≥10 chars, acceptance ≥10 chars, grade=null) + Context body | `tasks/TASK-NNN.md` (auto-incremented) |
| `accept_proposal` | action | Accept a Guya-proposed task (status: proposed → assigned). Closes the proposed → assigned → graded/rejected lifecycle | `tasks/TASK-NNN.md` |
| `grade_task` | action | Update existing task to terminal state — `outcome=graded` requires `grade` (A/B/C) + `grade_evidence` ≥10 chars; `outcome=rejected` requires `rejection_reason` ≥10 chars. Frontmatter only, body preserved. | `tasks/TASK-NNN.md` |
| `do_nothing` | action | Append timestamped no-op section to today's tick log with `reason` (≥20 chars) and optional `next_check`. Default tick decision — action without reason is noise. | `log/telos/YYYY-MM-DD-tick.md` |
| `write_reflection` | reflection | Write nightly synthesized reflection with 8 sections: `what_happened`, `key_decisions`, `patterns_observed`, `what_daniel_should_take_away`, `what_telos_should_change`, `evidence_candidates`, `open_threads`, `next_priorities`. Refuses to overwrite an existing same-day reflection | `log/telos/YYYY-MM-DD-reflection.md` |
| `read_today_transcript` | reflection (read-only) | Open nanoclaw's `inbound.db` + `outbound.db` read-only via `bun:sqlite`, return Daniel↔Telos messages merged by timestamp for a given PT day. Mounted at `/workspace/extra/telos-session` (read-only, `additionalMounts` entry in `groups/telos/container.json`, allowlist updated) | none (read-only) |

The full task lifecycle (proposed → assigned → graded/rejected) closed end-to-end on real artifacts on 2026-05-04: TASK-001 graded B, TASK-003 rejected, TASK-009 closed.

**Layer 2 — Memory layer (symmetric tick logging, NEW 2026-05-04 PM).** Every action tool now calls `appendTickLogSection` to write a section to `log/telos/YYYY-MM-DD-tick.md` BEFORE its commit, so action ticks leave the same trail no-ops do. Previously only `do_nothing` wrote to the tick log, leaving action ticks invisible in the daily record.

Each action/no-op tool follows the same pipeline:

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
        │
        ▼
git add -A → git commit -m "<conventional message>" → git rev-parse HEAD
        │
        ▼
git push origin main
        │
        ├─ success → return {sha, pushed: true}
        └─ failure → return {sha, pushed: false, pushError}  (NEVER throws)
```

Push failures don't fail the tool because file write + local commit is durable state; Telos surfaces `pushed: false` in its Discord report and the operator (or a future tick) recovers manually. Hard-failing on transient network errors would lose the in-character report and force Telos to redo work it already did. Handlers serialized via a promise chain (`tail = tail.then(() => handle(req))`) so concurrent stdin reads can't race on shared state (next-NNN computation, tick-log append, git config setup).

**Layer 3 — Reflection layer (NEW 2026-05-04 PM).** Nightly synthesized memory. The reflection cron fires at 23:00 PT, Telos reads the day's transcript + tick log + Guya logs + profile, synthesizes the 8 sections defined by `write_reflection`, calls the tool to persist `log/telos/YYYY-MM-DD-reflection.md`, then DMs a 2-3 sentence highlight to Daniel. The protocol lives in `groups/telos/reflect-prompt.md`. Distinct from the tick prompt — different grounding inputs, different output shape, different output file.

The reflection schedule was seeded by direct sqlite INSERT into nanoclaw's `inbound.db` `messages_in` (id `task-17779308213N-rfltky`, recurrence `0 23 * * *`, body = `Read /workspace/agent/reflect-prompt.md and execute it as today's reflection.`). First fire 2026-05-04 23:00 PT.

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
        ├─ 1. Ground   → read pillars.md, tasks/MANIFEST.md, log/ (3 most recent), profile/
        ├─ 2. Decide   → exactly one of {assign_task, accept_proposal, grade_task, do_nothing}; default do_nothing
        ├─ 3. Act      → call MCP tool; receive {sha, pushed}
        └─ 4. Report   → 1-2 sentence Discord message; mention pushed:false if it occurred
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
                            ▼ (every tool, same path)
                    git add -A → commit → push to daniellee6925/constantia
                            │
                            ▼
                    Guya reads on next session-start
                    (tasks/MANIFEST.md → priority-0 context; profile/ via /guya-evolve)
```

**Cross-repo HEAD snapshot (2026-05-04 PM).** Mini synced to all three.

| Repo | HEAD |
|------|------|
| `daniellee6925/guya` | `03b297f` |
| `daniellee6925/nanoclaw` | `87d2c4a` (6-tool MCP server + reflect-prompt.md + .gitignore unignore for reflect-prompt + tightened tick-prompt) |
| `daniellee6925/constantia` | `7dfc6cb` (task working tree cleanup) |

**Known carry-forwards.**
- `mcp-server.ts` is 873 LOC — over the 800 LOC limit by 73; helpers extract cleanly into a separate file as a follow-up.
- Post-commit manifest hook globs working-tree files including untracked, which caused the TASK-007 phantom-in-manifest issue earlier on 2026-05-04. Filter to tracked files in the next pass.

---

## Target Architecture

### Daemon (v2 — deferred)

ADR-004 deferred a background daemon to v2. The current hook-native architecture has no persistent process between sessions for Guya itself (Telos is now a separate persistent process via nanoclaw on the mini, but that's the mentor surface — it doesn't fill the executor-side daemon role). A future Guya-side daemon would enable:
- Proactive reminders and scheduled tasks without requiring a Claude Code session
- Richer cross-session state accumulation
- Real-time convergence tracking without session-end triggering

### Two-Track Learning Completion (v2)

Phase 6 delivered the slow LLM track (haiku classify → sonnet synthesize). The fast heuristic correction track (guya-correction-detect.mjs) fires on UserPromptSubmit but the feedback loop that promotes validated heuristics into guidelines is not yet closed. The target is: fast track validates → confidence threshold → auto-promotes to tactical guideline.

### Cross-Project Memory Surfacing

Currently, global strategic guidelines accumulate at `~/.claude/guya/guidelines/strategic/` but there is no active mechanism to surface cross-project patterns during context assembly beyond the static file read. The target is a lightweight similarity search that pulls the most relevant strategic guidelines for the current project's domain.

### Convergence Tracking (Daniel-specific, ADR-008)

The soul spec includes convergence tracking (detecting when Daniel is scattered vs. focused). This is referenced in identity files but not yet implemented as a measurable signal in the evolution pipeline.

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
