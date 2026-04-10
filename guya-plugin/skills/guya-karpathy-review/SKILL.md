---
name: guya-karpathy-review
description: Focused code review applying Karpathy principles and targeted risk categories — complexity, silent errors, scalability, security, and race conditions. Use when asked to "review", "karpathy review", or "check this code". Trigger proactively on new or significantly changed code — don't wait to be asked. Use guya-cr instead for a full 3-pass review before a PR or major commit.
argument-hint: "<file-path or directory>"
---

# Karpathy Review

A focused, single-pass code review for catching real issues before they become bugs. Work through each category below in order. For each issue found, report the location, the risk, and a concrete fix. If a category is clean, say so — a silent skip is indistinguishable from a missed check.

## Step 1 — Read the Target

Read the file or directory at `$ARGUMENTS`. If a directory, identify the most important files by size and complexity and focus there. Understand what the code is trying to do before evaluating it — a review without context produces false positives.

## Step 2 — Review Categories

Work through each category. The order matters: start with high-level structural issues before drilling into specifics.

### Complexity & Scope

Over-complicated code resists understanding, resists change, and hides errors. Check:
- Is this the minimum code that solves the problem? Flag abstractions for single-use code, features beyond what was asked, configurability that wasn't requested.
- Did changes stay surgical? Flag edits to adjacent code, comments, or formatting that weren't part of the task.
- Are functions small enough to hold in your head? Flag anything doing more than one thing.
- Magic strings or numbers that should be named constants?

### Silent Errors

Silent failures produce wrong results with no signal — they're the hardest bugs to diagnose. Check:
- Are errors explicitly raised or logged? Flag any exception swallowed silently.
- Do error branches clean up resources the same way the happy path does?
- Does it handle None, empty inputs, zero, and empty lists without silently misbehaving?
- Are types validated at boundaries rather than assumed?

### Scalability

Code that works at small scale often breaks quietly under load. Check:
- Unbounded lists, queues, or dicts that grow forever?
- DB connections, files, and network connections closed in all paths, including errors?
- Blocking I/O on a hot path that will bottleneck under concurrency?
- N+1 query patterns or repeated work that should be batched or cached?

### Security
- Hardcoded credentials, tokens, or API keys?
- User input interpolated into prompts, queries, or shell commands without sanitization?

### Race Conditions
- In async code, are there ordering assumptions that could break under concurrency?
- Shared resources properly locked or isolated?

### AI-Specific Risks

LLM-generated code has failure modes that human-written code rarely does. Check:
- Do all library method calls actually exist with the correct signatures?
- Are similar generated functions consistent with each other in behavior?
- Mutable default arguments? (e.g. `def f(x=[])`)

## Step 3 — Output Findings

Use this format for every issue found:

```
### [Category]
**[file:line]** — [Brief title]
Risk: [Why this is a problem]
Fix: [Concrete suggestion]

No issues found. (if clean)
```

## Step 4 — Follow-Up

If undocumented public APIs or exports were found during review, offer to spawn `guya:guya-document` to generate the missing documentation.
