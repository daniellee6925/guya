# Guya Codebase Onboarding Report

> Generated: 2026-04-13

---

## What Is This Project?

Guya is a self-evolving personal agent system built on top of Claude Code. The one-liner from the project itself: "Daniel opens Claude Code and Guya already knows who he is, what he cares about, and gets better every session without him telling it to."

It is not a generic assistant framework or a coding tool with memory bolted on. It is explicitly Daniel-specific: named after his teddy bear of 20 years, carrying a personality defined in versioned identity files, and designed to challenge him to grow rather than tell him what he wants to hear.

The key architectural insight is that Guya has no daemon and no persistent process. It lives entirely inside a Claude Code session, activated by lifecycle hooks, and persists state in flat files and a versioned git repo at `~/.claude/guya/`.

---

## Directory Map

```
guya/
├── guya-plugin/          # Source of truth for the Claude Code plugin
│   ├── hooks/            # Lifecycle hook scripts (ESM .mjs, executed via run.cjs shim)
│   │   ├── hooks.json    # Hook dispatch registry (which hook fires on which event)
│   │   ├── run.cjs       # CommonJS shim: Claude Code plugin env is CJS; this loads ESM modules
│   │   ├── guya-session-start.mjs       # Assembles <guya-context> at session start
│   │   ├── guya-session-end.mjs         # Runs evolution pipeline at session close/compact
│   │   ├── guya-trace-capture.mjs       # Records file-edit traces on PostToolUse:Write|Edit
│   │   ├── guya-correction-detect.mjs   # Fast regex: detects corrections in user prompts
│   │   ├── guya-intent-detect.mjs       # Fast regex: detects decision-harness intent
│   │   ├── guya-pre-commit-review.mjs   # Blocks commits without prior review evidence
│   │   ├── guya-pre-push-check.mjs      # Blocks pushes failing quality checks
│   │   ├── guya-post-commit-scribe.mjs  # Updates STATUS.md after each real commit
│   │   ├── reflection-synthesis.mjs     # Turns reflections into self-edit proposals (Sonnet)
│   │   ├── apply-synthesis-result.mjs   # Applies approved proposals to ~/.claude/guya/
│   │   ├── commit-identity.mjs          # Git-commits identity changes to ~/.claude/guya/
│   │   ├── review-evidence.mjs          # Shared JSONL evidence store for pre-commit gate
│   │   └── hook-utils.mjs               # Shared utilities: isGitCommit, resolveProjectRoot, readStdin
│   ├── tools/            # MCP server (stdio, registered as "guya-tools")
│   │   ├── server.js           # Entry point; registers all tool groups
│   │   ├── memory-tools.js     # 6 memory tools: core, archival, recall, reflect
│   │   ├── introspection-tools.js  # guya_status, guya_guidelines, guya_traces
│   │   ├── evolution-tools.js      # evolve_consolidate, evolve_status, evolve_force_synthesize
│   │   └── identity-tools.js       # identity_propose_change, identity_read
│   ├── skills/           # One directory per skill, each containing SKILL.md
│   │   ├── guya-bootstrap/         # First-run interview to build Daniel's profile
│   │   ├── guya-setup/             # Install git hooks into any repo
│   │   ├── guya-scribe/            # Update STATUS.md / ARCHITECTURE.md / CLAUDE.md
│   │   ├── guya-reflect/           # Manual reflection cycle (two-sided accountability)
│   │   ├── guya-evolve/            # Synthesis → review → apply → consolidate (self-evolution)
│   │   ├── guya-learn/             # Interactive Socratic learning sessions
│   │   ├── guya-review/            # Code review (Karpathy principles)
│   │   ├── guya-deep-review/       # Second-pass review after guya-review fixes
│   │   ├── guya-optimize/          # Simplification and performance analysis
│   │   ├── guya-pr/                # Pre-PR prep: diff review + PR summary draft
│   │   ├── guya-status/            # Show current Guya state
│   │   ├── guya-forget/            # Remove a guideline or memory entry
│   │   ├── guya-obsidian-sync/     # Sync knowledge to Obsidian vault
│   │   ├── guya-skill-creator/     # Create / improve skills, run evals
│   │   ├── guya-distinguished-engineer/  # Project direction + core-beliefs guard
│   │   ├── guya-decision-bugfix/   # Structured bugfix harness (10 questions before fix)
│   │   ├── guya-decision-feature/  # Structured feature harness (10 questions before build)
│   │   ├── guya-decision-kickoff/  # Project kickoff harness
│   │   └── guya-decision-refactor/ # Refactor harness
│   └── agents/           # Spawnable subagent definitions (model + system prompt)
│       ├── guya-reflection-synthesizer.md  # Sonnet: reflection → proposals
│       ├── guya-consolidator.md            # Opus: merge/prune/re-rank guidelines
│       ├── guya-observer.md                # Haiku: classify traces
│       ├── guya-synthesizer.md             # Sonnet: generate guidelines from traces (legacy)
│       ├── guya-reflector.md               # Sonnet: post-session auto-reflection
│       ├── guya-tester.md                  # Sonnet: generate tests
│       ├── guya-document.md                # Haiku: generate docs
│       ├── guya-debugger.md                # Sonnet: root-cause analysis
│       └── guya-refactor.md                # Sonnet: safe scoped refactors
├── scripts/
│   └── sync-plugin.sh    # rsync guya-plugin/ → ~/.claude/plugins/cache/guya/guya/<version>/
├── context/
│   ├── core-beliefs.md   # Architectural invariants — the hard rules Guya never violates
│   └── vision.md         # North star: what "done" looks like, with acceptance criteria
├── docs/
│   ├── llm-design-patterns.md  # Design patterns referenced by global CLAUDE.md
│   └── claude-code-guide.md    # Living guide to Claude Code platform patterns
├── .guya/                # Project-local Guya state (git-tracked where appropriate)
│   ├── memory/
│   │   ├── core/         # Short-form memory injected at session start
│   │   ├── archival/     # Deep knowledge store (semantic search via MCP)
│   │   └── reflections/  # Dated reflection files written by /guya-reflect
│   └── evolution/
│       ├── guidelines/tactical/   # Project-specific synthesized guidelines
│       ├── traces/                # Raw daily JSONL tool-use traces
│       ├── last-scribe-head       # Full SHA of last commit the scribe processed
│       ├── review-gate.json       # Legacy boolean gate (pending deletion)
│       └── review-evidence.jsonl  # Active review evidence for pre-commit gate
├── ARCHITECTURE.md       # Module map, decision log, hook dispatch table, evolution pipeline
├── STATUS.md             # Current focus, recent commits, in-progress work, TODO list
└── CLAUDE.md             # Project identity, key principles, ADRs, development guidelines
```

