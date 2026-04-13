# Guya — Codebase Scout Report

> Generated: 2026-04-13

---

## 1. What Is This?

Guya is a self-evolving personal agent system built on top of Claude Code: it assembles Daniel's identity and project context at every session start, learns from each session via a reflection pipeline, and improves its own operating guidelines over time — without requiring manual curation beyond a single `/guya-evolve` command.

---

## 2. System Architecture

Guya has no daemon. Everything runs through Claude Code's lifecycle hook system, a git post-commit hook, and an MCP stdio server. The three runtime paths are:

**Session start (context injection):** `SessionStart` fires `guya-session-start.mjs`, which reads identity files from `~/.claude/guya/` (global, travels across all projects) and project-local core memory from `.guya/memory/core/`. It assembles a `<guya-context>` system-reminder block (2000-token budget) and injects it before the first message. No LLM calls — pure file I/O.

**Session runtime (tracing + gating):** On every `UserPromptSubmit`, two hooks fire: `guya-correction-detect.mjs` (fast regex, detects when Daniel corrects Guya and writes a trace) and `guya-intent-detect.mjs` (detects intent signals that should route to a decision harness). On `PreToolUse:Bash`, `guya-pre-commit-review.mjs` intercepts `git commit` calls to enforce a review gate — blocking the commit if no review evidence exists. On `PostToolUse:Write|Edit`, `guya-trace-capture.mjs` appends JSONL trace entries for every file write.

**Session end (evolution pipeline):** `SessionEnd` and `PreCompact` fire `guya-session-end.mjs`, which classifies accumulated traces via Haiku and synthesizes tactical guidelines via Sonnet. The primary evolution path is manual: `/guya-evolve` reads reflections from `.guya/memory/reflections/`, calls the `guya-reflection-synthesizer` (Sonnet) agent, presents tiered proposals to Daniel for approval, and applies approved changes to `~/.claude/guya/` (a git repo with full history).

**Post-commit scribe:** Because `PostToolUse:Bash` does not dispatch in Claude Code (confirmed platform constraint), the post-commit scribe is triggered from a native `.git/hooks/post-commit` hook installed by the `guya-setup` skill. It updates `STATUS.md`, resets the review gate, and writes the new HEAD SHA to `.guya/evolution/last-scribe-head`.

**Plugin delivery:** Every `git commit` in the guya repo triggers `scripts/sync-plugin.sh`, which rsyncs `guya-plugin/` into Claude Code's plugin cache (`~/.claude/plugins/cache/guya/guya/<version>/`). Claude Code reads hooks and the MCP server from the cache, not the source tree.

---

## 3. Design Philosophy

The core belief is in **continuity as the product**: a Guya session that loads no context is indistinguishable from a fresh Claude session, so the entire system exists to maximize context fidelity and accumulation. Key architectural beliefs:

- **Hook-native, no daemon (ADR-004):** All runtime behavior via Claude Code hooks and git hooks. Zero infrastructure beyond what Claude Code already provides. Daemon deferred to v2.
- **Global identity + project-local memory (ADR-005):** `~/.claude/guya/` holds identity that travels with Daniel everywhere; `.guya/` holds project-specific state. Daniel's identity is not owned by any one project.
- **Manual evolution, not auto-fire (amended ADR-002):** The auto session-end synthesis pipeline was rejected after it silently broke for 6 days when an API key expired. Reflections are deliberate writes; their consumption should be deliberate too. Auto-fire invited silent rot.
- **Tiered blast-radius routing:** Guideline edits and user profile additions auto-apply (low blast, reversible). Soul/identity/growth-tracker edits require per-item approval. Identity proposals require at least 2 source reflections to prevent mood-of-the-day oscillation.
- **Challenge first, support second (ADR-007):** Guya is named after Daniel's teddy bear — unconditional care, but genuine challenge over comfort. The soul spec explicitly instructs: push back, name bad decisions, force clarity.
- **LLM-oriented design patterns (global CLAUDE.md):** Max 800 LOC per file, one file one responsibility, calling specs at top of every module, pure functions over methods, variant registries over if-else.

---

## 4. Component Catalog

