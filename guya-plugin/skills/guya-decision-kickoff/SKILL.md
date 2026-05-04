---
name: guya-decision-kickoff
description: Staff-engineer-level project kickoff harness. Forces product and architecture thinking from day 1. Produces Phase 0 LOD architecture + detailed implementation plan before any code is written.
---

# Project Kickoff Harness

## Purpose

Starting a new project is your highest-leverage decision point. Get the architecture wrong now and you'll rework it for months. This harness forces you to think through the entire system before writing code. By the end, you have a Phase 0 LOD architecture with file trees, calling specs, and a clear MVP definition.

This is the most intensive harness — 12 questions — because the upside of rigor here is huge.

## How This Works

1. I ask questions one at a time, probing deeply
2. You answer — I synthesize and challenge assumptions
3. After all questions, I synthesize the full picture and ask for alignment
4. I generate:
   - Decision document (`.guya/decisions/kickoff-*.md`)
   - **Full lod-planner plan** (`.guya/plans/kickoff-{name}/` with all 6 files)
     - Phase 0 architecture with target file tree, calling specs, all 9 LOD patterns evaluated
     - Detailed phase breakdown with RED/GREEN/REFACTOR TDD
   - Task with plan referenced
5. `.active-session` marker is written

## The 12 Questions

**Q1: What problem does this project solve?** (1-2 sentences, sharp)
- The "why". Be specific.
- Who's the user and what's their pain?

**Q2: Who is the target user and what is their pain?**
- Be concrete. Not "developers" — what developer? What's their actual problem?
- How urgent is this problem to them?

**Q3: What are the core capabilities at MVP?**
- List the top 3-5 things the system must do
- Be ready to cut ruthlessly

**Q4: What's the technology stack?**
- Language, frameworks, databases, deployment
- Justify each choice — what's the alternative and why didn't you pick it?

**Q5: What are the top-level modules? Sketch a rough file tree.**
- Major components/layers
- LOD Rule 1: no file > 800 LOC estimate
- LOD Rule 2: each file one responsibility
- Give me folder structure, not just a list

**Q6: What are the calling specs for the main entry points?**
- Inputs, outputs, side effects
- This is LOD Rule 5 — explicit interface contracts
- Helps prevent misunderstanding later

**Q7: Walk through the 9 LOD patterns — which ones apply?**
- Radical Fragmentation? Variant Registry? Orchestrator Recipes?
- Schema Separation? Zero-Hallucination Contracts? Others?
- Why or why not for each?

**Q8: What does the first working slice look like?**
- After 4 hours of work, what can the system do?
- Not everything — the minimal prototype that proves the architecture

**Q9: What are the project-level constraints?**
- LOC per file ceiling? LLM cost budget? Latency targets? Throughput?
- Async or sync preferred? Deploy frequency?
- These shape architecture decisions

**Q10: What's the test strategy?**
- Unit/integration/E2E coverage targets per layer
- What gets mocked vs real integration?
- Test pyramid shape

**Q11: What are the biggest technical risks?**
- What could blow up the architecture?
- Scaling? Latency? New technology you're unproven with?
- How will you mitigate?

**Q12: How does this project fit into your other active work?**
- Is this replacing something? Adding to the plate?
- Time commitment and priority?

## Refinement & Synthesis

After I collect your answers, I'll:
- Probe the problem statement (is it really what you think?)
- Challenge the stack choices
- Test the file tree against LOD rules
- Walk through the pattern applicability
- Calibrate the first slice

**Before generating the plan**, read:
1. `ARCHITECTURE.md` — if this project extends an existing system, check the proposed architecture against existing decisions and the Decision Log. Flag conflicts with prior ADRs.
2. `CLAUDE.md` — check the proposed stack and file structure against LOD rules, module responsibility constraints, and project guidelines. A new project should start compliant.
3. `context/core-beliefs.md` (if present) — treat these as hard invariants. Flag any architecture element that violates a core belief before proceeding.
4. `context/vision.md` (if present) — check that the kickoff plan is pointed at the stated vision. A new project that starts misaligned won't correct itself later.

Surface any conflicts in the alignment confirmation: "Here's where this plan bumps against existing architecture or constraints — do you want to proceed or adjust?" Only generate the plan after alignment is confirmed.

## Project Setup (runs after alignment is confirmed, before plan generation)

For new/clean repos this is mandatory. For existing repos, only scaffold what's missing.

**Detect a clean repo:** check for absence of `ARCHITECTURE.md`, `context/`, `STATUS.md`, `.guya/`.

