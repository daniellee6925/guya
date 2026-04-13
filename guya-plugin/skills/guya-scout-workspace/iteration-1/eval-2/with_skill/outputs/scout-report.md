# Scout Report — guya-plugin/skills

> Generated: 2026-04-13
> Target: /Users/daniel/Desktop/guya/guya-plugin/skills

---

## 1. What Is This?

A catalog of 20 Claude Code skill definitions for Guya, Daniel's self-evolving personal agent — each skill is a reusable workflow template invoked via slash command or trigger phrase, covering everything from identity bootstrapping and memory evolution to staff-engineer decision harnesses and code review.

---

## 2. System Architecture

Every skill is a self-contained directory containing a single `SKILL.md` file. The skill's YAML frontmatter (`name`, `description`, optional `argument-hint`) tells Claude Code when to trigger the skill and how to surface it in the `/` command menu. The body of `SKILL.md` is the full workflow — step-by-step instructions Claude executes, including what tools to call, what agents to spawn, and what files to read or write.

The directory has two meta-files: `CLAUDE.md` (the skills index, loaded at session start as a system-reminder) and `AGENTS.md` (agent routing reference, mirrors the catalog in table form). One skill (`guya-skill-creator`) has an additional `agents/` subdirectory with two specialist agent definitions (`analyzer.md`, `grader.md`) used during skill evals. `guya-scout-workspace/` is a separate workspace for testing the scout skill itself.

Data flow: Claude Code session start → loads `CLAUDE.md` as system-reminder → user types `/guya-<name>` or matching trigger phrase → Claude reads the corresponding `SKILL.md` → executes the workflow inline (spawning subagents, calling MCP tools, writing files as directed).

Entry points: every `SKILL.md` frontmatter `description` field is effectively a trigger spec — Claude Code matches user intent against all loaded descriptions.

---

## 3. Design Philosophy

Skills are **pure workflows, not code** — the instruction set is markdown prose, not imperative logic, which means they're readable, diffable, and editable by Daniel directly without touching source code. The `guya-skill-creator` skill enforces an eval-driven improvement loop (with-skill vs baseline comparisons, blind grading) so skill quality is measurable, not subjective. Decision harnesses (feature, bugfix, kickoff, refactor) all share the same structural pattern: N probing questions one at a time → synthesis → alignment check → generate decision doc + lod-planner plan + `.active-session` marker. This parallel structure makes the harnesses learnable as a family, not as isolated tools. The review chain (review → deep-review → pr) is explicitly sequential and enforced by a pre-commit gate — structural quality gates before correctness gates before PR-level gates.

---

## 4. Component Catalog

| Component | Path | Responsibility |
|-----------|------|----------------|
| Skills index | `CLAUDE.md` | Master catalog loaded at session start; defines all skill names, purposes, and the guya-setup rationale |
| Agent routing reference | `AGENTS.md` | Mirror of CLAUDE.md in table form; used by agent-routing decisions |
| guya-bootstrap | `guya-bootstrap/SKILL.md` | First-run interview; builds `~/.claude/guya/user.md` from scratch |
| guya-status | `guya-status/SKILL.md` | Introspection snapshot: memory counts, guideline inventory, trace stats |
| guya-evolve | `guya-evolve/SKILL.md` | Self-edit entry point: reads reflections → synthesizes proposals → Daniel reviews → applies to `~/.claude/guya/` |
| guya-reflect | `guya-reflect/SKILL.md` | Two-sided post-session reflection: Daniel's takeaways + Guya's own mistakes |
| guya-forget | `guya-forget/SKILL.md` | Remove a specific guideline or memory by content match |
| guya-scribe | `guya-scribe/SKILL.md` | Update STATUS.md, ARCHITECTURE.md, and per-module CLAUDE.md files |
| guya-obsidian-sync | `guya-obsidian-sync/SKILL.md` | Push growth tracker and project entities to Obsidian vault |
| guya-setup | `guya-setup/SKILL.md` | Install post-commit and pre-commit git hooks into any repo |
| guya-decision-feature | `guya-decision-feature/SKILL.md` | 10-question feature harness → decision doc + lod-planner plan |
| guya-decision-bugfix | `guya-decision-bugfix/SKILL.md` | 8-question bugfix harness → root-cause doc + fix plan |
| guya-decision-kickoff | `guya-decision-kickoff/SKILL.md` | 12-question project kickoff → Phase 0 LOD architecture + full plan |
| guya-decision-refactor | `guya-decision-refactor/SKILL.md` | 8-question refactor harness → behavior-preservation doc + rollback plan |
| guya-distinguished-engineer | `guya-distinguished-engineer/SKILL.md` | Project direction harness: discuss/update/review `context/core-beliefs.md` and `context/vision.md` |
| guya-review | `guya-review/SKILL.md` | Single-pass Karpathy review: simplicity, surgical changes, silent errors, scalability, security, race conditions |
| guya-deep-review | `guya-deep-review/SKILL.md` | Second-pass review: logic correctness, state management, data integrity, performance, observability |
| guya-pr | `guya-pr/SKILL.md` | PR-level readiness: Codex independent review, breaking changes, migration checks, PR description |
| guya-optimize | `guya-optimize/SKILL.md` | Report-only analysis: simplification, performance, I/O, concurrency, resource efficiency |
| guya-learn | `guya-learn/SKILL.md` | Socratic learning from first principles with active recall and progress tracking via `~/.claude/learn/` |
| guya-scout | `guya-scout/SKILL.md` | Codebase onboarding: exploration subagent → report.md → interactive Q&A session |
| guya-skill-creator | `guya-skill-creator/SKILL.md` | Create, test, and eval new skills; contains `agents/analyzer.md` and `agents/grader.md` for eval pipeline |
| Skill creator agents | `guya-skill-creator/agents/` | `analyzer.md` (post-hoc win/loss analysis) + `grader.md` (blind comparison grader) |
| Scout workspace | `guya-scout-workspace/` | Eval workspace for testing guya-scout across iterations |

