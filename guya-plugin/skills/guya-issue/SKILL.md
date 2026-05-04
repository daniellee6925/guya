---
name: guya-issue
description: Capture a bug or follow-up surfaced mid-work into a GitHub issue without losing flow. Pulls context from the current conversation, drafts title and body, opens the issue via `gh`, and returns control to whatever Daniel was doing. Use when Daniel says "open an issue", "file this as a bug", "make a github issue for X", "/guya-issue", or surfaces a problem clearly out-of-scope from the active task.
argument-hint: "[short title or description — optional]"
---

# Guya Issue

The canonical "I just found a bug while doing something else" flow. Capture it, file it, get back to work.

## When This Triggers

- Daniel says "open an issue", "file this as a bug", "create a github issue", or `/guya-issue ...`
- Trigger proactively when Daniel describes a real problem that's clearly out-of-scope from the current task — confirm before filing.

Don't trigger for growth tasks or learning items — those go to Constantia, not GitHub. Code/repo problems only.

## Step 1 — Sanity check

Run these in parallel:

- `gh auth status` — bail with the auth instruction if not logged in
- `gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner'` — bail if the cwd isn't a GitHub repo

If either fails, stop and tell Daniel exactly what to fix. Don't try to file an issue against the wrong repo.

## Step 2 — Draft title and body

Title: use the argument if given, otherwise pull a one-line summary from the recent conversation.

Body sections (skip any that don't apply — empty sections are noise):

```
## Context
What was happening when this surfaced. One sentence.

## Problem
What's wrong. Be concrete — not "auth is broken" but "auth middleware leaks tokens on 500 responses".

## Where
file/path:line if known. Function name. Whatever locates the code.

## Repro / Evidence
Steps to reproduce, an error message, or the line of code that proves it.

## Notes
Anything else worth knowing — workaround tried, related code, why it wasn't fixed inline.
```

Pull from the live conversation, not from memory or imagination. If a section has no concrete content, drop it.

## Step 3 — Confirm with Daniel

Show the drafted title and body. Ask once: "File this as-is, edit, or skip?"

Don't open issues without explicit approval — surprise issues are clutter, and clutter erodes the issue tracker's signal.

## Step 4 — File it

```bash
gh issue create --title "<title>" --body "<body>"
```

Capture the URL from the output. Report it back in one line: `Filed: <url>`.

If Daniel asked for labels (`--label bug`, `--label tech-debt`) or an assignee (`--assignee @me`), pass them. Don't auto-apply — repos vary in label conventions and applying the wrong one is noisier than none.

## Step 5 — Return to original task

This is the whole point. Don't summarize, don't reflect, don't propose follow-ups. The user was doing something else; resume that.

## Rules

- **GitHub for code, Constantia for growth.** This skill files code/repo issues only. If Daniel surfaces a learning gap or a habit to track, route to Constantia tasks instead — wrong tool here.
- **No silent filing.** Always show the draft and get approval. Even when invoked with a complete-looking arg.
- **One issue per invocation.** If Daniel describes three problems, file one and ask whether to do the others — batched issue spam is worse than the bug.
- **Don't edit code as part of this skill.** No "// TODO: see #N" injections. The skill captures; it doesn't modify.
