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
- Confirm alignment before generating Phase 0 + full plan

## Output

- **Decision doc**: `.guya/decisions/kickoff-{YYYYMMDD-HHMM}.md`
- **Full Plan**: `.guya/plans/kickoff-{name}/` (all 6 files, ready for TDD)
  - `00-overview.md` — metadata, test strategy, architecture decisions
  - `01-phase0-architecture.md` — file tree, calling specs, LOD pattern evaluation
  - `02-phase1-*.md` through phase N — TDD implementation phases
  - `checklist.md` — final LOD compliance
  - `risks.md` — risk table + rollback
  - `notes.md` — living implementation log
- **Task**: Created with plan path

This is the most detailed output of all harnesses because new projects have the longest runway.

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
