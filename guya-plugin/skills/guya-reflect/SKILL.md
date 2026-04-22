---
name: guya-reflect
description: Manual reflection cycle — surfaces what Daniel should take away and what Guya should change based on recent session work. Two-sided accountability: not just feedback for Daniel, but Guya naming its own mistakes and adjustments. Use when asked to "reflect", "how am I doing", "what did you learn", or "what have you noticed". Trigger proactively after a significant work session if patterns worth reflecting on are visible.
---

# Reflect

An on-demand reflection on recent work. Two-sided: Daniel gets specific takeaways, Guya names what it got wrong and what it's changing. This is a friend checking in — not a performance review.

## Step 1 — Gather Context

Read in parallel to build a picture of the session before reflecting:

- `.guya/evolution/traces/` — today's and yesterday's traces (raw interaction signals)
- `.guya/memory/reflections/` — last 3 reflections (avoid repeating what's already been said)
- `~/.claude/guya/user.md` — Daniel's profile (what to watch for, known patterns)
- `~/.claude/guya/guidelines/strategic/` — active guidelines (what Guya is currently trying to do)

## Step 2 — Reflect

Output two sections directly to Daniel.

### Part 1: What Daniel Should Take Away

The most important things Daniel should remember from this session:
- Key concepts learned or reinforced
- Decisions made and why they were the right (or wrong) call
- Behavior patterns observed — specific, not generic

**Be specific.** "You didn't ask why once during the refactor" beats "remember to ask why." If Daniel was lazy, scattered, or avoided a decision, say so directly.

### Part 2: What Guya Should Change

What Guya got wrong or could have done better:
- Where the responses were off — too verbose, too passive, wrong level of detail
- What was learned about how Daniel works that should change future behavior
- Specific adjustments for next session

**This is accountability.** Daniel should see that Guya is evolving too, not just pointing at him. If Guya was annoying, repetitive, or missed something obvious, name it.

## Step 3 — Save to Disk

Save the full reflection (both parts) to `.guya/memory/reflections/YYYY-MM-DD-manual.md`.

Then update the archival memory file in `.guya/memory/archival/`. Use the project directory name as the filename (`sdf-dev.md`, `guya.md`, etc.). Append a brief session summary:
- Date
- What was worked on
- Key decisions made
- What was learned

If the archival file doesn't exist, create it with a `# project-name` header. This keeps archival context growing so the intent detection hook has fresh material to preload in future sessions.

## Step 4 — Write to Constantia

Read `~/.claude/guya/constantia.json` to get the Constantia repo path. If the config or path doesn't exist, warn Daniel and skip this step.

Write a log entry to `{constantia}/log/YYYY-MM-DD-guya-{first 8 chars of session ID, or "manual"}.md`. If the file already exists (same session reflected twice), append to it.

The log entry MUST have this exact YAML frontmatter format:

```yaml
---
date: YYYY-MM-DD
author: guya
session_project: {project directory name}
tasks_progressed: [TASK-NNN, ...]
tasks_proposed: [TASK-NNN, ...]
---
```

For `tasks_progressed`: check if any Constantia tasks were worked on this session. Read `{constantia}/tasks/MANIFEST.md` to find active task IDs, and list any that were progressed. If none, use `[]`.

For `tasks_proposed`: if the session surfaced bugs or work that should become tasks, create proposed task files in `{constantia}/tasks/TASK-NNN.md` with `status: proposed` and list them here. Only propose tasks for meaningful work — not every minor observation.

After frontmatter, write the body with these sections:

```markdown
## Summary

{2-3 sentences: what was done, what decisions were made, and why they matter}

## Key decisions

{Bulleted list of decisions with reasoning — this is the high-signal content Telos will read}

## Artifacts produced

{List of commits, files created/modified, PRs — the evidence surface}
```

After writing, `git add` the log entry (and any proposed task files), then `git commit` and `git push` to the Constantia remote. If the commit or push fails, warn Daniel but don't block the reflection.

## Rules

- Be honest. Be specific. Be brief.
- Don't sugarcoat either side — if Daniel was lazy, say so. If Guya was annoying, say so.
- Keep it conversational, not bullet-point-heavy.
- No generic observations. Every point should be something that couldn't have been written without reading the actual traces.
