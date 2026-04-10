---
name: guya-cr
description: Comprehensive code review of $ARGUMENTS combining Claude analysis, Karpathy guidelines, and Codex independent review. Use when asked for a full or deep code review.
---

Comprehensive code review of $ARGUMENTS combining Claude analysis, Karpathy guidelines, and Codex independent review.

Run all three review passes, then synthesize into a single prioritized report.

## Pass 1: Karpathy Guidelines

Apply the andrej-karpathy-skills:karpathy-guidelines behavioral rules. Flag overcomplication, unnecessary abstraction, assumptions, and non-surgical changes.

## Pass 2: Claude Deep Review

Review against these categories:

### Silent Errors
- Are all errors explicitly raised or logged? No silent swallowing of exceptions.
- Do error branches clean up resources the same way the happy path does?
- Does it handle None, empty inputs, zero, and empty lists without silently misbehaving?
- Are types validated at boundaries rather than assumed?

### Scalability
- Are there unbounded lists, queues, or dicts that grow forever under load?
- Are DB connections, files, and network connections closed in all paths (including errors)?
- Is there any blocking I/O on a hot path that will bottleneck under concurrency?
- Are there N+1 query patterns or repeated work that should be batched or cached?

### Extensibility
- Is logic tangled into large functions that will be hard to modify later?
- Are side effects (DB writes, API calls) separated from pure logic?
- Would adding a new module or plugin require changing existing core logic?
- Are there magic strings/numbers that should be constants or config?

### AI-Specific Risks
- Do all library method calls actually exist with the correct signatures?
- Are similar generated functions consistent with each other in behavior?
- Is there over-abstraction or unnecessary complexity?
- Are mutable default arguments used anywhere (e.g. `def f(x=[])`)?

### Security
- Are there hardcoded credentials, tokens, or API keys?
- Is any user input interpolated into prompts, queries, or shell commands without sanitization?

### Race Conditions
- In async code, are there ordering assumptions that could break under concurrency?
- Are shared resources properly locked or isolated?

## Pass 3: Codex Independent Review

Run an independent review via Codex CLI. Execute this command:

```bash
cat <file_path> | codex exec "You are a senior software engineer. Review this code for: 1) Bugs and correctness issues 2) Performance problems 3) Architectural concerns 4) Error handling gaps. Be specific with line numbers. Be critical."
```

If the target is a directory, select the 3 most important files by size and complexity to send to Codex.

If Codex is unavailable, note it and continue with Claude-only analysis.

## Synthesis

After all three passes, produce a unified report:

### Agreed Findings
Issues flagged by both Claude and Codex. These are high-confidence problems.

### Claude-Only Findings
Issues only Claude found. Include Karpathy guideline violations here.

### Codex-Only Findings
Issues only Codex found. These are the independent perspective — flag whether you agree or disagree with each.

### Priority Summary
Rank the top findings by severity (Critical / High / Medium / Low) with:
- **[file:line]** — [Title]
- **Severity:** [Critical/High/Medium/Low]
- **Category:** [Bug/Performance/Architecture/Security/Style]
- **Fix effort:** [Trivial/Small/Medium/Large]
- **Description:** [One-line explanation]

## Agent Integration

- If the synthesis identifies undocumented public APIs or exports, offer to spawn `guya:guya-document` to generate the missing documentation
