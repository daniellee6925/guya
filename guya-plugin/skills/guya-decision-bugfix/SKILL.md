---
name: guya-decision-bugfix
description: Staff-engineer-level decision harness for debugging and fixing bugs. Forces root-cause thinking, blast radius assessment, and verification strategy before implementation.
---

# Bugfix Decision Harness

## Purpose

Bugs are tricky. You can ship a quick patch that masks the symptom, or invest in finding the root cause. This harness forces you to think through both. By the end, you have a clear diagnosis, a fix strategy, and verification plan — so rework doesn't happen again.

## How This Works

1. I ask questions one at a time
2. You answer — I probe deeper if answers feel shallow
3. After all questions, I synthesize and ask for alignment
4. I generate:
   - Decision document (`.guya/decisions/bugfix-*.md`)
   - Detailed plan (`.guya/plans/bugfix-{name}/` with 6 files in lod-planner format)
   - Task with plan referenced
5. `.active-session` marker is written

## The 8 Questions

**Q1: Expected behavior vs actual behavior — be specific**
- What should happen? What actually happens?
- Not "broken" — give me concrete examples

**Q2: When did it start? Regression or always broken?**
- Help calibrate urgency and scope
- If regression: what changed? (hint: check git blame/log)

**Q3: How do you reproduce it reliably? What's the minimal repro?**
- Can you make it happen in isolation?
- Minimal repro = fastest debugging

**Q4: What have you already tried?**
- Don't repeat work. What led nowhere?
- What seemed promising but didn't pan out?

**Q5: What's the blast radius?**
- What else could be affected if this bug exists in other places?
- Is this a widespread issue or isolated?

**Q6: Is this a symptom or the root cause? How do you know?**
- The tricky one. You might be fixing the wrong thing
- What evidence do you have?

**Q7: Minimal targeted fix or broader refactor?**
- Sometimes a 5-line patch is right
- Sometimes it means redesigning the module
- Which is appropriate here and why?

**Q8: How will you verify it's fixed?**
- Unit test? Integration test? Manual repro?
- What proof do you need before you can commit?

## Refinement & Synthesis

After I collect your answers, I'll:
- Probe the root-cause thinking (you might be wrong)
- Challenge the fix scope ("Why targeted vs refactor?")
- Ask about verification strategy
- Confirm alignment before generating plan

## Output

- **Decision doc**: `.guya/decisions/bugfix-{YYYYMMDD-HHMM}.md`
- **Plan**: `.guya/plans/bugfix-{name}/` (6 files, lod-planner format)
- **Task**: Created with plan path

## Marker Management (MANDATORY — before Q1)

Before asking Q1, create `.guya/decisions/` if it doesn't exist and write `.guya/decisions/.harness-active` containing:

    {"type": "bugfix", "started_at": "<current ISO8601 timestamp>"}

This tells Guya's UserPromptSubmit hooks that the user is answering domain questions during a harness, not issuing work commands (decision-gate would otherwise block every work verb), not reloading project context (intent-detect would spam archival), and not giving behavioral corrections to Guya (correction-detect would save answers as fake guidelines).

Remove the marker (`rm .guya/decisions/.harness-active`) when:
- Plan generation completes successfully
- The user aborts the harness
- Any step fails irrecoverably

The marker auto-expires after 2 hours as a crash-recovery safety net.

---

# Let's Start

**Q1: Expected behavior vs actual behavior — be specific**
