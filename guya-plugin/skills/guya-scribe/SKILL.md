---
name: guya-scribe
description: Update STATUS.md, ARCHITECTURE.md, and relevant CLAUDE.md files with current project state. Use whenever asked "scribe", "update status", "update docs", "update architecture", "add todo", or "record this decision". Trigger proactively after significant work sessions — if the project state has changed and isn't recorded, use this skill.
argument-hint: "[todo: description] | [note: description] | [arch: decision description]"
---

# Scribe — Project State Orchestrator

Keep STATUS.md, ARCHITECTURE.md, and per-module CLAUDE.md files current so any session can pick up without ramp-up. Works in any git repo.

## Full Update — `/scribe` or no args

One command updates all three docs. Run the three tracks below — STATUS.md inline, the other two via agents in parallel.

### Track 1: STATUS.md (inline — no agent)

Git log and git status are the source of truth. Don't interpret — record.

1. Read `STATUS.md` if it exists
2. Run `git log --oneline -20` and `git status --short`
3. Grep for TODO/FIXME in recently changed files
4. Rewrite STATUS.md — preserve all unchecked TODOs and all Decisions & Notes entries

```markdown
# [Project Name] — Status

> Last updated: YYYY-MM-DD HH:MM PT

## Current Focus
One sentence: what is actively being worked on right now.

## Recent Changes
- [YYYY-MM-DD] `abc1234` — commit message
(Last 10 commits, newest first. Drop entries older than 7 days.)

## In Progress
- [ ] thing currently being worked on

## TODO
- [ ] future task
(Preserve all unchecked items. Mark done [x] but remove after 3 days.)

## Decisions & Notes
- [YYYY-MM-DD] decided X because Y
(Append-only. Never remove unless user asks.)
```

---

### Track 2: ARCHITECTURE.md (spawn guya-document agent)

If ARCHITECTURE.md does not exist, create it with this skeleton before spawning the agent:

```markdown
# [Project Name] — Architecture

> Last updated: YYYY-MM-DD HH:MM PT

## Current Architecture
(to be filled)

## Target Architecture
(to be filled)

## Decision Log
```

Then spawn `guya:guya-document` with this task:

> Read ARCHITECTURE.md. Read the most recent decision doc in `.guya/decisions/` if present. Read `git log --oneline -10` and the project's CLAUDE.md for architectural context. Write a snapshot of the Current Architecture (modules, data flow, key boundaries) and Target Architecture (decisions made but not yet implemented). Do not touch the Decision Log — that is append-only. Write the result back to ARCHITECTURE.md.

After the agent completes, append any new architectural decisions from the session to the Decision Log mechanically (date + one-line summary).

```markdown
# [Project Name] — Architecture

> Last updated: YYYY-MM-DD HH:MM PT

## Current Architecture
What exists now: modules, data flow, key boundaries, major components.
Write as a snapshot — what a new engineer needs to understand the system.

## Target Architecture
Where the system is heading: decisions made but not yet implemented.
Distinguish clearly from Current — this is intent, not reality.

## Decision Log
- [YYYY-MM-DD] decided X because Y
(Append-only. Never edit or remove past entries.)
```

---

### Track 3: CLAUDE.md per changed directory (spawn guya-document agent)

Only update CLAUDE.md for directories where module *responsibilities* changed — new modules, refactors, API surface changes. Skip directories where only bug fixes or minor edits occurred, because those don't change what the module does.

To determine scope: read the git log and diff summaries. If commits suggest structural change (new file, module split, interface change, new export), include that directory.

If CLAUDE.md does not exist in an in-scope directory, create it — do not skip. A missing CLAUDE.md in a structurally changed directory is a documentation gap, not a reason to skip.

For each in-scope directory, spawn `guya:guya-document` with this task:

> Read the existing CLAUDE.md in [directory] if it exists (create from scratch if not). Read the source files in this directory to understand what the module does now, its public interface, and its role in the larger system. Write CLAUDE.md to reflect the current state — purpose, key behaviors, calling specs, constraints. If creating from scratch, include a header with the module name and one-line purpose. Preserve any sections the user manually wrote unless they're factually outdated.

---

## Targeted Modes

### Add TODO — `/scribe todo: description`
Append to the TODO section of STATUS.md only. Create the file if it doesn't exist.

### Add Note — `/scribe note: description`
Append a timestamped note to Decisions & Notes in STATUS.md only.

### Append Architecture Decision — `/scribe arch: decision description`
Append a single dated entry to the Decision Log in ARCHITECTURE.md only. Create the file if needed.

---

## Rules

- **Don't invent content.** Record what exists — git log, decision docs, actual code. Never fabricate TODOs, decisions, or architectural claims.
- **Decision Log is append-only.** Past entries are historical record. Never edit or remove them.
- **Preserve user entries.** If the user manually wrote something in any of these files, keep it unless it's factually outdated.
- **CLAUDE.md scope is earned.** Only update a directory's CLAUDE.md if the module's responsibilities actually changed — don't touch it for minor edits.
- **Project-agnostic.** Infer project name from directory name or package.json/pyproject.toml.
