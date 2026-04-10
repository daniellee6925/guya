---
name: guya-deep-review
description: Deep second-pass review after guya-review findings are fixed. Catches logic bugs, state corruption, data integrity issues, performance problems, and observability gaps that only surface once structural problems are resolved. Run after fixing guya-review findings — the pre-commit gate requires both passes. Trigger proactively after any guya-review is complete and findings are addressed.
argument-hint: "<file-path or directory>"
---

# Deep Review

A second-pass review for catching bugs that are easier to miss when structural problems still exist. Run this after fixing everything guya-review found. The pre-commit gate requires both passes — this is the second one.

## Step 1 — Read the Target

Read the file or directory at `$ARGUMENTS`. If a directory, prioritize files changed most recently. The initial review already caught structural issues — this pass assumes those are resolved and goes deeper.

## Step 2 — Review Categories

Work through each category. If a category is clean, say so — a silent skip is indistinguishable from a missed check.

### Logic Correctness

Off-by-one errors and boolean logic mistakes pass initial review and fail in production — they're invisible until the wrong branch runs. Check:
- Are loop boundaries and slice indices correct (off-by-one)?
- Do conditional branches cover all cases, including unexpected input combinations?
- Is boolean logic correct? Check for de Morgan errors (flipped and/or/not).
- Are comparisons using the right operator (`==` vs `is`, `>` vs `>=`)?
- Does floating point arithmetic produce correct results at edge values?

### State Management

Mutable shared state is the most common source of non-deterministic bugs in async and multi-call systems. Check:
- Is mutable state shared between calls when it should be isolated?
- Are objects reset/cleared correctly between reuses?
- Can state get stuck in a broken intermediate state if an error occurs mid-operation?
- Are there global variables that could cause unexpected behavior across calls?

### Data Integrity

Silent data corruption is worse than a crash — the system continues running with bad data, and the failure shows up far from the origin. Check:
- Are writes atomic where they need to be, or can partial writes corrupt data?
- Is there data mutated in place when a copy was intended?
- Are lists or dicts returned by functions safe for callers to modify?
- Does the code assume input data is sorted, unique, or non-null without verifying?

### Observability

Code that fails silently in production with no logs or metrics is undebuggable without the source. Check:
- Are log messages meaningful enough to debug a production issue without reading the source?
- Are errors logged with enough context (what was the input, what was the state)?
- Are there long-running operations with no progress signal?
- Is latency of critical paths instrumented or measurable?

### Boundary Behavior

Systems fail at their limits — empty input, single item, maximum scale, and unexpected external responses are where bugs hide. Check:
- What happens at scale limits (empty collection, single item, very large input)?
- What happens when an external service returns an unexpected schema?
- What happens when a timeout or retry is exhausted — does it fail gracefully?
- Are there hardcoded limits (max retries, timeouts, batch sizes) that should be configurable?

### Performance

Algorithmic inefficiency is invisible at small scale and catastrophic at production scale — and it rarely shows up in the initial structural review. Check:
- Are there O(n²) or worse algorithms where O(n) is achievable (nested loops over the same data)?
- Is work being recomputed inside a loop that should be hoisted out?
- Are objects or collections being allocated on every call when they could be created once?
- Are there repeated sorts, lookups, or filters on the same data that should be preprocessed?

### Dependency Risk

Implicit assumptions about library behavior are invisible until an upgrade breaks them. Check:
- Are there implicit assumptions about library version behavior that could break on upgrade?
- Are optional dependencies handled gracefully if not installed?
- Does the code rely on undocumented or private APIs (leading underscore, no public docs)?
- Are there circular imports that could cause load-time failures?

### Test Coverage Gaps

Tests that only cover the happy path give false confidence — bugs live in error paths, edge cases, and future refactors. Check:
- Is the unhappy path (errors, timeouts, empty results) tested, not just the happy path?
- Are there pure functions currently untestable because they're buried inside larger functions?
- Would a future refactor silently break behavior with no test to catch it?
- Are there invariants that should be asserted but aren't?

### Cleanup and Lifecycle

Resources that aren't cleaned up leak silently — temp files, threads, and connections accumulate until they cause failures far from the origin. Check:
- Are temporary files, threads, or subprocesses always cleaned up on all paths, including errors?
- Are there `__del__` or finalizer patterns that could cause unpredictable cleanup order?
- Does the shutdown/teardown path mirror the setup path in reverse?

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
- Logic errors with a clear correct fix (wrong comparison operator, off-by-one with an obvious bound)
- State not reset between calls when it clearly should be → add reset
- In-place mutation when a copy was clearly intended → add `.copy()` or equivalent
- Missing cleanup in error paths → add to `finally` or `except` block
- Unused imports or variables orphaned by this change → remove

**Flag as `Action needed` without touching code:**
- Performance trade-offs requiring algorithmic redesign
- Data integrity issues requiring atomic transaction support
- Test coverage gaps — describe what tests are needed, don't write them here (use guya-tester)
- Anything where the right fix requires context or design decisions beyond this file

After applying fixes, re-read the modified sections and confirm the fix is correct and introduced no new issues.

End with:

**Fixes Applied**
- `[file:line]` Fixed: [description]
- `[file:line]` Action needed: [what to decide]

## Step 5 — Follow-Up

If undocumented public APIs or exports were found during review, offer to spawn `guya:guya-document` to generate the missing documentation.
