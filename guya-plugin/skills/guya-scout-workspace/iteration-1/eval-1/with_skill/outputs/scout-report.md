# Scout Report — Guya

> Generated: 2026-04-13

---

## 1. What Is This?

Guya is a self-evolving personal agent system for a single user (Daniel) that runs as a Claude Code plugin — injecting identity, memory, and behavioral guidelines at every session start and improving itself through a reflection-driven evolution pipeline, all without a background daemon.

---

## 2. System Architecture

The system has three interlocking layers: **identity storage**, **hook-driven runtime**, and **an evolution pipeline**. At session start, `guya-session-start.mjs` reads identity files from a global git repo at `~/.claude/guya/` (soul, user profile, guidelines) and project-local core memory from `.guya/memory/core/`, then assembles a `<guya-context>` system-reminder block (2000-token budget) that is injected into the Claude Code session before the first message. During a session, lifecycle hooks fire on key events: `UserPromptSubmit` triggers correction/intent detection (fast regex, no LLM calls); `PreToolUse:Bash` enforces a pre-commit review gate; `PostToolUse:Write|Edit` captures file-edit traces; and `SessionEnd`/`PreCompact` runs a legacy trace-classification pipeline (haiku → sonnet, mostly superseded). After a session, Daniel runs `/guya-evolve` manually: `reflection-synthesis.mjs` calls Sonnet to read recent reflections and produce three routed streams (guideline edits, user profile additions, identity proposals), `apply-synthesis-result.mjs` applies the low-blast items automatically, identity proposals go through per-item review, and `commit-identity.mjs` lands every change as a discrete git commit in `~/.claude/guya/`. A git post-commit hook in each repo calls `sync-plugin.sh` (rsync source → Claude Code plugin cache) and then invokes `guya-post-commit-scribe.mjs` to append the commit to `STATUS.md`.

The key data flow is: `session start → context injection → work → /guya-reflect → /guya-evolve → apply to ~/.claude/guya/ → next session picks up the changes`.

---

## 3. Design Philosophy

The system is built around five hard constraints documented in `context/core-beliefs.md` and `ARCHITECTURE.md`: (1) **No daemon** — all behavior is hook-native; if it can't be a hook, it waits for v2. (2) **Global identity + project-local memory** — `~/.claude/guya/` travels with Daniel across all repos; `.guya/` is project-specific. (3) **Manual evolution** — `/guya-evolve` is manually invoked by design after auto-fire was rejected when an API key outage went unnoticed for 6 days; reflections are deliberate so consumption should be too. (4) **Blast-radius routing** — guideline edits auto-apply; identity edits require per-item approval; identity proposals require ≥2 source reflections (anti-oscillation guardrail). (5) **Challenge first, support second** — the soul spec explicitly prioritizes growth over comfort, named after Daniel's teddy bear of 20 years. The LLM-Oriented Design Patterns from the global `~/.claude/CLAUDE.md` apply throughout: 800 LOC max, one file one responsibility, calling specs at the top of every module, pure functions over methods.

---

## 4. Component Catalog

