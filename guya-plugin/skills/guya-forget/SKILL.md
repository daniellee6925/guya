---
name: guya-forget
description: Remove a specific guideline or memory. Use when asked "forget X", "unlearn X", "remove that guideline".
---

# Guya Forget

Remove a specific guideline, memory, or learned behavior.

## When This Triggers

- User says "forget X", "unlearn X", "remove that guideline", "delete that rule", "stop doing X"

## What To Do

1. **Identify what to forget**: Parse the user's request to determine what should be removed:
   - A specific guideline (by content match or domain)
   - A memory block or archival entry
   - A behavioral pattern

2. **Find matches**: Search across:
   - `~/.claude/guya/guidelines/strategic/*.md` (strategic guidelines)
   - `.guya/evolution/guidelines/tactical/*.md` (tactical guidelines)
   - `.guya/memory/core/*.md` (core memory blocks)
   - `.guya/memory/archival/**/*.md` (archival memory)

3. **Confirm before deleting**: Show the user what you found and ask for confirmation:
   - "I found this guideline: [content]. Remove it?"
   - If multiple matches, list them and ask which one(s)

4. **Delete**: Remove the file or the specific section within a file.

5. **Record**: Write a trace noting what was forgotten and why, so the consolidation engine doesn't re-learn it:
   - Write to `.guya/evolution/traces/YYYY-MM-DD.jsonl` with type: "forget"
   - Content: "Daniel explicitly asked to forget: [description]"

## Important

- Always confirm before deleting. This is destructive.
- If the user wants to forget something from user.md, edit the section rather than deleting the whole file.
- Forgetting a guideline doesn't prevent re-learning it. If the same pattern keeps appearing in traces, it will be re-synthesized. Tell Daniel this.
