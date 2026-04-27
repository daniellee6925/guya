---
name: guya-review
description: Focused code review applying Karpathy principles and targeted risk categories — complexity, silent errors, scalability, security, and race conditions. Use when asked to "review", "karpathy review", or "check this code". Trigger proactively on new or significantly changed code — don't wait to be asked. Use guya-pr instead for the full pre-PR preparation pass.
argument-hint: "<file-path or directory>"
---

# Karpathy Review

A focused, single-pass code review for catching real issues before they become bugs. Work through each category below in order. For each issue found, report the location, the risk, and a concrete fix. If a category is clean, say so — a silent skip is indistinguishable from a missed check.

## Step 0 — Record Evidence (mandatory, do this first)

Before reading anything else, run this exact Bash command:

```
node "$CLAUDE_PLUGIN_ROOT/hooks/record-review-step.mjs" initial
```

This writes the review-evidence entry the pre-commit gate checks. Do not skip, do not edit `.guya/evolution/review-evidence.jsonl` by hand, do not infer "the hook will handle it" — it has not. If the command fails, stop and surface the error; do not proceed with the review.

## Step 1 — Read the Target

Read the file or directory at `$ARGUMENTS`. If a directory, identify the most important files by size and complexity and focus there. Understand what the code is trying to do before evaluating it — a review without context produces false positives.

## Step 2 — Review Categories

Work through each category. The order matters: start with high-level structural issues before drilling into specifics.

### Simplicity

Speculative complexity is the most common LLM coding mistake — adding features, abstractions, and flexibility that weren't asked for. Check:
- Is this the minimum code that solves the problem?
- Any features beyond what was asked? Abstractions for single-use code? Configurability that wasn't requested?
- No error handling for scenarios that can't happen?
- Could this be written in significantly fewer lines without losing clarity?

### Surgical Changes

LLMs "improve" things they weren't asked to touch — this spreads risk and obscures the actual change. Check:
- Did changes touch only what they had to? Flag edits to adjacent code, comments, or formatting not part of the task.
- No refactoring of things that weren't broken?
- If changes created orphans (unused imports, variables, functions), are those cleaned up?
- Every changed line should trace directly to the stated request.

### Goal Verification

"Make it work" is not a success criterion — it produces code that can't be verified or looped on independently. Check:
- Does the change have verifiable success criteria?
- For bug fixes: is there a test that reproduces the bug before the fix and passes after?
- For refactors: do existing tests pass before and after with no behavior change?
- For new features: are there tests that confirm the stated goal was met?

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

Vulnerabilities introduced here are the hardest to audit and the most damaging when exploited. Check:
- Hardcoded credentials, tokens, or API keys in source?
- User input interpolated into prompts, queries, or shell commands without sanitization?
- Sensitive values printed to logs or error messages?
- Secrets loaded from env but then embedded into objects that get serialized or returned?

### Race Conditions

Concurrency bugs reproduce intermittently and are catastrophic when they do. Check:
- In async code, are there ordering assumptions that could break under concurrency?
- Shared mutable state (dicts, lists, counters) accessed from multiple coroutines without locks?
- `await` inside a loop that assumes state hasn't changed between iterations?
- File or DB writes that assume exclusive access but don't enforce it?

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

## Step 4 — Apply Fixes

Classify each finding and act immediately — don't leave obvious fixes for Daniel to apply manually.

**Auto-fix directly:**
- Swallowed exceptions → add explicit logging or re-raise
- Mutable default arguments → replace with `None` sentinel pattern
- Missing cleanup in error paths → add to `finally` or `except` block
- Hardcoded magic values → extract to a named constant
- Unused imports or variables orphaned by this change → remove

**Flag as `Action needed` without touching code:**
- Architectural trade-offs with multiple valid approaches
- Issues requiring design decisions beyond the scope of this file
- Anything where the right fix isn't unambiguous

After applying fixes, re-read the modified sections and confirm the fix is correct and introduced no new issues.

End with:

**Fixes Applied**
- `[file:line]` Fixed: [description]
- `[file:line]` Action needed: [what to decide]

## Step 5 — Follow-Up

If undocumented public APIs or exports were found during review, offer to spawn `guya:guya-document` to generate the missing documentation.