| Component | Path | Responsibility |
|-----------|------|---------------|
| Plugin entry point | `guya-plugin/.claude-plugin/plugin.json` | Declares skills dir and MCP server config for Claude Code |
| Hook registry | `guya-plugin/hooks/hooks.json` | Maps Claude Code lifecycle events → hook scripts |
| Hook shim | `guya-plugin/hooks/run.cjs` | CommonJS entry point that bootstraps ESM `.mjs` hook scripts |
| Session start hook | `guya-plugin/hooks/guya-session-start.mjs` | Assembles `<guya-context>` from identity + memory + guidelines; lazy-inits `.guya/` |
| Session end hook | `guya-plugin/hooks/guya-session-end.mjs` | Legacy trace classify + synthesize pipeline (haiku → sonnet); runs on SessionEnd + PreCompact |
| Trace capture hook | `guya-plugin/hooks/guya-trace-capture.mjs` | Appends JSONL trace entry on PostToolUse:Write\|Edit |
| Correction detect hook | `guya-plugin/hooks/guya-correction-detect.mjs` | Fast regex detection of correction signals in user prompts |
| Pre-commit review hook | `guya-plugin/hooks/guya-pre-commit-review.mjs` | Blocks `git commit` if no review evidence exists; records evidence when review skills run |
| Pre-push check hook | `guya-plugin/hooks/guya-pre-push-check.mjs` | Runs quality checks before `git push` |
| Post-commit scribe | `guya-plugin/hooks/guya-post-commit-scribe.mjs` | Invoked by git hook; appends commit to STATUS.md, resets review gate |
| Hook utilities | `guya-plugin/hooks/hook-utils.mjs` | Shared helpers: `isGitCommit`, `resolveProjectRoot`, `readStdin`, `hasLearningSignal` |
| Review evidence | `guya-plugin/hooks/review-evidence.mjs` | Reads/writes `.guya/evolution/review-evidence.jsonl`; validates for commit |
| Reflection synthesis | `guya-plugin/hooks/reflection-synthesis.mjs` | Calls Sonnet (reflection-synthesizer agent) to produce three-stream proposals from reflections |
| Apply synthesis | `guya-plugin/hooks/apply-synthesis-result.mjs` | Applies approved guideline edits and user profile additions to `~/.claude/guya/` |
| Commit identity | `guya-plugin/hooks/commit-identity.mjs` | Git commits applied changes to `~/.claude/guya/` with structured messages + NDJSON audit trail |
| MCP server | `guya-plugin/tools/server.js` | stdio MCP server; conditionally loads four tool groups |
| Memory tools | `guya-plugin/tools/memory-tools.js` | 6 MCP tools: core update/append, archival store/search, recall note, reflect |
| Introspection tools | `guya-plugin/tools/introspection-tools.js` | 3 MCP tools: guya_status, guya_guidelines, guya_traces |
| Evolution tools | `guya-plugin/tools/evolution-tools.js` | 3 MCP tools: evolve_consolidate, evolve_status, evolve_force_synthesize |
| Identity tools | `guya-plugin/tools/identity-tools.js` | 2 MCP tools: identity_propose_change, identity_read |
| Skills | `guya-plugin/skills/*/SKILL.md` | 20+ skill definitions (each a SKILL.md Claude Code loads when triggered) |
| Agents | `guya-plugin/agents/*.md` | 9 agent definitions spawnable via the Agent tool |
| Plugin sync script | `scripts/sync-plugin.sh` | rsync from source → Claude Code plugin cache; called by git post-commit hook |
| Project-local state | `.guya/` | Memory (core/archival/reflections), evolution (traces/guidelines/review-gate), decisions |
| Global identity repo | `~/.claude/guya/` | soul.md, user.md, growth-tracker.md, strategic guidelines — versioned git repo |
| Core beliefs | `context/core-beliefs.md` | Architectural invariants that define what Guya is (not can't-change, but decision filters) |
| Vision | `context/vision.md` | Acceptance criteria for each major feature, north-star goals |

---

## 5. Key Files

1. **`guya-plugin/hooks/guya-session-start.mjs`** — The hot path. Every session runs this. It defines what Daniel sees at the start of every conversation: priority-ordered context assembly, 2000-token budget enforcement, lazy `.guya/` init, and the reflection backlog nudge. Understanding this file = understanding how context injection works.

2. **`ARCHITECTURE.md`** — The single best reference for how the whole system fits together. Covers module map, hook dispatch table, plugin delivery pipeline, evolution pipeline, context assembly, pre-commit gate, and every ADR. Read this before touching anything.

3. **`guya-plugin/hooks/hooks.json`** — Defines which lifecycle events trigger which hooks. If a hook isn't firing, start here. Contains the key constraint: `PostToolUse:Bash` never dispatches; only `Write|Edit` compound matchers work.

4. **`guya-plugin/hooks/reflection-synthesis.mjs`** — The core of the evolution pipeline. Calls Sonnet via the reflection-synthesizer agent to turn reflections into three routed output streams. The anti-oscillation guardrail (`minReflectionsForIdentityChange = 2`) lives here.

5. **`guya-plugin/hooks/apply-synthesis-result.mjs`** — The other half of evolution: takes the synthesizer's output and writes it to disk. Handles guideline creation and `user.md` appendBulletToSection. Identity proposals are NOT here — the skill applies those directly with per-item review.

6. **`guya-plugin/tools/server.js`** — MCP server entry point. Loads all four tool groups conditionally (memory, introspection, evolution, identity). The tool surface Daniel (and Guya) can call during a session.

7. **`guya-plugin/hooks/guya-pre-commit-review.mjs`** — The quality gate. Understands tri-state config loading (project-level overrides user-wide), review evidence validation, small change exemptions, and `--no-verify` detection. Understand this before making commits.

8. **`context/core-beliefs.md`** — Five architectural invariants with decision filters. If you're proposing a change and it violates one of these beliefs, the answer is no. Read this before designing any new feature.

9. **`guya-plugin/agents/guya-reflection-synthesizer.md`** — System prompt for the Sonnet agent that drives evolution. Defines routing rules, blast-radius classification, anti-oscillation guardrail, and output contract. The highest-signal document for understanding how the LLM layer works.

10. **`STATUS.md`** — Living project log. Contains the current focus, recent changes (appended by post-commit scribe), in-progress items, TODO with root causes and fix decisions, and a detailed decision log. The institutional memory of how the system was built.

---

## 6. Non-Obvious Things

**PostToolUse:Bash never dispatches.** This is the single biggest gotcha. `PostToolUse` works only with `Write|Edit` compound matchers in Claude Code. Any hook wired to `PostToolUse:Bash` is dead. The post-commit scribe works around this by running as a native git hook (`.git/hooks/post-commit`) and piping a synthetic JSON payload to itself — this is why `guya-setup` exists as a skill and must be run in each repo.

**Two `.guya/` directories.** The repo root `.guya/` is project-local state. `guya-plugin/.guya/` exists because Claude Code's cwd when working inside the `guya-plugin/` subdirectory was `guya-plugin/`, and hooks wrote state there by accident. `resolveProjectRoot(cwd)` (in `hook-utils.mjs`) now walks up to the nearest `.guya/` to fix this — but both dirs exist in the repo as historical artifacts.

**Plugin cache drift.** Claude Code runs hooks from `~/.claude/plugins/cache/guya/guya/<version>/`, not from the source repo. Editing `guya-plugin/` doesn't affect the running system until `sync-plugin.sh` runs. This is why every commit fires `sync-plugin.sh` via the git post-commit hook. If you're debugging a hook and your changes aren't taking effect, run `bash scripts/sync-plugin.sh` manually.

**`~/.claude/guya/` is a git repo.** Every `/guya-evolve` run creates commits there. Identity changes are fully reversible via `git revert`. The `.commit-log` file (NDJSON) provides a structured audit trail independent of git.

**The identity source of truth is NOT in this repo.** `soul.md`, `user.md`, `growth-tracker.md`, and strategic guidelines live at `~/.claude/guya/` — outside the guya project repo entirely. Changes to those files must go through `/guya-evolve` (or direct edit + `commit-identity.mjs`) to be tracked.

**Review evidence vs. review gate.** There are TWO review state files: the current system uses `review-evidence.jsonl` (append-only JSONL with initial + followup steps and tree SHAs). The old system used `review-gate.json` (a single boolean). Both exist in `.guya/evolution/` but `review-gate.json` is dead — only the post-commit scribe still touches it, and that's a known cleanup item (STATUS.md TODO, LOW priority).

**Tactical guidelines have zombie files.** `.guya/evolution/guidelines/tactical/1775671829028.md` and `1775672037132.md` contain raw user-prompt text from a removed code path, not actual guidelines. They'll be picked up by session-start's guideline assembly unless deleted.

**`hasLearningSignal` is broken.** In `hook-utils.mjs`, the tool-name parser does `content.replace('Tool: ', '')` but `trace-capture.mjs` writes `"Edit: app.py"` format. After the replace the content is still `"edit: app.py"` which doesn't match `'edit'` in the allowlist. File-edit traces silently fall through to `return false`. Documented in STATUS.md TODO as LOW severity.
