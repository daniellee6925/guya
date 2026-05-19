# guya-plugin/hooks — Hook Implementations

This directory contains all Claude Code lifecycle hooks for Guya. Hooks are registered in `hooks.json` and executed via `run.cjs` (the CommonJS shim that bootstraps ESM modules in the Claude Code plugin environment).

## Dispatch Constraint: PostToolUse:Bash Does Not Fire

Claude Code does not dispatch `PostToolUse` events for the `Bash` tool by name. This is a platform constraint, not a bug. Any hook registered under `PostToolUse` with matcher `Bash` (or a specific tool name like `PostToolUse:Bash`) will never execute.

Consequence: the post-commit scribe cannot be driven by a `PostToolUse:Bash` hook. It is instead installed as a native git hook at `.git/hooks/post-commit` in each repo. The `guya-setup` skill handles that installation.

The `PostToolUse` entry in `hooks.json` uses matcher `Write|Edit` — the only tool names that reliably dispatch this event in Claude Code.

## Dispatch Constraint: PreToolUse Matcher Dedup (Claude Code 2.1.101+)

Starting in Claude Code 2.1.101, `PreToolUse` entries are deduplicated semantically by matcher — multiple top-level entries with `"matcher": "Bash"`, or multiple `hooks[]` items inside one matcher block, collapse so that only **one** hook script runs per tool invocation. Distinct matcher *strings* that compile to equivalent regexes (e.g. `"Bash"` vs `"^Bash$"`) also collapse — confirmed empirically.

Symptom of the bug: a hook that's wired up correctly returns `{ continue: true }` reliably during manual replay, but never appears in the session transcript's hook records, while a sibling hook on the same matcher does. The pre-commit-review gate silently bypassed itself for ~16 days under this regression before being caught.

Workaround in this codebase: a single dispatcher script (`guya-pre-bash-dispatch.mjs`) is registered under `matcher: "Bash"`. It reads stdin once, then runs `guya-pre-commit-review.mjs` and `guya-pre-push-check.mjs` as subprocesses, returning the first blocking decision. **Do not "clean up" by re-splitting these into separate hooks.json entries** — the dedup will silently bypass review again.

Cost: ~2× Node cold-start per Bash tool invocation (~150 ms total in practice). Each sub-hook still no-ops fast on commands it doesn't care about.

## Hook Registry (hooks.json)

| Event | Matcher | Script | Timeout | Purpose |
|-------|---------|--------|---------|---------|
| `PreToolUse` | `Bash` | `guya-pre-bash-dispatch.mjs` | 150s | Single entry that fans out to pre-commit-review + pre-push-check (see dedup constraint above) |
| `PreToolUse` | `Skill` | `guya-pre-commit-review.mjs` | 3s | Review gate when commit runs via a skill |
| `SessionStart` | `*` | `guya-session-start.mjs` | 5s | Assemble and inject `<guya-context>` |
| `UserPromptSubmit` | `*` | `guya-correction-detect.mjs` | 1s | Detect correction signals in user prompts |
| `UserPromptSubmit` | `*` | `guya-intent-detect.mjs` | 1s | Detect decision-harness intent in user prompts |
| `PostToolUse` | `Write\|Edit` | `guya-trace-capture.mjs` | 1s | Append JSONL trace entry for file writes |
| `PreCompact` | `*` | `guya-session-end.mjs` | 30s | Run evolution pipeline before context compaction |
| `SessionEnd` | `*` | `guya-session-end.mjs` | 30s | Run evolution pipeline at session close |

## Hook Scripts

### guya-session-start.mjs
Reads identity files from `~/.claude/guya/` (global) and core memory from `.guya/memory/core/` (project-local), plus strategic and tactical guidelines. Assembles everything into a `<guya-context>` block injected as a system-reminder. Enforces a ~2000-token budget. Creates `.guya/` directory structure on first run (lazy init). No LLM calls — pure file I/O under 5 seconds. Also reads sync-daemon status via `constantia-sync.mjs:readSyncStatus()` and emits a `constantia-sync-alert` section in the assembled `<guya-context>` block when an alert fires; silent in the healthy case and when the daemon isn't deployed (see ADR-024).