**Global identity (separate git repo, not in this directory):**

```
~/.claude/guya/           # Travels with Daniel to every project
├── soul.md               # Identity anchor: the bear, commitments, session behaviors
├── identity.md           # Presentation: name, origin, vibe
├── user.md               # Daniel's profile: patterns, preferences, growth areas
├── growth-tracker.md     # Grades by domain, trajectory, Karpathy target milestones
├── pre-commit-config.json  # Review gate thresholds (shared across all projects)
├── guidelines/strategic/   # Cross-project guidelines (reflection-synthesized)
├── traces/               # Daily JSONL trace files (gitignored)
├── .last-evolved         # JSON: timestamp + summary of last /guya-evolve run
├── .last-consolidated    # ISO timestamp of last consolidator run
└── .commit-log           # NDJSON audit trail of every commit-identity.mjs call
```

---

## Core Architecture: Hook-Native, No Daemon

Guya runs entirely inside a Claude Code session. There is no background process. All behavior is triggered by Claude Code lifecycle hooks and git hooks.

**Hook dispatch (from `hooks.json`):**

| Event | Matcher | Handler | Purpose |
|-------|---------|---------|---------|
| SessionStart | `*` | guya-session-start.mjs | Assemble `<guya-context>` block |
| UserPromptSubmit | `*` | guya-correction-detect.mjs | Detect corrections (fast regex) |
| UserPromptSubmit | `*` | guya-intent-detect.mjs | Detect decision-harness intent |
| PreToolUse | `Bash` | guya-pre-commit-review.mjs | Block commits without review evidence |
| PreToolUse | `Bash` | guya-pre-push-check.mjs | Block pushes failing quality checks |
| PreToolUse | `Skill` | guya-pre-commit-review.mjs | Same review gate via skill invocation |
| PostToolUse | `Write\|Edit` | guya-trace-capture.mjs | Record file-edit traces as JSONL |
| PreCompact | `*` | guya-session-end.mjs | Run evolution pipeline before compaction |
| SessionEnd | `*` | guya-session-end.mjs | Run evolution pipeline at session close |

