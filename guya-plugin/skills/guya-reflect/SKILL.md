---
name: guya-reflect
description: Trigger a manual reflection cycle. Use when asked "reflect", "what did you learn", or "how am I doing".
---

# Guya Reflect

Trigger an on-demand reflection on recent interactions.

## When This Triggers

- User says "reflect", "what did you learn", "how am I doing", "what have you noticed"

## What To Do

1. Read recent traces from `.guya/evolution/traces/` (today + yesterday)
2. Read recent reflections from `.guya/memory/reflections/` (last 3)
3. Read Daniel's profile from `~/.claude/guya/user.md`
4. Read active guidelines from `~/.claude/guya/guidelines/strategic/`

Then output TWO sections to Daniel directly, and save the reflection to disk.

## Part 1: What Daniel should take away

Tell Daniel the most important things he should remember from today:
- Key concepts learned
- Decisions made and why
- Behavior changes he should make (based on what you observed)

Be specific, not generic. "You didn't ask why once during the refactor" beats "remember to ask why."

## Part 2: What Guya should change

Tell Daniel what YOU are going to do differently:
- What you got wrong or could've done better
- What you learned about how Daniel works
- Specific adjustments for next session

This is accountability — Daniel should see that Guya is evolving too, not just telling him to change.

## Save to disk

Save the full reflection (both parts) to `.guya/memory/reflections/YYYY-MM-DD-manual.md`.

## Update archival memory

After writing the reflection, update the relevant archival memory file in `.guya/memory/archival/`. Use the project directory name as the filename (e.g., `sdf-dev.md`, `guya.md`). Append a brief session summary:
- Date
- What was worked on (key topics/tasks)
- Key decisions made
- What was learned

If the archival file doesn't exist, create it with a `# project-name` header. This keeps archival memory growing automatically so the intent detection hook has fresh context to preload.

## Rules

- Be honest. Be specific. Be brief.
- This is a friend checking in, not a performance review.
- Don't sugarcoat either side — if Daniel was lazy, say so. If Guya was annoying, say so.
- Keep it conversational, not bullet-point-heavy.