### guya-correction-detect.mjs
Runs on every user prompt. Detects correction signals (phrases like "no", "wrong", "that's not right") using fast regex heuristics. When a correction is detected, appends a trace entry tagged `correction` to the daily JSONL file. No LLM calls.

### guya-intent-detect.mjs
Runs on every user prompt. Detects intent that should route through a decision harness (feature, bugfix, refactor, kickoff). Injects a `<guya-intent>` system-reminder to prime the appropriate skill. No LLM calls.

### guya-pre-bash-dispatch.mjs
Single registered hook for `PreToolUse:Bash`. Reads stdin once, then invokes `guya-pre-commit-review.mjs` and `guya-pre-push-check.mjs` as subprocesses with the same payload. If pre-commit-review returns `decision: "block"`, that's returned immediately. Otherwise pre-push-check's decision is returned. Fail-open on any wrapper-level error so a crashed dispatcher never blocks the user. Exists solely to work around the 2.1.101+ matcher-dedup regression — it would not exist if Claude Code honored multiple hooks per matcher.

### guya-pre-commit-review.mjs
Intercepts `git commit` Bash commands before they execute. Reads `.guya/evolution/review-evidence.jsonl` to confirm a review was performed this cycle. Blocks the commit with an explanatory message if evidence is missing or stale. The gate is reset by `guya-post-commit-scribe.mjs` after each successful commit. Invoked by the dispatcher on `PreToolUse:Bash`, and directly on `PreToolUse:Skill` (skill matcher does not collide with the dedup bug).

### guya-pre-push-check.mjs
Intercepts `git push` Bash commands. Runs quality checks (timeout: 150s) and blocks the push if they fail. Intended as the last-mile safety net before code leaves the local repo. Invoked by the dispatcher; no-ops fast for non-push commands.

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

### reflection-synthesis.mjs
Shared module (not a hook script). Imported by `guya-session-end.mjs` and the `/guya-evolve` skill to generate self-edit proposals from recent reflections. Reflection source resolution is **Constantia `log/guya/` primary, project-local `reflectionsDir` as fallback** when Constantia is unavailable — project-local-only reads silently dropped cross-project reflections (lina_platform, sdf-dev, auto_eval) written via `/guya-reflect` that land in Constantia. Closes vision.md §3.1.

Exports:
- `synthesizeFromReflections(opts)` — main entry. `reflectionsDir` is now optional (ignored when Constantia is available and `forceLocal` is false). Optional `forceLocal: false` flag skips Constantia entirely (used for test isolation, since the dev machine has `~/.claude/guya/constantia.json`).
- `readConstantiaReflections(constantiaPath, max)` — reads Guya-authored reflections from Constantia's `log/guya/` (cross-project, canonical, every entry is from `/guya-reflect`).
- `readReflections(reflectionsDir, max)` — project-local fallback reader.
- `readGuidelines(strategicDir)` and `validateIdentityProposals(result, minSources)` — also exported for the synthesizer pipeline and unit tests.

Synthesis runs against ONE source per call to avoid duplicates. The anti-oscillation guardrail (identityProposals require ≥2 source reflections) lives here, not in the caller.

### constantia-sync.mjs
Shared module (not a hook script) for Constantia integration. Resolves the Constantia repo path via `~/.claude/guya/constantia.json` and provides reflection-write helpers used by `/guya-reflect`. Also exports `readSyncStatus(constantiaPath)` which reads the host-side sync daemon's status JSON at `<constantia>/.git/sync-status.json` and returns an alert string (or `null` when healthy/missing). The function surfaces three failure states — heartbeat-stale (daemon not ticking), rebase-conflict (last cycle aborted), and push/fetch-failed (network or remote error). Caveat: the status file lives under `.git/` on the host that runs the daemon (mini) and is not synced via git, so laptop sessions return `null` silently. See ADR-024 for the daemon's role (container-side commits commit-only; host daemon owns push); this module is Guya's surface for daemon health.