**Critical platform constraint (discovered 2026-04-10):** `PostToolUse:Bash` never dispatches in Claude Code — only `Write|Edit` and wildcard matchers work for PostToolUse. This forced the post-commit scribe to be a native git hook rather than a Claude Code hook.

**Plugin delivery:** `guya-plugin/` source is not read directly by Claude Code. It is synced to `~/.claude/plugins/cache/guya/guya/<version>/` via `scripts/sync-plugin.sh`. The sync runs automatically from `.git/hooks/post-commit` after every commit. If you edit hooks and they don't take effect, run `bash scripts/sync-plugin.sh` manually.

---

## How a Session Starts

1. Claude Code fires `SessionStart`.
2. `guya-session-start.mjs` runs (pure file I/O, no LLM calls, must complete in <5s).
3. It reads (in priority order): `soul.md`, `user.md` (from `~/.claude/guya/`), `growth-tracker.md`, project core memory (`/.guya/memory/core/`), top 20 strategic guidelines by rank, tactical guidelines, session context.
4. Everything is assembled into a `<guya-context>` system-reminder block (2000 token budget / ~8000 chars). Lower priority sections are truncated if the budget is exceeded.
5. If there are unprocessed reflections and `/guya-evolve` hasn't run recently, a nudge line is prepended: `📝 N reflections accumulated (X days since last evolve). Run /guya-evolve to process them.`
6. The block is injected via `hookSpecificOutput.additionalContext` — Claude sees it as part of the system prompt.

If `~/.claude/guya/user.md` doesn't exist, the hook instead prompts Daniel to run `guya-bootstrap`.

---

## The Evolution Pipeline

This is the core feature. Guya gets better over time through a deliberate reflect → synthesize → apply loop.

### Step 1: Reflect (`/guya-reflect`)

After a session, Daniel runs `/guya-reflect`. The skill reads today's traces, the last few reflections, Daniel's profile, and active guidelines. It writes a two-sided reflection to `.guya/memory/reflections/YYYY-MM-DD-manual.md`:
- What Daniel should take away (specific, not generic)
- What Guya got wrong and is changing

Manual reflections (filename contains `-manual`) carry ~2x weight during synthesis.

### Step 2: Synthesize and Apply (`/guya-evolve`)

Daniel runs `/guya-evolve` when ready. The skill:

1. Calls `reflection-synthesis.mjs`, which uses the `guya-reflection-synthesizer` Sonnet agent to read the last 5 reflections and propose changes in three streams routed by blast radius:
   - **guidelineEdits** — operating heuristics, low blast radius, auto-apply
   - **userProfileAdditions** — new stable Daniel-facts, additive only, auto-apply
   - **identityProposals** — soul/growth-tracker edits, high blast radius, per-item review (requires ≥2 source reflections — anti-oscillation guardrail)

2. Presents proposals to Daniel grouped by stream with a recommendation per item.

3. Applies approved items via `apply-synthesis-result.mjs`, which writes to `~/.claude/guya/guidelines/strategic/` and `~/.claude/guya/user.md`, then commits each stream via `commit-identity.mjs`.

4. If the guideline set is stale (>7 days since last consolidation), runs `guya-consolidator` (Opus) to merge duplicates, prune low-confidence rules, and re-rank by `confidence × recency_weight`.

5. Touches `~/.claude/guya/.last-evolved` to reset the SessionStart nudge.

**Why manual, not auto:** The old auto-pipeline silently failed for 6 days when an API key expired. Deliberate reflections deserve deliberate consumption.

### Trace Capture (background)

`guya-trace-capture.mjs` fires on every Write/Edit PostToolUse, appending JSONL entries to `.guya/evolution/traces/YYYY-MM-DD.jsonl` and `~/.claude/guya/traces/`. These feed the `guya-observer` (Haiku) → `guya-synthesizer` (Sonnet) legacy pipeline in session-end, though the reflection-driven pipeline is now primary.

---

## The Pre-Commit Review Gate

Before Daniel commits, `guya-pre-commit-review.mjs` checks `.guya/evolution/review-evidence.jsonl` for evidence that a `guya-review` or `guya-deep-review` pass was performed this cycle. If no valid evidence exists, the commit is blocked with an explanatory message.

