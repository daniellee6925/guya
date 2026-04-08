---
name: guya-scribe
description: Update or create STATUS.md with current project state. Use when asked "scribe", "update status", "document progress", or to add TODOs.
argument-hint: "[todo: description] or [note: description] or empty for full update"
---

# Scribe — Project Status Tracker

Keep STATUS.md current with progress, changes, and TODOs. Works on any project.

## When This Triggers

- User says "scribe", "update status", "document this", "add todo"
- User wants to record a decision, TODO, or progress checkpoint

## Modes

### Full Update (no args or `/scribe`)

1. Read `STATUS.md` in the project root (if it exists)
2. Read recent git log (`git log --oneline -20`)
3. Check uncommitted changes (`git status --short`)
4. Check for TODO/FIXME comments in recently changed files
5. Rewrite STATUS.md with the structure below, preserving any existing TODOs that aren't done

### Add TODO (`/scribe todo: description`)

Append to the TODO section of STATUS.md. Create the file if it doesn't exist.

### Add Note (`/scribe note: description`)

Append a timestamped note to the Decisions/Notes section.

## STATUS.md Structure

```markdown
# [Project Name] — Status

> Last updated: YYYY-MM-DD HH:MM PT

## Current Focus
One sentence: what's actively being worked on right now.

## Recent Changes
- [YYYY-MM-DD] `abc1234` — commit message
- [YYYY-MM-DD] `def5678` — commit message
(Last 10 commits, newest first. Remove entries older than 7 days on full update.)

## In Progress
- [ ] thing currently being worked on
- [ ] another thing in flight

## TODO
- [ ] future task 1
- [ ] future task 2
(Preserve existing unchecked items. Mark completed items with [x] but remove after 3 days.)

## Decisions & Notes
- [YYYY-MM-DD] decided X because Y
- [YYYY-MM-DD] note about something
(Append-only. Don't remove unless user asks.)
```

## Rules

- **Don't invent TODOs.** Only add what the user explicitly asks for or what's in the existing file.
- **Don't editorialize.** "Recent Changes" is commit messages, not your interpretation.
- **Preserve user entries.** If the user manually wrote something in STATUS.md, keep it.
- **Be fast.** Full update should take one read + one write. No LLM calls needed for the hook-generated entries.
- **Project-agnostic.** Works in any git repo. Infer project name from the directory name or package.json/pyproject.toml.