Exports:
- `readSyncStatus(constantiaPath)` — daemon health check; returns alert string or `null`.
- (plus the existing reflection-write helpers consumed by `/guya-reflect`)

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
- `PreToolUse:Bash` deduplicates by matcher in Claude Code 2.1.101+ — register exactly one hook against `matcher: "Bash"` and fan out internally if you need multiple checks. See "Dispatch Constraint: PreToolUse Matcher Dedup" above.
- The scribe's idempotency contract depends on the marker file at `.guya/evolution/last-scribe-head`. Do not delete this file manually unless you intend to force a re-process of the current HEAD.

## Regression History

- **2026-04-08 → 2026-04-24**: PreToolUse:Bash review gate silently bypassed (`guya-pre-commit-review.mjs` registered but never dispatched). Root cause: Claude Code 2.1.101 introduced semantic dedup of `PreToolUse` matcher entries; our `hooks.json` had two entries under `matcher: "Bash"` (review + push-check), and dedup kept only the last. Detected when the gate failed to block 7 unreviewed `.py` commits in `auto_eval`. Fixed by introducing the dispatcher pattern. Same lesson as ADR-011 (auto-fire silently breaks): rely on hook execution, verify hook execution.

- **PreToolUse:Skill auto-evidence silently no-op'd (caught 2026-04-27)**: The auto-evidence path on `PreToolUse:Skill` for `/guya-review` and `/guya-deep-review` never wrote to `.guya/evolution/review-evidence.jsonl`, even though the hook was registered, dispatched, and the matcher logic was correct. Root cause: every hook script used the idiom `fileURLToPath(import.meta.url) === process.argv[1]` to gate `main()` for test isolation. Claude Code installs plugins as a symlinked tree under `~/.claude/plugins/marketplaces/`, and Node 24 resolves `import.meta.url` to the **realpath** while `process.argv[1]` keeps the **symlink path** — so the equality always failed and `main()` was never called. The script imported cleanly, exited 0, wrote nothing. Affected every hook with the same guard: `guya-pre-commit-review`, `guya-correction-detect`, `guya-post-commit-scribe`, `guya-session-start`, `guya-session-end`. Fixed by wrapping both sides in `realpathSync()`. Step 0 (manual `record-review-step.mjs` call from each review SKILL.md) had been the workaround; removed once auto-evidence verified.

### Meta-pattern: silent rot of trusted enforcement

Three regressions, same shape:

1. **ADR-011** — `/guya-evolve` auto-fire on session-end silently broke for 6 days when the API key died. The pipeline existed, the trigger fired, but the work never completed and nothing surfaced. Fixed by making `/guya-evolve` manual.
2. **ADR-012** — `PreToolUse:Bash` review gate silently bypassed for 16 days under matcher dedup. The hook was registered but never dispatched. Fixed with the dispatcher pattern.
3. **isMain symlink** — `PreToolUse:Skill` auto-evidence silently no-op'd from the moment the symlinked plugin install became the dispatch path. The hook was registered, dispatched, and the code was correct — `main()` was never reached. Fixed with `realpathSync` on both sides.

In every case the failure was in a "this can't fail" guard or assumption (auto-fire will run; matcher dedup is benign; `import.meta.url === argv[1]` is identity). The defense is not "make the guard smarter" — it's **never trust silent enforcement**. If a hook is supposed to do something on every invocation, it must produce a verifiable side-effect (log line, stderr write, evidence file) that another check can confirm. The next regression of this class is already lurking in some other "obviously equivalent" comparison; assume it exists and add observability before it bites.
