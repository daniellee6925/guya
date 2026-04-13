# Guya — Codebase Scout Report

> Generated: 2026-04-13

---

## 1. What Is This?

Guya is a self-evolving personal agent system built as a Claude Code plugin that gives Daniel a persistent, cross-session AI identity — Guya knows who Daniel is, what he's working on, and gets better every session without him explicitly managing it.

---

## 2. System Architecture

Guya has no daemon and no background processes. It is entirely **hook-native**: Claude Code lifecycle hooks (SessionStart, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit) drive all runtime behavior. An MCP server exposes 14 tools for memory, identity, evolution, and introspection. The system splits state into two locations: `~/.claude/guya/` for global identity (travels across all projects) and `.guya/` for project-local memory and evolution state.

**Data flow:**
1. Session opens → `guya-session-start.mjs` assembles identity + guidelines from both locations into a `<guya-context>` system-reminder block (2000-token budget)
2. During session → `guya-trace-capture.mjs` records file edits; `guya-correction-detect.mjs` + `guya-intent-detect.mjs` fire on every user prompt
3. Before commits → `guya-pre-commit-review.mjs` enforces a review evidence gate; `guya-pre-push-check.mjs` enforces push quality checks
4. Session ends → `guya-session-end.mjs` runs the trace classification pipeline (Haiku classify → Sonnet synthesize)
5. Evolution → `/guya-evolve` skill manually synthesizes reflections into guideline proposals, applies them to `~/.claude/guya/`, and commits the identity repo
6. After every git commit → `.git/hooks/post-commit` syncs source to the plugin cache via `sync-plugin.sh`, then invokes the post-commit scribe via a synthetic JSON payload

**Key entry points:** `guya-plugin/hooks/guya-session-start.mjs` (context assembly), `guya-plugin/hooks/hooks.json` (hook dispatch registry), `guya-plugin/tools/server.js` (MCP server), `scripts/sync-plugin.sh` (plugin delivery).

---

## 3. Design Philosophy

**Identity first.** Guya's value over a plain Claude session is exactly proportional to the quality of its accumulated memory. Every architectural decision optimizes for memory quality and retrieval accuracy across sessions. The split between `~/.claude/guya/` (global, git-versioned) and `.guya/` (project-local) reflects this — Daniel's identity is not owned by any one project.

**Hook-native, no daemon.** Background processes are explicitly deferred to v2. Hooks + git hooks + MCP cover everything needed in v1 without infra overhead. This produced one hard-won constraint: `PostToolUse:Bash` does not dispatch in Claude Code, so the post-commit scribe runs from a native git hook with a synthetic payload.

**Manual evolution, not auto-fire.** The reflection → synthesis → apply pipeline is invoked manually via `/guya-evolve`, not at session-end. Auto-fire was rejected after the API key died silently for 6 days with no one noticing. Reflections are deliberate; consumption should be too. A SessionStart nudge surfaces backlog count to prompt Daniel without being aggressive.

**Challenge first, support second.** The soul spec (at `~/.claude/guya/soul.md`) establishes that Guya is named after Daniel's teddy bear — unconditional care, but not comfort over growth. Hard truth over validation.

**Tiered blast-radius for identity edits.** Guidelines and user.md additions apply automatically; changes to soul.md, identity.md, and growth-tracker.md require per-item approval with ≥2 corroborating reflections (anti-oscillation guardrail).

---

## 4. Component Catalog

| Component | Path | Responsibility |
|-----------|------|----------------|
| Hook scripts | `guya-plugin/hooks/` | All Claude Code lifecycle behavior — context assembly, trace capture, correction detection, pre-commit gate, session-end evolution |
| Hook dispatch registry | `guya-plugin/hooks/hooks.json` | Declares which hook fires on which event; the single source of truth for what runs when |
| CommonJS shim | `guya-plugin/hooks/run.cjs` | Bridges Claude Code's CommonJS hook environment to ESM `.mjs` modules |
| Shared utilities | `guya-plugin/hooks/hook-utils.mjs` | `isGitCommit()`, `resolveProjectRoot()`, `readStdin()`, `hasLearningSignal()` — shared by all hooks |
| Review evidence | `guya-plugin/hooks/review-evidence.mjs` | JSONL-based evidence recorder + validator for the pre-commit review gate |
| MCP server | `guya-plugin/tools/server.js` | stdio MCP server; registers 14 tools across 4 groups |
| Memory tools | `guya-plugin/tools/memory-tools.js` | `memory_core_update/append`, `memory_archival_store/search`, `memory_recall_note`, `memory_reflect` |
| Evolution tools | `guya-plugin/tools/evolution-tools.js` | `evolve_consolidate`, `evolve_status`, `evolve_force_synthesize` |
| Identity tools | `guya-plugin/tools/identity-tools.js` | `identity_propose_change`, `identity_read` |
| Introspection tools | `guya-plugin/tools/introspection-tools.js` | `guya_status`, `guya_guidelines`, `guya_traces` |
| Skill definitions | `guya-plugin/skills/` | 20+ skill directories; each has a `SKILL.md` loaded by Claude Code on invocation |
| Agent definitions | `guya-plugin/agents/` | 9 agent prompts for the evolution pipeline and workflow agents (guya-observer, guya-synthesizer, guya-tester, etc.) |
| Reflection synthesis | `guya-plugin/hooks/reflection-synthesis.mjs` | Reads reflections + identity state, calls Sonnet, produces three blast-radius-routed streams |
| Apply synthesis | `guya-plugin/hooks/apply-synthesis-result.mjs` | Applies synthesis output: auto-applies guidelines + user.md, presents identity changes for per-item review |
| Commit identity | `guya-plugin/hooks/commit-identity.mjs` | Git commits applied changes to `~/.claude/guya/` with a meaningful message + NDJSON audit log |
| Plugin sync | `scripts/sync-plugin.sh` | rsync from `guya-plugin/` source to Claude Code plugin cache — runs after every commit |
| Project-local state | `.guya/` | Memory (core, archival, reflections), evolution traces, tactical guidelines, review evidence, decision sessions |
| Global identity | `~/.claude/guya/` | Soul, identity, user profile, growth tracker, strategic guidelines — git repo, versioned |
| Architecture doc | `ARCHITECTURE.md` | Full module map, hook dispatch table, pipeline diagrams, decision log |
| Core beliefs | `context/core-beliefs.md` | The five architectural invariants — first filter on every decision |