---

## 5. Key Files

1. **`CLAUDE.md`** — The canonical skills index. Loaded as a system-reminder every session. Read this to understand the full catalog and how skills fit into Guya's architecture. Contains the guya-setup rationale (why a git hook instead of a Claude hook).

2. **`guya-decision-feature/SKILL.md`** — Representative decision harness. All four harnesses (feature, bugfix, kickoff, refactor) share the same structural pattern. Read one and you understand all four; the differences are only in question count and output focus.

3. **`guya-evolve/SKILL.md`** — The self-evolution entry point. The most architecturally significant skill — explains why manual invocation was chosen over auto-fire, and how reflections become actual self-edits.

4. **`guya-review/SKILL.md`** — Defines the review chain entry point. Understanding this skill (and why `guya-deep-review` is a separate second pass) explains how the pre-commit quality gate works.

5. **`guya-skill-creator/SKILL.md`** — The meta-skill. Shows how new skills are created, tested, and evaluated. The `agents/` subdirectory is the only case where a skill has supporting agent definitions — important for understanding how evals work.

6. **`guya-scout/SKILL.md`** — The skill you're currently reading. Two-phase: exploration (this report) then interactive Q&A. Good example of a skill that spawns a subagent and produces a persistent artifact.

---

## 6. Non-Obvious Things

**`guya-skill-creator` is the only skill with subdirectory agents.** Every other skill is a flat `SKILL.md`. `guya-skill-creator/agents/` contains `analyzer.md` and `grader.md` — specialist agents used in the eval pipeline (blind comparison grading and post-hoc analysis). This is the only place in the skills directory where agent definitions live alongside a skill.

**AGENTS.md is stale relative to CLAUDE.md.** AGENTS.md lists 15 skills and was generated 2026-04-09. CLAUDE.md lists 20+ skills and is more recently maintained. The canonical source is CLAUDE.md — AGENTS.md is a secondary routing reference and may lag.

**Decision harnesses write `.guya/decisions/.harness-active` as a guard.** This prevents other hooks (correction-detect, intent-detect, decision-gate) from interfering during the interview. The marker is removed when the harness completes or Daniel aborts. If you see a stale `.harness-active` file, that's a sign a harness was interrupted.

**The review chain is strictly ordered and gate-enforced.** `guya-review` → `guya-deep-review` → `guya-pr` is not a suggestion — the pre-commit gate requires both review passes before a commit is allowed. `guya-pr` explicitly states it assumes guya-review and guya-deep-review have already run.

**`guya-optimize` is report-only by design.** It never applies fixes. This is a deliberate trade-off: optimizations involve readability-vs-performance choices that require Daniel's judgment. The skill is read-only by architectural decision, not by omission.

**`guya-obsidian-sync` has a full mode vs incremental mode.** Passing `full` as an argument triggers a complete rewrite of the vault pages; no argument does an incremental update. The argument-hint documents this but it's easy to miss.

**`guya-setup` exists because `PostToolUse:Bash` doesn't dispatch in Claude Code.** The post-commit scribe can't be wired to a Claude Code hook — it has to be a native git hook. `guya-setup` is the manual installation step that works around this platform constraint. Without running it, the post-commit scribe never fires.