| Component | Path | Responsibility |
|-----------|------|----------------|
| Plugin root | `guya-plugin/` | Source of truth; synced to Claude Code cache on every commit |
| Hook dispatcher | `guya-plugin/hooks/hooks.json` | Registers all hooks: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, SessionEnd |
| CJS shim | `guya-plugin/hooks/run.cjs` | Bootstraps ESM `.mjs` hook scripts from CommonJS plugin environment |
| Session start | `guya-plugin/hooks/guya-session-start.mjs` | Assembles `<guya-context>` block; lazy-inits `.guya/` directory structure; computes reflection backlog nudge |
| Correction detect | `guya-plugin/hooks/guya-correction-detect.mjs` | Fast regex correction detection on user prompts; writes correction traces |
| Intent detect | `guya-plugin/hooks/guya-intent-detect.mjs` | Detects decision-harness intent in prompts; injects `<guya-intent>` reminder |
| Pre-commit gate | `guya-plugin/hooks/guya-pre-commit-review.mjs` | Intercepts `git commit`; checks review evidence; blocks or passes |
| Pre-push check | `guya-plugin/hooks/guya-pre-push-check.mjs` | Intercepts `git push`; final quality gate before code leaves the repo |
| Post-commit scribe | `guya-plugin/hooks/guya-post-commit-scribe.mjs` | Updates STATUS.md after each commit; idempotent via `last-scribe-head` SHA marker |
| Trace capture | `guya-plugin/hooks/guya-trace-capture.mjs` | Appends JSONL trace on every Write/Edit; caps at 5MB per daily file |
| Session end | `guya-plugin/hooks/guya-session-end.mjs` | Haiku classify + Sonnet synthesize traces → tactical guidelines |
| Hook utilities | `guya-plugin/hooks/hook-utils.mjs` | Shared: `isGitCommit`, `resolveProjectRoot`, `readStdin` |
| Review evidence | `guya-plugin/hooks/review-evidence.mjs` | JSONL evidence store; `appendStep`, `validateForCommit`, tree-SHA identity check |
| Reflection synthesis | `guya-plugin/hooks/reflection-synthesis.mjs` | Reads reflections + identity state; calls Sonnet synthesizer; returns 3-stream proposal object |
| Apply synthesis | `guya-plugin/hooks/apply-synthesis-result.mjs` | Writes approved guideline edits and user.md additions; touches `.last-evolved` marker |
| Commit identity | `guya-plugin/hooks/commit-identity.mjs` | Git-commits changes to `~/.claude/guya/`; writes NDJSON audit log |
| MCP server | `guya-plugin/tools/server.js` | stdio MCP server; registers all tool groups |
| Memory tools | `guya-plugin/tools/memory-tools.js` | `memory_core_update/append`, `memory_archival_store/search`, `memory_recall_note`, `memory_reflect` |
| Evolution tools | `guya-plugin/tools/evolution-tools.js` | `evolve_consolidate`, `evolve_status`, `evolve_force_synthesize` |
| Identity tools | `guya-plugin/tools/identity-tools.js` | `identity_propose_change`, `identity_read` |
| Introspection tools | `guya-plugin/tools/introspection-tools.js` | `guya_status`, `guya_guidelines`, `guya_traces` |
| Skills | `guya-plugin/skills/` | 20+ skill SKILL.md definitions; each is a workflow invoked via `/guya-<name>` |
| Agents | `guya-plugin/agents/` | Agent definition `.md` files spawned via the `Agent` tool |
| Project-local state | `.guya/` | Memory, traces, reflections, review evidence, last-scribe-head marker |
| Global identity | `~/.claude/guya/` | soul.md, user.md, growth-tracker.md, guidelines/strategic/, traces/ — git repo |
| Plugin sync | `scripts/sync-plugin.sh` | rsync source → Claude Code plugin cache; called from git post-commit hook |
| Architecture doc | `ARCHITECTURE.md` | Module map, hook dispatch table, evolution pipeline diagram, full decision log |
| Core beliefs | `context/core-beliefs.md` | Architectural invariants; decision filter for every proposal |
| Vision | `context/vision.md` | North star and acceptance criteria for each major feature area |

---

## 5. Key Files

**`guya-plugin/hooks/hooks.json`** — The complete hook registry. Shows exactly what fires when, with matchers and timeouts. Start here to understand the event-driven execution model.

**`guya-plugin/hooks/guya-session-start.mjs`** — The most important hook. Assembles the entire context that Guya works from. The `assembleContext` function, priority ordering, and token budget logic show how identity and memory are stitched together per-session. Also contains `computeReflectionNudge`, the soft signal that surfaces backlog evolution state.

**`guya-plugin/hooks/reflection-synthesis.mjs`** — The heart of the evolution pipeline. `synthesizeFromReflections` reads reflections, calls the Sonnet synthesizer agent, and returns three streams (guideline edits, user profile additions, identity proposals). The `validateIdentityProposals` anti-oscillation guardrail (requires ≥2 source reflections for identity changes) is here.