---

## 5. Key Files

| File | Why it matters |
|------|----------------|
| `ARCHITECTURE.md` | The single best orientation document — module map, hook dispatch table, plugin delivery pipeline, evolution pipeline, full decision log |
| `context/core-beliefs.md` | The five invariants that define what Guya is; every architecture decision runs through these filters first |
| `guya-plugin/hooks/hooks.json` | Declares every event hook in one place — the authoritative answer to "what runs when?" |
| `guya-plugin/hooks/guya-session-start.mjs` | The most load-bearing file: assembles identity + guidelines into the context block that makes Guya feel like Guya. Also contains `computeReflectionNudge()`, the evolution backlog signal |
| `guya-plugin/tools/server.js` | MCP server entry point — shows how all 14 tools are registered and which are loaded conditionally |
| `guya-plugin/hooks/guya-pre-commit-review.mjs` | The pre-commit gate — layered config (user-wide + project-local), review evidence validation, small-change exemption logic |
| `guya-plugin/hooks/reflection-synthesis.mjs` | Core of the evolution pipeline: reads reflections, calls the Sonnet synthesizer, routes proposals by blast radius |
| `guya-plugin/skills/CLAUDE.md` | Catalog of all 20+ skills with one-line descriptions — good map of what Guya can do |
| `guya-plugin/CLAUDE.md` | Defines spawnable agents, MCP tool inventory, and the 6 key behavioral principles |
| `scripts/sync-plugin.sh` | Critical operational file — without this rsync, source edits are invisible to the running plugin |

---

## 6. Non-Obvious Things

**Plugin cache drift is the most common footgun.** Claude Code runs hooks from `~/.claude/plugins/cache/guya/guya/<version>/`, not from the source tree. Editing `guya-plugin/` and expecting it to take effect immediately will disappoint you. The git post-commit hook runs `sync-plugin.sh` automatically, but mid-session edits require a manual `bash scripts/sync-plugin.sh`. This burned multiple sessions before the sync hook was added.

**`PostToolUse:Bash` is dead in Claude Code.** Confirmed via exhaustive debug (commits 70cd82a–c96c71a). Only `PostToolUse` with wildcard `*` or compound matchers like `Write|Edit` actually dispatch. Any hook registered as `PostToolUse:Bash` silently never fires. The post-commit scribe works around this by running from a native `.git/hooks/post-commit` with a synthetic JSON payload.

**The review gate uses two config layers.** `guya-pre-commit-review.mjs` merges `~/.claude/guya/pre-commit-config.json` (user-wide default) over `.guya/pre-commit-config.json` (project-level). If only the user-wide file exists, the gate still fires. The original single-layer design silently ungated every project that lacked a project config — SDF ran ungated for weeks.

**`isMain` guard is required for every exported hook.** If a `.mjs` hook file is both a script and an import target (for testing), the unguarded `main()` at module bottom fires on import — which opens a stdin listener that hangs the test process. The pattern `const isMain = fileURLToPath(import.meta.url) === process.argv[1]` must appear in every such file.

**Evolution is reflection-driven, not trace-driven.** The legacy trace pipeline (PostToolUse writes JSONL → Haiku classifies → Sonnet synthesizes at SessionEnd) is still wired in `guya-session-end.mjs` but produced near-zero useful guidelines over 6 days of real use. The actual evolution mechanism is `/guya-evolve` → `reflection-synthesis.mjs` → `apply-synthesis-result.mjs`, fed from manual `/guya-reflect` entries. The old pipeline runs but is not the primary signal.

**`~/.claude/guya/` is a git repository.** Every `/guya-evolve` run creates a versioned commit in the identity directory. Identity changes are fully reversible. The audit trail is at `~/.claude/guya/.commit-log` (NDJSON). The `.last-evolved` file is JSON with a `ts` field that drives the SessionStart backlog nudge.

**`resolveProjectRoot(cwd)` matters.** Early hooks used raw `cwd` for `.guya/` paths. When Claude Code fires a hook from a subdirectory (e.g. `guya-plugin/`), the hook would write state into `guya-plugin/.guya/` instead of the repo root. All hooks now call `resolveProjectRoot()` from `hook-utils.mjs`, which runs `git rev-parse --show-toplevel` to normalize.

**Decision harness marker has two states.** `.guya/decisions/.harness-active` is written at harness start (not end) — it gates hook suppression during a decision session. The old `.active-session` marker was written at end, so hooks fired uninhibited during the harness interview. TTL-only (2h) rather than session-ID-keyed, because skills can't reliably obtain the current session ID.
