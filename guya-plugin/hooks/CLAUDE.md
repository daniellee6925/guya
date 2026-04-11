# guya-plugin/hooks — Hook Implementations

This directory contains all Claude Code lifecycle hooks for Guya. Hooks are registered in `hooks.json` and executed via `run.cjs` (the CommonJS shim that bootstraps ESM modules in the Claude Code plugin environment).

## Dispatch Constraint: PostToolUse:Bash Does Not Fire

Claude Code does not dispatch `PostToolUse` events for the `Bash` tool by name. This is a platform constraint, not a bug. Any hook registered under `PostToolUse` with matcher `Bash` (or a specific tool name like `PostToolUse:Bash`) will never execute.

Consequence: the post-commit scribe cannot be driven by a `PostToolUse:Bash` hook. It is instead installed as a native git hook at `.git/hooks/post-commit` in each repo. The `guya-setup` skill handles that installation.

The `PostToolUse` entry in `hooks.json` uses matcher `Write|Edit` — the only tool names that reliably dispatch this event in Claude Code.

## Hook Registry (hooks.json)

| Event | Matcher | Script | Timeout | Purpose |
|-------|---------|--------|---------|---------|
| `PreToolUse` | `Bash` | `guya-pre-commit-review.mjs` | 5s | Block commits that lack review evidence |
| `PreToolUse` | `Bash` | `guya-pre-push-check.mjs` | 150s | Block pushes that fail quality checks |
| `PreToolUse` | `Skill` | `guya-pre-commit-review.mjs` | 3s | Same review gate when commit runs via a skill |
| `SessionStart` | `*` | `guya-session-start.mjs` | 5s | Assemble and inject `<guya-context>` |
| `UserPromptSubmit` | `*` | `guya-correction-detect.mjs` | 1s | Detect correction signals in user prompts |
| `UserPromptSubmit` | `*` | `guya-intent-detect.mjs` | 1s | Detect decision-harness intent in user prompts |
| `PostToolUse` | `Write\|Edit` | `guya-trace-capture.mjs` | 1s | Append JSONL trace entry for file writes |
| `PreCompact` | `*` | `guya-session-end.mjs` | 30s | Run evolution pipeline before context compaction |
| `SessionEnd` | `*` | `guya-session-end.mjs` | 30s | Run evolution pipeline at session close |

## Hook Scripts

### guya-session-start.mjs
Reads identity files from `~/.claude/guya/` (global) and core memory from `.guya/memory/core/` (project-local), plus strategic and tactical guidelines. Assembles everything into a `<guya-context>` block injected as a system-reminder. Enforces a ~2000-token budget. Creates `.guya/` directory structure on first run (lazy init). No LLM calls — pure file I/O under 5 seconds.

### guya-correction-detect.mjs
Runs on every user prompt. Detects correction signals (phrases like "no", "wrong", "that's not right") using fast regex heuristics. When a correction is detected, appends a trace entry tagged `correction` to the daily JSONL file. No LLM calls.

### guya-intent-detect.mjs
Runs on every user prompt. Detects intent that should route through a decision harness (feature, bugfix, refactor, kickoff). Injects a `<guya-intent>` system-reminder to prime the appropriate skill. No LLM calls.

### guya-pre-commit-review.mjs
Intercepts `git commit` Bash commands before they execute. Reads `.guya/evolution/review-evidence.jsonl` to confirm a review was performed this cycle. Blocks the commit with an explanatory message if evidence is missing or stale. The gate is reset by `guya-post-commit-scribe.mjs` after each successful commit.

### guya-pre-push-check.mjs
Intercepts `git push` Bash commands. Runs quality checks (timeout: 150s) and blocks the push if they fail. Intended as the last-mile safety net before code leaves the local repo.

### guya-post-commit-scribe.mjs
Invoked by `.git/hooks/post-commit` (not by a Claude Code hook — see dispatch constraint above). After a real `git commit` lands:
1. Reads current HEAD SHA via `git rev-parse HEAD`.
2. Compares against `.guya/evolution/last-scribe-head` (the marker file).
3. If HEAD advanced: appends the commit to `STATUS.md` under `## Recent Changes`, resets the review gate, clears the active decision session, and writes the new HEAD SHA to the marker.
4. If HEAD is unchanged: skips silently. This handles blocked commits, duplicate hook fires, and spurious regex hits without wiping review evidence.

The marker file uses full 40-char SHAs (not abbreviated hashes) to avoid substring collision bugs. Writes are atomic (temp file + rename).

### guya-trace-capture.mjs
Fires on `PostToolUse:Write|Edit`. Appends a JSONL entry to `.guya/evolution/traces/YYYY-MM-DD.jsonl` (and a copy to `~/.claude/guya/traces/`). Entries include tool name, file path, session ID, and timestamp. Capped at 5MB per daily file. No LLM calls — completes under 50ms.

### guya-session-end.mjs
Fires on `SessionEnd` and `PreCompact`. Runs the evolution pipeline: classifies accumulated traces (haiku), synthesizes guidelines from high-confidence classifications (sonnet), and writes new tactical guidelines to `.guya/evolution/guidelines/tactical/`. Makes Anthropic API calls — budget up to 30 seconds.

### review-evidence.mjs
Shared utility (not a hook script). Reads and writes `.guya/evolution/review-evidence.jsonl`. Used by `guya-pre-commit-review.mjs` to check for evidence and by the review skills to record it.

### hook-utils.mjs
Shared utilities used across multiple hooks:
- `isGitCommit(toolName, toolInput)` — detects actual `git commit` invocations without false-positives from echo or display commands
- `resolveProjectRoot(cwd)` — walks up the directory tree to find the nearest `.guya/` directory

### run.cjs
CommonJS entry-point shim. Claude Code plugin hooks execute as CommonJS; this shim dynamically imports the target ESM `.mjs` module and pipes stdin/stdout correctly.

### debug-stdin.mjs
Development utility. Prints the raw stdin payload a hook receives, for diagnosing dispatch and payload shape issues.

## Key Constraints

- All hooks must complete within their registered timeout. Exceeding it causes Claude Code to kill the process and treat the hook as failed.
- Hooks must write their response JSON to stdout and any diagnostics to stderr.
- `PostToolUse:Bash` never dispatches — do not register hooks against it.
- The scribe's idempotency contract depends on the marker file at `.guya/evolution/last-scribe-head`. Do not delete this file manually unless you intend to force a re-process of the current HEAD.
