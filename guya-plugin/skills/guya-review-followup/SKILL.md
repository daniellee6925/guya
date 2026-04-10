---
name: guya-review-followup
description: Follow-up review of $ARGUMENTS after initial code review. Focus on deeper issues: logic correctness, state management, data integrity, observability, boundary behavior, dependency risk, test coverage gaps, and cleanup lifecycle.
---

Follow-up review of $ARGUMENTS after initial code review. Focus on these deeper issues:

## Logic Correctness
- Are loop boundaries and slice indices correct (off-by-one)?
- Do conditional branches cover all cases, including unexpected input combinations?
- Is boolean logic correct? Check for de Morgan errors (flipped and/or/not).
- Are comparisons using the right operator (== vs is, > vs >=)?
- Does floating point arithmetic produce correct results at edge values?

## State Management
- Is mutable state shared between calls when it should be isolated?
- Are objects reset/cleared correctly between reuses?
- Can state get stuck in a broken intermediate state if an error occurs mid-operation?
- Are there any global variables that could cause unexpected behavior across calls?

## Data Integrity
- Are writes atomic where they need to be, or can partial writes corrupt data?
- Is there any data that gets mutated in place when a copy was intended?
- Are lists/dicts returned by functions safe to modify by the caller?
- Does the code assume input data is sorted, unique, or non-null without verifying?

## Observability
- Are log messages meaningful enough to debug a production issue without the source code?
- Are errors logged with enough context (what was the input, what was the state)?
- Are there long-running operations with no progress signal?
- Is latency of critical paths instrumented or measurable?

## Boundary Behavior
- What happens at scale limits (empty collection, single item, very large input)?
- What happens when an external service returns an unexpected schema?
- What happens when a timeout or retry is exhausted — does it fail gracefully?
- Are there hardcoded limits (max retries, timeouts, batch sizes) that should be configurable?

## Dependency Risk
- Are there implicit assumptions about library version behavior that could break on upgrade?
- Are optional dependencies handled if not installed?
- Does the code rely on undocumented or private APIs (leading underscore, no public docs)?
- Are there circular imports that could cause load-time failures?

## Test Coverage Gaps
- Is the unhappy path (errors, timeouts, empty results) tested, not just the happy path?
- Are there pure functions that are currently untestable because they are buried inside larger functions?
- Would a future refactor silently break behavior with no test to catch it?
- Are there assertions or invariants that should be checked but aren't?

## Cleanup and Lifecycle
- Are temporary files, threads, or subprocesses always cleaned up?
- Are there any `__del__` or finalizer patterns that could cause unpredictable cleanup order?
- Does the shutdown/teardown path mirror the setup path in reverse?

For each issue found: state the location, explain the risk, and suggest a fix.

Format your output as:

### [Category]
**[file:line]** — [Brief title]
Risk: [Explanation]
Fix: [Suggested fix]

If no issues are found in a category, state "No issues found."
