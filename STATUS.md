# guya — Status

> Last updated: 2026-04-08 4:10 PM PT

## Current Focus
Commit validation system — two-layer review gate with automatic evidence tracking.

## Recent Changes
- [2026-04-08] `28c6181` — fix: tighten review gate — remove hooks/ exemption, lower small change to 10 lines
- [2026-04-08] `b12daba` — docs: add session reflections, research archive, and evolution traces
- [2026-04-08] `ef1bc6f` — feat: implement two-layer commit validation with automatic evidence tracking
- [2026-04-08] `be794f4` — feat: add Obsidian vault sync to session-end hook and new sync skill
- [2026-04-08] `9ec809f` — feat: enforce two-pass review in pre-commit gate
- [2026-04-08] `e8b7378` — fix: eliminate review gate race condition and fix scribe bugs
- [2026-04-08] `ea73762` — fix: add stderr output to hooks for user terminal visibility
- [2026-04-08] `dad8416` — fix: require review report proof in pre-commit gate
- [2026-04-08] `30fcfe9` — feat: add visibility to pre-push and post-commit scribe hooks
- [2026-04-08] `bf95c81` — fix: enforce full review-fix-verify cycle in pre-commit gate

## In Progress
- [ ] Evolution pipeline — first real classify→synthesize cycle pending (needs correction data from sessions)
- [ ] Claude code guide — living doc, update as new patterns discovered

## TODO
- [ ] Growth tracker milestone #2: read and critique someone else's code
- [ ] Growth tracker milestone #5: review code Guya writes — pick one function per session

## Decisions & Notes
- [2026-04-08] Removed hooks/ from pathExempt — hook code should be reviewed, not exempt from its own quality system
- [2026-04-08] Tightened small change threshold: maxLines 30→10, removed maxFiles (line count alone is sufficient)
- [2026-04-08] Obsidian vault sync: entity pages only to start (no sub-concepts), wiki synthesis format for growth tracker, semi-auto via SessionEnd hook + manual via /guya-obsidian-sync skill
- [2026-04-08] Centralized all traces to ~/.claude/guya/traces/ — single source of truth across 9 projects (4,052 traces merged)
- [2026-04-08] Pre-commit gate hardened: requires filesHash, timestamp, reviewIssues, fixesApplied, verifiedAt + review-report.json proof
- [2026-04-08] Feedback detection expanded from 3→13 patterns: corrections, confirmations, pushback, preferences, decisions
- [2026-04-08] MAX_FUNC_LINES bumped from 50→80 (50 was too aggressive for orchestrator functions)
