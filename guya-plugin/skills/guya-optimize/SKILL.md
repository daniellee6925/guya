---
name: guya-optimize
description: Analyze the code at $ARGUMENTS for simplification and optimization opportunities. Report findings only — do not apply fixes. Use when asked to find performance or complexity issues.
---

Analyze the code at $ARGUMENTS for simplification and optimization opportunities. Report findings only — do not apply fixes.

## Simplification
- Is there dead code, unused imports, or unreachable branches?
- Are there overly complex conditionals that could be flattened or simplified?
- Are there unnecessary abstractions, wrappers, or indirection layers?
- Can any logic be replaced with standard library functions or builtins?
- Are there duplicated code blocks that should be consolidated?
- Are variable/function names clear and self-documenting?

## Performance
- Are there blocking calls on async hot paths?
- Are there unnecessary allocations, copies, or conversions in loops?
- Is there repeated work that should be cached or memoized?
- Are there N+1 query patterns or unbatched operations?
- Are there sequential operations that could be parallelized (asyncio.gather, etc.)?
- Are there string concatenations in loops instead of joins?

## Resource Efficiency
- Are there memory leaks: unbounded lists, dicts, or caches that grow forever?
- Are DB connections, file handles, and network sessions properly closed in all paths?
- For LLM calls: is the prompt unnecessarily verbose, wasting tokens?
- For LLM calls: could a cheaper/faster model be used for this task?
- Are batch sizes tuned, or is it processing one-at-a-time when batching is possible?
- Are there redundant I/O operations (reading the same file/key multiple times)?

## Async-Specific
- Are there `await` calls inside loops that should use `asyncio.gather`?
- Are there sync operations (file I/O, CPU-bound work) blocking the event loop?
- Are semaphores or rate limiters properly scoped to avoid bottlenecks?
- Could any sequential async pipeline stages run concurrently?

Format your output as:

### [Category]
**[file:line]** — [Brief title]
Impact: [Low/Medium/High] — [What improves: speed, memory, readability, tokens, etc.]
Current: [What the code does now]
Better: [What it should do instead and why]

If no issues are found in a category, state "No issues found."

At the end, provide a **Priority Summary**: rank the top 5 findings by impact, with estimated effort (trivial/small/medium/large) for each.
