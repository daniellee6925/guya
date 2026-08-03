---
name: guya-decision-feature
description: Staff-engineer-level decision harness for new features in existing projects. Forces scope, constraints, and success criteria definition before any planning or implementation.
---

# Feature Decision Harness

## Purpose

This skill forces staff-engineer thinking before building anything. Four questions establish scope, constraints, and success criteria. Everything else that a plan needs — what the feature touches, what breaks if it's wrong, which patterns apply, how it gets tested — you derive from the codebase and put in front of Daniel for correction.

Scope discipline here is two-sided. Over-scoping wastes a week; under-scoping ships a fragment that gets redesigned when the next piece lands, and it disguises itself as restraint. Q2 guards both edges.

The split is deliberate. Ask Daniel what only Daniel knows: intent, scope, and the constraints that live in his head. Don't ask him to recite what's already in the repo.

## How This Works

1. Ask the four questions **one at a time** — not as a batch. Probe when an answer is vague.
2. Read the codebase and draft the **Derived Context** (below).
3. Present the derived context + a synthesis in one pass. Daniel corrects what's wrong.
4. Generate the decision doc, the plan, and the task.
5. Write `.active-session` so the enforcement hook knows a decision is active.

## The Four Questions

**Q1: What problem does this solve, and why now?**
- The *why* before the *what*, plus the forcing function
- 1-2 sentences, sharp. "Why now" tells you whether this is leverage or avoidance
- If there's no real forcing function, say so — that's a finding, not a failure

**Q2: What's the full shape of this, and how much of it are we building now?**
- First, describe the feature *finished* — not the MVP, the real thing. You need the destination before you can choose a cut that won't need rework
- Then: what's in this build? The test is **coherence, not size** — a slice that stands on its own and doesn't force a redesign when the next piece lands
- What's explicitly out? What looks in-scope but isn't?
- Push back in **both** directions. Scope creep is unrelated capability riding along. Under-scoping is a coherent unit split so thin the pieces need rework to compose — building a third of an interface and then redesigning it costs more than building the interface. The second failure is quieter and usually more expensive, because it looks like discipline
- Do not ask "what's the smallest version." Smallest is not the goal; right-sized is. A slice that defers the load-bearing architectural decision hasn't reduced scope, it's postponed the hard part at interest

**Q3: What does "done" look like?**
- Measurable and concrete. "Works" is not an answer
- If it can't be checked, it can't be finished

**Q4: What constraints would I not guess from reading the code?**
- Deadlines, cost ceilings, latency targets, external dependencies, political constraints
- Project-standard limits (file LOC caps, module boundaries) are already in CLAUDE.md — don't ask, read them
- "None" is a valid answer, and a fast one

## Derived Context (you produce this, not Daniel)

After Q4, go read the code. Draft each of these, then show Daniel for correction:

- **Touch points** — which modules, pipeline stages, and interfaces this feature reaches. Name files.
- **Blast radius** — what breaks if this is wrong, and which existing features share state or code paths with it. Calibrates how careful the plan needs to be.
- **Applicable patterns** — new variants, orchestrators, schema changes, registry usage. Sketch the architecture against the project's actual conventions.
- **Test strategy** — unit/integration/E2E split, what to mock vs. hit for real, coverage targets. Anchor it to the blast radius: high blast radius earns heavier tests.

Present these as claims to correct, not questions to answer: *"Here's what I found — tell me where I'm wrong."* Daniel confirming a correct derivation costs one line; making him derive it from scratch costs ten minutes.

If the codebase genuinely doesn't answer one of these — a greenfield module with no precedent, an external system you can't inspect — ask about that one specifically. An honest targeted question beats a confidently wrong derivation.

## Refinement & Synthesis

Alongside the derived context:
- Synthesize what the four answers established
- Call out gaps and risks that stood out
- Challenge weak reasoning ("Why is that the right constraint?")

**Before generating the plan**, read:
1. `ARCHITECTURE.md` — check the direction against existing decisions and the Decision Log. Flag if this contradicts or duplicates a prior ADR.
2. `CLAUDE.md` — check against LOD rules, file size constraints, module responsibilities. Flag violations before proceeding.
3. `context/core-beliefs.md` (if present) — hard invariants. Flag any plan element that violates one.
4. `context/vision.md` (if present) — check the feature moves toward the stated vision, not away from it.

Surface conflicts in the alignment confirmation: "Here's where this plan bumps against existing architecture or constraints — proceed or adjust?" Only generate the plan after alignment is confirmed.

## Output

- **Decision doc**: `.guya/decisions/feature-{YYYYMMDD-HHMM}.md` — the four answers, the derived context (as confirmed), and staff-engineer analysis
- **Plan**: `.guya/plans/feature-{name}/` with all 6 files (lod-planner format)
  - `00-overview.md` — status, metadata, success criteria, architecture decisions
  - `01-phase0-architecture.md` — file tree, calling specs, LOD patterns, quality gate
  - `02-phase1-*.md` through `0N-phaseN-*.md` — RED/GREEN/REFACTOR phases
  - `checklist.md` — final LOD + TDD compliance
  - `risks.md` — risk table + rollback per phase
  - `notes.md` — living log
- **Task**: Created with plan path so there's one clear work item

## Agent Integration

- After plan generation, offer to spawn `guya:guya-tester` to scaffold the test structure (maps to the derived test strategy)
- After plan generation, offer to spawn `guya:guya-document` to generate documentation for new modules or changed interfaces
- After plan generation, prompt: "Run `/guya:guya-scribe arch: [decision summary]` to record the architectural decisions in ARCHITECTURE.md"

## Post-Implementation Workflow

After implementation is complete, the pre-commit gate requires three passes in order, inside a 30-minute window:

1. `/guya-review` — structural risk
2. `/guya-deep-review` — logic, state, data integrity
3. `/guya-optimize` — simplification and resource trade-offs

Run them proactively rather than waiting for the commit to be blocked.

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

**Q1: What problem does this solve, and why now?** (1-2 sentences, specific)
