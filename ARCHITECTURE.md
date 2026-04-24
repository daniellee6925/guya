# guya — Architecture

> Last updated: 2026-04-24

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
│   │   ├── guya-pre-commit-review.mjs  # Invoked by dispatcher (Bash) and directly (Skill): enforce review gate before commit
│   │   ├── guya-pre-push-check.mjs     # Invoked by dispatcher: block push if quality checks fail
│   │   ├── guya-post-commit-scribe.mjs # Invoked from git post-commit hook (NOT Claude Code hook)
│   │   ├── hook-utils.mjs              # Shared utilities (isGitCommit, resolveProjectRoot)
│   │   └── constantia-sync.mjs         # Shared Constantia integration (path resolution, task reading, log writing)
│   ├── tools/                # MCP server (guya-tools)
│   │   ├── server.js         # MCP stdio server; registers all tool groups
│   │   ├── memory-tools.js   # memory_core_update/append, memory_archival_store/search, memory_recall_note, memory_reflect
│   │   ├── introspection-tools.js  # guya_status, guya_guidelines, guya_traces
│   │   ├── evolution-tools.js      # evolve_consolidate, evolve_status, evolve_force_synthesize
│   │   └── identity-tools.js       # identity_propose_change, identity_read
│   ├── skills/               # One directory per skill (SKILL.md inside each)
│   │   ├── guya-bootstrap    # First-run interview
│   │   ├── guya-setup        # Install git hooks into any repo
│   │   ├── guya-scribe       # Update STATUS.md / ARCHITECTURE.md / CLAUDE.md
│   │   ├── guya-reflect      # Manual reflection cycle + Constantia log write
│   │   ├── guya-evolve       # Combined synthesis → review → apply → consolidate
│   │   ├── guya-learn        # Interactive teaching sessions
│   │   ├── guya-review       # Code review (Karpathy principles)
│   │   ├── guya-deep-review  # Second-pass review after fixes
│   │   ├── guya-optimize     # Simplification and performance analysis
│   │   ├── guya-pr           # Pre-PR diff review + Codex pass
│   │   ├── guya-status       # Show current Guya state
│   │   ├── guya-forget       # Remove a guideline or memory entry
│   │   ├── guya-obsidian-sync # Sync knowledge to Obsidian
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
   ├── /guya-reflect writes ──────► log/YYYY-MM-DD-guya-{project}-{session}.md
   ├── /guya-evolve reads ◄──────── profile/ (strengths, weaknesses, trajectory)
   │                                  │
   └────────── Constantia ────────────┘
               (shared git repo)
```

**Constantia** (`~/Desktop/constantia`) is the shared memory repo between Guya and Telos. Path resolved via `~/.claude/guya/constantia.json`. The `constantia-sync.mjs` module provides shared utilities for path resolution, task manifest reading, and log writing.

**Write ownership (no shared-write files):**
- Guya: `log/` (via /guya-reflect), task status updates
- Telos: `evidence/`, `profile/`, `goals/`, task assignments + grades

**Session-start:** reads `tasks/MANIFEST.md`, injects active tasks at priority 0 (same as soul/user). Alerts if Constantia unavailable — never silently degrades.

**Reflect:** writes structured log entries with YAML frontmatter + full body (session metadata, reflection content, growth observations, open threads). Filename includes project + session ID to prevent cross-repo collisions. Append logic for same-session re-reflects.

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

### MCP Server (guya-tools)

The MCP server runs as a stdio process (registered in Claude Code's MCP config). It exposes 14 tools across four groups: memory, introspection, evolution, and identity. Tool groups are loaded conditionally so the server starts even if a group file is missing.

### guya-setup Skill

The `guya-setup` skill installs the git post-commit hook into any repo's `.git/hooks/post-commit`. The installed hook: checks that `.guya/` exists in the repo root (guard against non-guya repos), resolves the versioned plugin cache path dynamically, and invokes the scribe with a synthetic payload. This makes the post-commit scribe portable to any guya-enabled project without requiring the full guya source tree.

---

## Target Architecture

### Daemon (v2 — deferred)

ADR-004 deferred a background daemon to v2. The current hook-native architecture has no persistent process between sessions. A future daemon would enable:
- Proactive reminders and scheduled tasks without requiring a Claude Code session
- Richer cross-session state accumulation
- Real-time convergence tracking without session-end triggering

### Two-Track Learning Completion (v2)

Phase 6 delivered the slow LLM track (haiku classify → sonnet synthesize). The fast heuristic correction track (guya-correction-detect.mjs) fires on UserPromptSubmit but the feedback loop that promotes validated heuristics into guidelines is not yet closed. The target is: fast track validates → confidence threshold → auto-promotes to tactical guideline.

### Cross-Project Memory Surfacing

Currently, global strategic guidelines accumulate at `~/.claude/guya/guidelines/strategic/` but there is no active mechanism to surface cross-project patterns during context assembly beyond the static file read. The target is a lightweight similarity search that pulls the most relevant strategic guidelines for the current project's domain.

### Convergence Tracking (Daniel-specific, ADR-008)

The soul spec includes convergence tracking (detecting when Daniel is scattered vs. focused). This is referenced in identity files but not yet implemented as a measurable signal in the evolution pipeline.

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
