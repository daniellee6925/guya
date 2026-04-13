# guya-plugin/skills — Scout Report

> Target: `/Users/daniel/Desktop/guya/guya-plugin/skills/`
> Generated: 2026-04-13

---

## 1. What Is This?

The `guya-plugin/skills/` directory is the complete library of reusable workflow templates that power Guya's capabilities — each skill is a named, invocable unit of behavior that Claude Code loads when triggered by a matching phrase or explicit slash-command.

---

## 2. System Architecture

Skills are the outermost layer of Guya's behavior system. The delivery model is straightforward: Claude Code reads `SKILL.md` files into context when a skill is invoked, making the skill's instructions available to the model for that session. No skill contains runtime code of its own — they are markdown instruction sets.

The directory sits inside `guya-plugin/`, which is the Claude Code plugin package. Skills are registered globally and are available in any project where the plugin is installed. The plugin's `CLAUDE.md` acts as a routing layer: it names the spawnable agents (Sonnet/Haiku/Opus subagents) and lists MCP tools, but skills are the primary user-facing interface.

Data flow for a typical skill invocation:
```
User types trigger phrase
  → Claude Code matches skill description
  → SKILL.md loaded into context
  → Model executes the workflow (reads files, runs bash, spawns subagents, writes outputs)
  → Artifacts written to .guya/ or ~/.claude/guya/
```

Skills can spawn subagents (defined in `guya-plugin/CLAUDE.md`), call MCP tools, and write persistent artifacts. The more complex skills (decision harnesses, guya-pr) have multi-step flows with intermediate checkpoints.

---

## 3. Design Philosophy

Skills follow four visible design principles:

1. **Structured thinking over raw capability.** The decision harnesses (bugfix, feature, kickoff, refactor) exist specifically to force structured thinking before any implementation begins. The philosophy: "wrong questions asked early cost less than wrong code written late."

2. **Two-sided accountability.** `guya-reflect` exemplifies this: it doesn't just surface feedback for Daniel — it requires Guya to name its own mistakes. The system is designed to make both parties accountable.

3. **Report, don't fix (where trade-offs exist).** `guya-optimize` and `guya-review` generate findings but don't apply them — optimizations involve trade-offs that require judgment. Fixes are a separate decision.

4. **Minimal skill count, maximum coverage.** Skills are organized to avoid overlap: `guya-review` handles commit-level quality, `guya-deep-review` handles second-pass logic bugs, and `guya-pr` handles PR-level readiness. Each covers a distinct phase.

Design guidance lives in `CLAUDE.md` and `AGENTS.md`. New skills are expected to follow the anatomy pattern described in `guya-skill-creator/SKILL.md`.

---

## 4. Component Catalog

| Skill | Path | Responsibility |
|-------|------|----------------|
| guya-bootstrap | `guya-bootstrap/` | First-run profile interview; writes `~/.claude/guya/user.md` |
| guya-status | `guya-status/` | Introspection: shows guidelines, memory counts, traces, identity |
| guya-evolve | `guya-evolve/` | Self-evolution entry point: reads reflections → Sonnet synthesis → apply changes |
| guya-reflect | `guya-reflect/` | Post-session reflection: Daniel's takeaways + Guya's self-corrections |
| guya-forget | `guya-forget/` | Remove a specific guideline, memory block, or learned behavior |
| guya-scribe | `guya-scribe/` | Keep STATUS.md, ARCHITECTURE.md, and CLAUDE.md current after any significant change |
| guya-obsidian-sync | `guya-obsidian-sync/` | Push growth tracker, project entities, and session insights to Obsidian vault |
| guya-setup | `guya-setup/` | Install post-commit and pre-commit git hooks into any repo (run once per repo) |
| guya-skill-creator | `guya-skill-creator/` | Create, test, and improve skills via eval harness (with-skill vs baseline runs) |
| guya-decision-feature | `guya-decision-feature/` | 10-question staff-engineer harness for new features; produces decision doc + lod-planner plan |
| guya-decision-bugfix | `guya-decision-bugfix/` | 8-question root-cause harness for bugs; produces diagnosis + fix strategy + verification plan |
| guya-decision-kickoff | `guya-decision-kickoff/` | 12-question project kickoff harness; produces Phase 0 LOD architecture + full implementation plan |
| guya-decision-refactor | `guya-decision-refactor/` | 8-question refactor harness; forces scoping + behavior preservation contract |
| guya-distinguished-engineer | `guya-distinguished-engineer/` | Project direction harness; maintains `context/core-beliefs.md` and `context/vision.md` |
| guya-review | `guya-review/` | Karpathy-principles code review: simplicity, surgical changes, silent errors, scalability, security, race conditions |
| guya-deep-review | `guya-deep-review/` | Second-pass review after guya-review findings are fixed; catches logic bugs, state issues, data integrity gaps |
| guya-pr | `guya-pr/` | Pre-PR preparation: Codex fresh-eyes pass, readiness checklist, cross-diff consistency, PR summary draft |
| guya-optimize | `guya-optimize/` | Report-only analysis of simplicity, performance, memory, I/O, and LLM cost opportunities |
| guya-learn | `guya-learn/` | Socratic learning sessions from first principles with active recall and progress tracking per topic |
| guya-scout | `guya-scout/` | Codebase onboarding: Explore subagent generates report, then bidirectional Q&A session |

