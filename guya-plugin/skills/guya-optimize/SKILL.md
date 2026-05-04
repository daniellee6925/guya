---
name: guya-optimize
description: Analyze code for simplification, performance, and resource efficiency opportunities. Reports findings only — no auto-fixes, because optimizations involve trade-offs that require judgment (readability vs speed, complexity vs throughput). Use when asked to "optimize", "find performance issues", or "simplify". Trigger proactively on code that looks algorithmically inefficient or resource-heavy.
argument-hint: "<file-path or directory>"
---

# Optimize

A report-only analysis of simplification and optimization opportunities. No fixes are applied — optimizations involve trade-offs that require Daniel's judgment before touching working code.

## Step 1 — Read the Target

Read the file or directory at `$ARGUMENTS`. If a directory, focus on the most computationally active files — orchestrators, hot paths, and anything doing I/O or LLM calls. Understand what the code is doing before evaluating it.

## Step 2 — Analysis Categories

Work through each category. If a category is clean, say so.

### Simplicity

Unnecessary complexity slows down reading, testing, and debugging — and often hides bugs. Check:
- Dead code, unused imports, or unreachable branches?
- Overly complex conditionals that could be flattened or simplified?
- Unnecessary abstractions, wrappers, or indirection layers added speculatively?
- Logic that could be replaced with standard library functions or builtins?
- Duplicated code blocks that should be consolidated?
- Variable or function names that require reading the body to understand?

### Performance

Inefficiency at small scale becomes a bottleneck at production scale — and async code hides latency issues until load hits. Check:
- Blocking calls on async hot paths?
- Unnecessary allocations, copies, or conversions inside loops?
- Repeated work that should be cached or memoized?
- N+1 query patterns or unbatched operations?
- Sequential operations that could be parallelized (`asyncio.gather`, etc.)?
- String concatenations in loops instead of joins?

### Resource Efficiency

Resource leaks are invisible until they cause failures far from the origin — and LLM cost waste is easy to miss. Check:
- Unbounded lists, dicts, or caches that grow forever without eviction?
- DB connections, file handles, and network sessions closed in all paths?
- LLM prompts unnecessarily verbose, wasting tokens per call?
- Could a cheaper/faster model handle this task without quality loss?
- Batch sizes untuned — processing one-at-a-time when batching is possible?
- Redundant I/O: reading the same file or cache key multiple times per operation?

### Async-Specific

Async code that looks concurrent often isn't — sequential `await` in loops is a common source of unnecessary latency. Check:
- `await` calls inside loops that should use `asyncio.gather`?
- Sync operations (file I/O, CPU-bound work) blocking the event loop?
- Semaphores or rate limiters misscoped, creating unintended bottlenecks?
- Sequential async pipeline stages that could run concurrently?

## Step 3 — Output Findings

Use this format for every finding:

```
### [Category]
**[file:line]** — [Brief title]
Impact: [Low / Medium / High] — [What improves: speed, memory, readability, tokens]
Current: [What the code does now]
Better: [What it should do instead and why]

No issues found. (if clean)
```

End with a **Priority Summary** — all findings ranked by impact (highest first), with estimated effort. Do not truncate the list:

```
1. [file:line] — [Title] | Impact: High | Effort: Trivial
2. ...
```