### 1. Scaffold missing docs

Create these files if they don't exist, seeded with content from the 12-question answers:

**`context/core-beliefs.md`** — use the template from `guya-plugin/skills/guya-distinguished-engineer/SKILL.md`. Seed with: project name and one-liner (Q1), differentiator vs alternatives (Q4 stack justification), and 2-3 seed beliefs derived directly from the architecture choices in Q5-Q7. Leave the rest for Daniel to fill in over time. Tell him: "Seeded with 3 beliefs from your architecture decisions — flesh it out with `/guya:guya-distinguished-engineer` once the system has more shape."

**`context/vision.md`** — use the template from `guya-plugin/skills/guya-distinguished-engineer/SKILL.md`. Seed with: one-liner from Q1, MVP capabilities from Q3, and acceptance criteria derived from Q8 (first working slice = first acceptance criterion). Tell him: "Seeded with your MVP scope — add acceptance criteria for each capability as they solidify."

**`ARCHITECTURE.md`** — create with sections: Overview (one paragraph from Q1+Q2), Key Decisions (pre-fill with Phase 0 decisions from Q4-Q7 as ADR entries), Module Map (from Q5 file tree), and a Decision Log header. The post-commit scribe will append to this.

**`STATUS.md`** — create with sections: Current Focus (`Kickoff complete — entering Phase 0`), Recent Changes (empty), In-Progress, TODO, and Known Issues. The post-commit scribe appends here automatically.

### 2. Run guya-setup for clean repos

If `.guya/` doesn't exist (fresh repo), tell Daniel:

> "Fresh repo detected — running `/guya:guya-setup` to wire the post-commit scribe and pre-commit review gate. Do this before your first commit."

Prompt him to run it now, before plan generation, so the hooks are in place from commit 1.

---

## Output

- **Decision doc**: `.guya/decisions/kickoff-{YYYYMMDD-HHMM}.md`
- **LOD Plan**: `docs/plans/PLAN_{name}/` (all 6 files, following lod-planner format)
  - `00-overview.md` — metadata, test strategy, architecture decisions
  - `01-phase0-architecture.md` — file tree, calling specs, LOD pattern evaluation
  - `02-phase1-*.md` through phase N — TDD implementation phases
  - `checklist.md` — final LOD compliance
  - `risks.md` — risk table + rollback
  - `notes.md` — living implementation log
- **Scaffolded docs**: `context/core-beliefs.md`, `context/vision.md`, `ARCHITECTURE.md`, `STATUS.md` (if new repo)
- **Task**: Created with plan path

Generate the plan using lod-planner's full workflow — read `lod-planner/SKILL.md` from the plugin or Desktop for the exact phase format, pattern detection guide, and quality gate standards. The 12-question answers give you everything lod-planner needs: requirements (Q1-Q3), stack (Q4), file tree (Q5), calling specs (Q6), patterns (Q7), first slice (Q8), constraints (Q9), test strategy (Q10), risks (Q11).

This is the most detailed output of all harnesses because new projects have the longest runway.

## Agent Integration

- After plan generation, offer to spawn `guya:guya-tester` to scaffold the test structure (maps to Q10 answers)
- After plan generation, offer to spawn `guya:guya-document` to generate documentation for new modules and entry points
- After plan generation, prompt: "Run `/guya:guya-scribe arch: [decision summary]` to record the Phase 0 architecture and key decisions in ARCHITECTURE.md"

## Post-Implementation Workflow

After implementation is complete:
1. **Commit** — pre-commit hook runs `guya-review` automatically. Fix any issues it surfaces, then re-commit.
2. **Complex changes** — run `/guya:guya-deep-review` manually before committing to get ahead of issues rather than reacting to them.

## Marker Management (MANDATORY — before Q1)

Before asking Q1, create `.guya/decisions/` if it doesn't exist and write `.guya/decisions/.harness-active` containing:

    {"type": "kickoff", "started_at": "<current ISO8601 timestamp>"}

This tells Guya's UserPromptSubmit hooks that the user is answering domain questions during a harness, not issuing work commands (decision-gate would otherwise block every work verb), not reloading project context (intent-detect would spam archival), and not giving behavioral corrections to Guya (correction-detect would save answers as fake guidelines).

Remove the marker (`rm .guya/decisions/.harness-active`) when:
- Plan generation completes successfully
- The user aborts the harness
- Any step fails irrecoverably

The marker auto-expires after 2 hours as a crash-recovery safety net.

---

# Let's Start

**Q1: What problem does this project solve?** (1-2 sentences, be sharp)
