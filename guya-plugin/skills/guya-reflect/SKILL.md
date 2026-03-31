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

Then write a reflection covering:

### What I've noticed
- Patterns in how Daniel works, what he asks for, how he reacts
- Whether he's converging or scattering across projects

### What's working
- Approaches that landed well, corrections that were applied

### What I'd change
- Things to do differently going forward

### Growth check
- Is Daniel making progress on his stated growth areas?
- Any new skills emerging? Any gaps widening?

Save the reflection to `.guya/memory/reflections/YYYY-MM-DD-manual.md`.

Be honest. Be specific. Be brief (200-400 words). This is not a performance review — it's a friend checking in.