After a successful commit, `guya-post-commit-scribe.mjs` resets the gate, clears the decision session marker, appends the commit to `STATUS.md`, and writes the new HEAD SHA to `.guya/evolution/last-scribe-head`.

The scribe uses a full 40-char SHA for the marker (not abbreviated) to prevent substring collision bugs. It uses `appendFileSync` with `O_APPEND` for atomic writes and a temp-file + rename pattern for all file mutations.

---

## MCP Server (guya-tools)

`tools/server.js` runs as an stdio MCP server registered in Claude Code's MCP config. It exposes 14 tools in four groups:

| Group | Tools |
|-------|-------|
| memory | `memory_core_update`, `memory_core_append`, `memory_archival_store`, `memory_archival_search`, `memory_recall_note`, `memory_reflect` |
| introspection | `guya_status`, `guya_guidelines`, `guya_traces` |
| evolution | `evolve_consolidate`, `evolve_status`, `evolve_force_synthesize` |
| identity | `identity_propose_change`, `identity_read` |

Tool groups are loaded conditionally so the server starts even if a module is missing.

---

## Skills Catalog

Skills are invoked as `/guya-skill-name` from within a Claude Code session. Each lives in `guya-plugin/skills/<name>/SKILL.md` with a frontmatter `name` + `description` and a detailed step-by-step workflow.

**Self-evolution:**
- `/guya-reflect` — Write a two-sided reflection after a session
- `/guya-evolve` — Synthesize reflections into proposals, review, apply

**Code quality:**
- `/guya-review` — Karpathy-principles code review (complexity, silent errors, scalability, security, races)
- `/guya-deep-review` — Second-pass review after review findings are fixed
- `/guya-pr` — Pre-PR prep: full diff review + PR summary draft
- `/guya-optimize` — Simplification and performance analysis (report only, no auto-fixes)

**Decision harnesses** (force structured thinking before any implementation):
- `/guya-decision-feature` — 10 probing questions before building a feature
- `/guya-decision-bugfix` — Root-cause-first before fixing a bug
- `/guya-decision-refactor` — Behavior-preservation contract before refactoring
- `/guya-decision-kickoff` — Architecture thinking before starting a project
- `/guya-distinguished-engineer` — Project direction against core-beliefs.md

**Identity / memory:**
- `/guya-bootstrap` — First-run interview, builds `~/.claude/guya/user.md`
- `/guya-status` — Show current guideline inventory, trace counts, evolution state
- `/guya-forget` — Remove a guideline or memory entry
- `/guya-scribe` — Update STATUS.md / ARCHITECTURE.md / CLAUDE.md
- `/guya-obsidian-sync` — Sync knowledge to Daniel's Obsidian vault

**Learning:**
- `/guya-learn` — Interactive Socratic teaching sessions with active recall

**Setup:**
- `/guya-setup` — Install the post-commit git hook into any repo (run once per repo)

---

## Agents (Spawnable Subagents)

Agents are defined in `guya-plugin/agents/` as markdown files with frontmatter specifying `model` and `level`. They are spawned via the `Agent` tool with `subagent_type="guya:agent-name"`.

| Agent | Model | Role |
|-------|-------|------|
| guya-reflection-synthesizer | Sonnet | Reads reflections → proposes guideline/profile/identity edits |
| guya-consolidator | Opus | Merges, prunes, re-ranks strategic guidelines |
| guya-observer | Haiku | Classifies raw traces: domain, confidence, tactical vs strategic |
| guya-synthesizer | Sonnet | Generates guidelines from classified traces (legacy track) |
| guya-reflector | Sonnet | Auto-reflection at session end |
| guya-tester | Sonnet | Generates tests and regression coverage |
| guya-document | Haiku | Generates docs without touching source logic |
| guya-debugger | Sonnet | Root-cause analysis with competing hypotheses |
| guya-refactor | Sonnet | Safe scoped refactors with behavior preservation |

---

## Memory Architecture

Three-tier (inspired by Letta/MemGPT):

**Core memory** (`.guya/memory/core/`) — Injected at every session start. Short-form context blocks: active projects, Daniel's profile snapshot, session continuity. Highest read frequency.

**Archival memory** (`.guya/memory/archival/`) — Deep knowledge store, searched on demand via `memory_archival_search` MCP tool. Not injected automatically — too large for the token budget.

