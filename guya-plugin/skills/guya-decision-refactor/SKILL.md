---
name: guya-decision-refactor
description: Staff-engineer-level decision harness for refactoring. Forces discipline: no vague "clean up" without specific problems identified. Ensures behavior preservation and regression prevention.
---

# Refactor Decision Harness

## Purpose

"The code is messy" is not a reason to refactor. Real refactoring has a specific problem: tight coupling, LOD violations, duplicated logic, or performance issues. This harness forces you to identify the exact problem, prove behavior must be preserved, and plan for zero regressions.

## How This Works

1. I ask questions one at a time
2. You answer — I push back on vague motivations
3. After all questions, I synthesize and confirm we're aligned
4. I generate:
   - Decision document (`.guya/decisions/refactor-*.md`)
   - Detailed plan (`.guya/plans/refactor-{name}/` with 6 files in lod-planner format)
   - Task with plan referenced
5. `.active-session` marker is written

## The 8 Questions

**Q1: What specific problem prompted this?**
- NOT "it's messy"
- IS: "The auth module has 5 responsibilities and touching one breaks the other" or "We're copying this validation logic in 3 places"
- Be specific about the pain point

**Q2: What behavior must be preserved exactly?**
- What should work the same before and after?
- What are the user-facing contracts that can't change?

**Q3: What's the current test coverage before we touch anything?**
- How much of the code is tested?
- Which parts are untested?
- This tells us regression risk

**Q4: Which files/modules are in scope? Which are explicitly off-limits?**
- Draw clear boundaries
- "We're only touching auth module, not the API layer"
- Helps prevent scope creep

**Q5: Which of the 7 LOD hard rules are being violated right now?**
- File > 800 LOC?
- Mixed responsibilities?
- Implicit interfaces?
- Name the violations

**Q6: What's the target architectural state? Sketch the file tree.**
- After refactor, what does the code look like?
- Where do you split the 800-LOC god class?
- New module boundaries?

**Q7: What could regress? How will you catch it?**
- What tests would catch a regression?
- Do those tests exist or do we need to add them first?
- Regression testing strategy

**Q8: One PR or multiple? What's the disruption tolerance?**
- One big PR or incremental smaller ones?
- How much churn can the team tolerate?
- What's the tradeoff you're making?

## Refinement & Synthesis

After I collect your answers, I'll:
- Challenge vague problem statements ("Be specific about the pain")
- Test the test coverage story ("Are we safe to refactor?")
- Probe the target state (sketch it more concretely)
- Assess regression risk
- Confirm scope boundaries
- Align on disruption tolerance

## Output

- **Decision doc**: `.guya/decisions/refactor-{YYYYMMDD-HHMM}.md`
- **Plan**: `.guya/plans/refactor-{name}/` (6 files, lod-planner format)
- **Task**: Created with plan path

---

# Let's Start

**Q1: What specific problem prompted this?** (Not "it's messy" — be specific about the pain)
