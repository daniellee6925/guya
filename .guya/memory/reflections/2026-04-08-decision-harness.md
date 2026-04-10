---
date: 2026-04-08 22:00
type: manual
session: decision-harness-system
---

# Reflection: Decision Harness System Implementation

## Part 1: What You Should Take Away

**You diagnosed the real problem.** Not "I delegate too much" — more specifically: "I skip the hard decision work upfront and hand it to you, then we rework it later." That's staff-engineer thinking: identifying the root cause, not the symptom.

**You designed the constraint correctly.** Session-scoped `.active-session` over time-scoped is the right call. One thing per session, enforced by the system, not by willpower. You already knew this was your weakness (over-exploration), and you built the tool to prevent it. That's mature.

**You collaborated well on implementation.** You caught the "8 hours is too long" issue immediately, asked for the change, and we iterated. You didn't let me ship something that didn't feel right. You also held me accountable for doing review and fixes in one pass — told me to make the fixes and move on instead of creating work tickets. That's efficient.

**One blind spot:** You're assuming the skills will force good thinking just by asking questions. They will — but only if you actually engage with the probing. If you answer vaguely, I'll push back. Don't rush the harness. That's the whole point.

## Part 2: What I Should Do Differently

**I should have pushed the `/planning` split harder.** You identified it was unnecessary, but I should have sensed that earlier. Not every decision is an architecture decision. Next time, I'll challenge scope creep in the skills themselves.

**I should have asked about the decision doc format upfront.** We spent a lot of time on the plan architecture without first clarifying where/how decision docs should look. I assumed lod-planner structure and it worked out, but I should have asked "what format makes sense for your decisions?" before building.

**I should flag when I'm defaulting to Sonnet for implementation.** You mentioned earlier you want me to think about model routing. I built 4 skills without thinking about whether Haiku would be better for the interactive Q&A (it would be — faster iteration). Next time I'll be explicit about the model choice.

## Session Summary

Built a decision harness system: 4 interactive skills (feature, bugfix, refactor, kickoff) + enforcement hook (session-scoped). Each harness asks 8-12 probing questions, synthesizes answers into a decision doc + lod-planner plan + task. Hook blocks work intent if no decision doc exists in current session. Post-commit clears the session marker.

**Key decisions:**
- Session-scoped over time-scoped enforcement
- Global skills (in guya-plugin) usable across projects
- Teaching through questioning, not giving answers
- Hard gate for all current and future projects

**Code quality:**
- Reviewed twice (Karpathy + deep review)
- Fixed defensive checks for tool_input structure
- Added observability logging to catch blocks
- All tests pass, committed successfully

---

Next session: Restart Claude Code, test `/feature` on an SDF idea, iterate on question intensity.
