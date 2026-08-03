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

## Batch Mode (for `/guya-audit` — not for interactive use)

`/guya-audit` files many issues in one unattended run, so the confirm-each-issue flow above cannot apply. Rather than letting it hand-roll its own `gh` calls — two places to drift when conventions change — it calls this skill in batch mode.

The approval requirement is not waived, it is **relocated**. Batch mode is only legitimate when all of these hold, and you should refuse it when they don't:

1. Daniel explicitly invoked the audit. The run itself is the approval.
2. A dedup pass ran against open issues first, so nothing already-filed is filed again.
3. Every issue carries the `guya-audit` label, making the whole batch findable and bulk-closable if it turns out to be noise.
4. Findings are grouped — one issue per mechanical check type, not one per occurrence.

What stays identical to interactive mode: the body sections, the "concrete not vague" standard for Problem, the requirement that Where locates real code, and the refusal to file against the wrong repo.

What changes: no per-issue prompt, and the caller may pass extra body content (the audit's machine-readable header block) above the standard sections.

Report the batch as a count plus URLs, not one line per issue.

## Rules

- **GitHub for code, Constantia for growth.** This skill files code/repo issues only. If Daniel surfaces a learning gap or a habit to track, route to Constantia tasks instead — wrong tool here.
- **No silent filing.** Always show the draft and get approval. Even when invoked with a complete-looking arg. The single exception is Batch Mode above, whose preconditions replace per-issue approval — and it is only reachable from an audit run Daniel started.
- **One issue per invocation** in interactive mode. If Daniel describes three problems, file one and ask whether to do the others — batched issue spam is worse than the bug. Batch mode is the deliberate exception, and it earns that by deduping and labelling.
- **Don't edit code as part of this skill.** No "// TODO: see #N" injections. The skill captures; it doesn't modify.
