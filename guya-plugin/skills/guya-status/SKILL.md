---
name: guya-status
description: Show Guya's current state. Use when asked "guya status", "how are you", "what do you know".
---

# Guya Status

Show a summary of Guya's current state — memory, guidelines, traces, and identity.

## When This Triggers

- User says "guya status", "what do you know about me", "how are you"

## What To Show

### Identity
- Read `~/.claude/guya/identity.md` — show name, vibe
- Confirm soul.md and creed.md exist

### Memory
- Count files in `.guya/memory/core/` — show names
- Count files in `.guya/memory/archival/` — show domains covered
- Count files in `.guya/memory/reflections/` — show date range

### Guidelines
- Count strategic guidelines in `~/.claude/guya/guidelines/strategic/`
- Count tactical guidelines in `.guya/evolution/guidelines/tactical/`
- Show top 5 strategic guidelines (domain + confidence + summary)

### Traces
- Count trace files in `.guya/evolution/traces/`
- Show today's trace count (lines in today's JSONL)
- Show total trace size on disk

### Health
- Is user.md populated? (not a blank template)
- Are there any unclassified traces waiting?
- When was the last consolidation?
- When was the last reflection?

Format as a clean, readable summary. Not a data dump.