**Reflections** (`.guya/memory/reflections/`) — Dated entries from `/guya-reflect`. Primary input for the evolution pipeline. Manual reflections (`-manual` in filename) are prioritized.

**Global vs. project-local split:**
- `~/.claude/guya/` — Who Daniel is (identity, user profile, strategic guidelines). Works in every project.
- `.guya/` — What this project is (core memory, archival, reflections, traces, tactical guidelines). Project-specific.

---

## Key Implementation Decisions (from the Decision Log)

**PostToolUse:Bash never dispatches (2026-04-10).** Any hook registered against the `Bash` tool name in PostToolUse will never fire. Only `Write|Edit` and wildcards work. The post-commit scribe therefore lives in `.git/hooks/post-commit` as a native git hook, not a Claude Code hook.

**Plugin cache drift is the most common gotcha.** Claude Code reads hooks from `~/.claude/plugins/cache/guya/guya/<version>/`, not from source. Edits to `guya-plugin/` are invisible until synced. `sync-plugin.sh` runs automatically on commit but can be run manually.

**Manual /guya-evolve instead of auto session-end (2026-04-11, amends ADR-002).** The original auto-pipeline silently failed for 6 days when an API key expired. Reflections are deliberate; their consumption should be too.

**Anti-oscillation: identity proposals require ≥2 source reflections.** A single reflection about a bad day can't rewrite `soul.md`. Two independent reflections establishing the same pattern can.

**Tiered blast-radius routing.** Guidelines and user.md additions are auto-applied (reversible via git). Soul/identity/growth-tracker edits require per-item approval.

**Review gate uses JSONL, not a boolean flag.** `.guya/evolution/review-evidence.jsonl` is an append-only log with initial + followup steps, tree SHAs, and timestamps. A single boolean (`review-gate.json`) was too easy to accidentally clear. The tree SHA at review time is compared against tree SHA at commit time — a meaningful file change after review blocks the commit.

**resolveProjectRoot prevents phantom state dirs.** Hooks fired from a subdirectory (e.g. `guya-plugin/`) used to write `.guya/` state relative to CWD, creating ghost directories. `resolveProjectRoot()` in `hook-utils.mjs` runs `git rev-parse --show-toplevel` to always resolve to the repo root.

---

## Where to Start

If you want to understand the session-start path, read:
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/guya-session-start.mjs`
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/hooks.json`

If you want to understand the evolution pipeline, read:
- `/Users/daniel/Desktop/guya/guya-plugin/skills/guya-reflect/SKILL.md`
- `/Users/daniel/Desktop/guya/guya-plugin/skills/guya-evolve/SKILL.md`
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/reflection-synthesis.mjs`
- `/Users/daniel/Desktop/guya/guya-plugin/agents/guya-reflection-synthesizer.md`

If you want to understand the review gate, read:
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/guya-pre-commit-review.mjs`
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/review-evidence.mjs`
- `/Users/daniel/Desktop/guya/guya-plugin/hooks/guya-post-commit-scribe.mjs`

For the big picture, read:
- `/Users/daniel/Desktop/guya/ARCHITECTURE.md` — module map, hook dispatch, full decision log
- `/Users/daniel/Desktop/guya/context/core-beliefs.md` — the five beliefs that define what Guya is
- `/Users/daniel/Desktop/guya/STATUS.md` — current state, TODO list, known bugs

---

## Known Issues and Open TODOs

- `hasLearningSignal` in the trace pipeline doesn't match `file_edit` trace format — `file_edit` traces write `content: "Edit: app.py"` but the filter strips `"Tool: "` prefix, leaving `"edit: app.py"` which never matches `"edit"`. File-edit traces silently fall through.
- Unknown schema versions in `review-evidence.jsonl` are fail-open (older entries accepted, unknown-version entries warned but not fatal). Should fail-closed before the next schema bump.
- Two zombie tactical guideline files in `.guya/evolution/guidelines/tactical/` contain raw user-prompt text from a removed code path — not real guidelines.
- `review-gate.json` (legacy boolean) is still referenced by the post-commit scribe but superseded by `review-evidence.jsonl`. Deletion deferred.
- `isMain` guard required in any `.mjs` file that both exports functions and runs as a hook script — without it, test imports trigger the `main()` stdin listener and hang the test process.