Supporting directories:

| Directory | Purpose |
|-----------|---------|
| `guya-scout-workspace/` | Eval workspace for guya-scout iterations (evals.json, with/without-skill run outputs) |
| `guya-skill-creator/agents/` | Subagent definitions used by guya-skill-creator: `grader.md`, `analyzer.md` |

---

## 5. Key Files

| File | Why it matters |
|------|----------------|
| `CLAUDE.md` | Master catalog with categorized skill table and detailed explanation of `guya-setup`'s why. First read for the full picture. |
| `AGENTS.md` | Agent-routing reference — same catalog in a format scanned by agent routing logic. |
| `guya-skill-creator/SKILL.md` | Defines the canonical skill anatomy (`scripts/`, `references/`, `assets/`), SKILL.md frontmatter format, and the full eval harness workflow. The authoritative guide for adding any new skill. |
| `guya-scout/SKILL.md` | Best example of a two-phase skill with a subagent (Explore) and an interactive follow-up session. Good structural template. |
| `guya-decision-feature/SKILL.md` | Representative decision harness — shows the 10-question flow, `.active-session` marker pattern, and lod-planner output format. |
| `guya-evolve/SKILL.md` | Closes the reflection → synthesis → apply loop. Shows how skills call into `guya-plugin/hooks/` scripts via Bash. |
| `guya-skill-creator/agents/grader.md` | Detailed grader agent spec — shows how eval outputs are scored, how claims are extracted and verified, and the grading.json output format. |

---

## 6. Non-Obvious Things

**SKILL.md frontmatter is the trigger mechanism.** The `description` field in the YAML frontmatter at the top of every SKILL.md is what Claude Code uses to match the skill to user intent. This means the description has to be slightly over-specified and "pushy" — Claude undertriggers by default, so the description intentionally leans toward broader matching. The `argument-hint` field documents optional inline arguments (e.g., a file path, a branch name) that can be passed after the slash command.

**Skills can call into `guya-plugin/hooks/` scripts.** The `guya-evolve` skill directly invokes `guya-plugin/hooks/reflection-synthesis.mjs` via a Bash node one-shot. Skills are not self-contained — they are the orchestration layer over a deeper infrastructure.

**The `.active-session` marker pattern prevents hook interference.** Several skills (guya-skill-creator, decision harnesses) write a `.guya/decisions/.harness-active` marker before starting their interview flows. This tells the correction-detect and intent-detect hooks to stand down. Without this, the hooks would try to classify in-progress work as user corrections and interfere with the skill's own flow.

**guya-setup exists because `PostToolUse:Bash` doesn't dispatch in Claude Code.** The post-commit scribe can't be driven by a Claude Code hook — it has to be a native git hook. `guya-setup` bridges this gap: one command per repo wires the git hook. It's a workaround for a platform constraint, not a design preference.

**The eval harness runs with-skill and without-skill in parallel.** `guya-skill-creator` always spawns two subagents simultaneously for each test case — one following the SKILL.md, one as a raw baseline. This is how skill value is measured: not against an abstract rubric, but against what Claude does without the skill at all.

**Skills do not store state between sessions.** All persistence goes through MCP tools (`memory_core_update`, `memory_recall_note`, etc.) or direct file writes to `~/.claude/guya/` or `.guya/`. The `guya-learn` skill uses `~/.claude/learn/<topic-slug>.md` for per-topic progress. Skills are stateless instruction sets; the memory infrastructure is what persists.

**`guya-skill-creator` has its own subagent definitions.** The `agents/` subdirectory contains `grader.md` and `analyzer.md` — specialized agents the skill creator spawns during eval runs. This is the only skill that has its own agent directory; others rely on the shared agents defined in `guya-plugin/CLAUDE.md`.