**`guya-plugin/agents/guya-reflection-synthesizer.md`** — The Sonnet agent prompt that converts reflections into proposals. Defines the three-stream routing model, quality bars for each stream, the intra-batch deduplication requirement, and the hard `sourceReflections.length >= 2` identity rule.

**`guya-plugin/hooks/guya-pre-commit-review.mjs`** — The commit quality gate. Shows `loadConfig` (two-file merge with tri-state JSON read), `getStagedFiles` (shell-aware tokenizer for combined `git add && git commit` commands), `isSmallChange`, and the `validateForCommit` call into `review-evidence.mjs`.

**`guya-plugin/skills/guya-evolve/SKILL.md`** — The full manual evolution workflow. Describes the 7-step cycle (synthesize → present → apply low-blast → apply identity → touch marker → run consolidator → report). The authoritative reference for how `/guya-evolve` works.

**`ARCHITECTURE.md`** — The single most dense document in the repo. Full module map, hook dispatch table, evolution pipeline diagram, plugin delivery pipeline, and complete decision log with rationale for every architectural choice made since 2026-03-30.

**`context/core-beliefs.md`** — The architectural invariants. Contains the decision filters used to evaluate every proposed change. If a proposal violates a belief, the answer is no before any further analysis.

---

## 6. Non-Obvious Things

**`PostToolUse:Bash` never dispatches.** This is a confirmed Claude Code platform constraint (not a bug or misconfiguration). Any hook registered against `PostToolUse:Bash` by name silently never fires. This is why the post-commit scribe runs from a native git hook, not a Claude Code hook. The `Write|Edit` compound matcher in `hooks.json` is the only reliable PostToolUse trigger.

**The plugin cache is not the source tree.** Claude Code executes hooks and the MCP server from `~/.claude/plugins/cache/guya/guya/0.1.0/` — not from `guya-plugin/`. Every source edit requires a sync step. The git post-commit hook runs `sync-plugin.sh` to handle this automatically, but during a mid-session edit without a commit, hooks silently run stale code. Manual sync: `bash scripts/sync-plugin.sh`.

**`resolveProjectRoot(cwd)` is critical for all hooks.** Claude Code sometimes passes a `cwd` of a subdirectory (e.g., `guya-plugin/`) rather than the repo root. Without `resolveProjectRoot`, hooks write `.guya/` state files into phantom locations. All 6 hooks wrap their directory assignment with this call, which uses `git rev-parse --show-toplevel` to find the real root.

**Global identity is a git repo.** `~/.claude/guya/` is initialized as a git repo. Every `/guya-evolve` run that applies changes lands as a discrete commit with a structured message. Full revert history exists for identity-layer edits — the identity files are versioned, not just files on disk.

**The identity snapshot model vs. the core-beliefs invariants.** The `core-beliefs.md` document is not aspirational — it contains hard decision filters ("violation looks like:" examples) that must be checked before every architectural change. Changes that look like any of the violation examples are rejected by definition, even if they seem locally beneficial.

**Three-tier memory with project-local scoping.** `~/.claude/guya/` is Daniel, `.guya/` is this project. Writing Daniel-level facts (his personality, patterns, working style) into the project-local `.guya/` is an ADR-005 violation. Project state (what's in progress, what was shipped) goes into `.guya/` and archival memory, never into `user.md`.

**The `isMain` guard pattern.** Any `.mjs` file that exports functions AND runs as a hook script must use an `isMain` guard: `fileURLToPath(import.meta.url) === process.argv[1]`. Without it, importing a single exported function in tests also runs `main()`, which opens a stdin listener and hangs the test process. Three files learned this the hard way.

**Review evidence uses tree SHA identity, not timestamps alone.** `validateForCommit` in `review-evidence.mjs` computes `git write-tree` at review time and again at commit time. If the tree SHA changed beyond a small-change delta threshold (`maxLines: 10`), the review evidence is considered stale and the commit is blocked. This prevents "review once, edit extensively, commit dirty" patterns.

**Tactical vs. strategic guidelines are scoped differently.** Strategic guidelines live in `~/.claude/guya/guidelines/strategic/` — cross-project, synthesized from reflections, ranked by confidence. Tactical guidelines live in `.guya/evolution/guidelines/tactical/` — project-specific, auto-synthesized from session-end traces. The session-start hook injects both but distinguishes them in the context block.
