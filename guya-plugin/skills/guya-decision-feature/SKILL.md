---
name: guya-decision-feature
description: Staff-engineer-level decision harness for new features in existing projects. Forces scope, constraints, and success criteria definition before any planning or implementation.
---

# Feature Decision Harness

## Purpose

This skill forces you to think like a staff engineer before building anything. You'll walk through 10 probing questions that surface scope creep, missing constraints, and architectural risks. By the end, you have a clear decision doc and a detailed lod-planner-style implementation plan — with no ambiguity.

## How This Works

1. I ask questions one at a time
2. You answer — I'll probe deeper if answers are vague or miss key thinking
3. After all questions, I synthesize what we learned and ask if we're aligned
4. I generate:
   - Decision document (`.guya/decisions/feature-*.md`)
   - Detailed plan (`.guya/plans/feature-{name}/` with 6 files in lod-planner format)
   - Task with plan referenced
5. `.active-session` marker is written so the enforcement hook knows a decision is active

## The 10 Questions

**Q1: What problem does this solve?**
- Before talking *what* we're building, establish *why*
- Should be 1-2 sentences, sharp

**Q2: Why now? What's the forcing function?**
- Priority context. Why are we doing this instead of something else?
- Forces you to articulate leverage

**Q3: What's the minimum viable version?**
- Ruthlessly narrow the scope. What's the smallest thing that solves Q1?
- I will push back on scope creep here

**Q4: What are you explicitly NOT building?**
- Clarify boundaries. What looks like it's in scope but actually isn't?

**Q5: What does "done" look like?**
- Success criteria. Measurable, concrete
- "Works" is not enough — give me specifics

**Q6: What does this touch in the existing codebase?**
- Which modules? Pipeline stages? ContextKeys?
- Helps us think about integration points and risk

**Q7: What's the blast radius if it breaks?**
- What other features could be affected?
- Helps calibrate how careful we need to be

**Q8: What are the constraints?**
- LOC budget per file? LLM cost ceiling? Latency target? Time?
- Every real project has constraints — name them

**Q9: Which LOD patterns are relevant?**
- New variants? New orchestrator? Schema changes? Plugin registry usage?
- Sketches the architecture early

**Q10: How will you test it?**
- Unit/integration/E2E. Coverage targets. What to mock vs hit for real?
- Think about test pyramid, not just "write tests"

## Refinement & Synthesis

After I collect your answers, I'll:
- Synthesize what we learned
- Call out gaps or risks that stood out
- Challenge weak reasoning ("Why is that the right constraint?")

**Before generating the plan**, read:
1. `ARCHITECTURE.md` — check the proposed feature direction against existing architectural decisions and the Decision Log. Flag if this contradicts or duplicates a prior ADR.
2. `CLAUDE.md` — check against LOD rules, file size constraints, module responsibilities, and project guidelines. Flag violations before proceeding.
3. `context/core-beliefs.md` (if present) — treat these as hard invariants. Flag any plan element that violates a core belief before proceeding.
4. `context/vision.md` (if present) — check that the feature moves toward the stated vision, not away from it.

Surface any conflicts in the alignment confirmation: "Here's where this plan bumps against existing architecture or constraints — do you want to proceed or adjust?" Only generate the plan after alignment is confirmed.

## Output

You'll get:
- **Decision doc**: `.guya/decisions/feature-{YYYYMMDD-HHMM}.md` — your answers + staff-engineer analysis
- **Plan**: `.guya/plans/feature-{name}/` with all 6 files (lod-planner format)
  - `00-overview.md` — status, metadata, success criteria, architecture decisions
  - `01-phase0-architecture.md` — file tree, calling specs, LOD patterns, quality gate
  - `02-phase1-*.md` through `0N-phaseN-*.md` — RED/GREEN/REFACTOR phases
  - `checklist.md` — final LOD + TDD compliance
  - `risks.md` — risk table + rollback per phase
  - `notes.md` — living log
- **Task**: Created with plan path so you have one clear work item

## Agent Integration

- After plan generation, offer to spawn `guya:guya-tester` to scaffold the test structure for the feature (maps to Q10 answers)
- After plan generation, offer to spawn `guya:guya-document` to generate documentation for new modules or changed interfaces
- After plan generation, prompt: "Run `/guya:guya-scribe arch: [decision summary]` to record the architectural decisions from this session in ARCHITECTURE.md"

## Post-Implementation Workflow

After implementation is complete:
1. **Commit** — pre-commit hook runs `guya-review` automatically. Fix any issues it surfaces, then re-commit.
2. **Complex changes** — run `/guya:guya-deep-review` manually before committing to get ahead of issues rather than reacting to them.
3. **Before PR** — run `/guya:guya-pr` to get a Codex fresh-eyes pass and a clean PR description.

## Marker Management (MANDATORY — before Q1)

Before asking Q1, create `.guya/decisions/` if it doesn't exist and write `.guya/decisions/.harness-active` containing:

    {"type": "feature", "started_at": "<current ISO8601 timestamp>"}

This tells Guya's UserPromptSubmit hooks that the user is answering domain questions during a harness, not issuing work commands (decision-gate would otherwise block every work verb), not reloading project context (intent-detect would spam archival), and not giving behavioral corrections to Guya (correction-detect would save answers as fake guidelines).

Remove the marker (`rm .guya/decisions/.harness-active`) when:
- Plan generation completes successfully
- The user aborts the harness
- Any step fails irrecoverably

The marker auto-expires after 2 hours as a crash-recovery safety net.

---

# Let's Start

Ready? I'll ask the first question now.

**Q1: What problem does this solve?** (1-2 sentences, specific)
