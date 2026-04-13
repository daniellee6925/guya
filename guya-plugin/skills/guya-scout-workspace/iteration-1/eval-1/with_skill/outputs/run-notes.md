# Run Notes — guya-scout eval-1 with_skill

**Date:** 2026-04-13
**Target:** `/Users/daniel/Desktop/guya`
**Phase completed:** Phase 1 only (Exploration + report write)

---

## What the Explore subagent found

The codebase is 141 files across a well-structured plugin architecture. Key findings from exploration:

- **Entry points are clear**: `hooks.json` is the dispatch table, `guya-session-start.mjs` is the hot path, `plugin.json` declares the Claude Code plugin surface.
- **Architecture docs are excellent**: `ARCHITECTURE.md` is comprehensive and current (last updated 2026-04-10/11). It covers module map, hook dispatch table, ADRs, and known constraints. `STATUS.md` is a living log with detailed root-cause notes and a full decision trail.
- **The PostToolUse:Bash constraint** is the single most important non-obvious fact and is documented in three places (ARCHITECTURE.md, hooks/CLAUDE.md, STATUS.md). It's the root cause of the git-hook workaround for the post-commit scribe.
- **Two active code paths for evolution**: the legacy trace-driven path (SessionEnd: haiku classify → sonnet synthesize) and the new reflection-driven path (`/guya-evolve`: reflections → Sonnet synthesizer → apply). The legacy path is still wired but produces near-zero signal; the reflection path is the current primary mechanism.
- **Known bugs catalogued**: `hasLearningSignal` parser mismatch, zombie tactical guideline files, dead `review-gate.json` reference, DRY violations in `readStdin` and `isMain` patterns. All documented in STATUS.md TODO with severity and rationale for deferral.
- **Identity lives outside the repo**: `~/.claude/guya/` is a separate git repo not visible in this codebase scan. The report notes this clearly so a developer isn't confused about where `soul.md` etc. are.

## How long it took

Exploration was conducted as a single-pass read of ~15 key files in parallel, plus targeted follow-up reads on hooks, tools, and agents. Estimated elapsed time: ~3-4 minutes of tool calls. Report was written in one pass after exploration was complete.

## Issues encountered

- The `guya-plugin/.guya/` directory exists as a historical artifact (phantom state dir from cwd-based hook dispatch before `resolveProjectRoot` was added). Mentioned in the report's non-obvious section.
- The output directory (`iteration-1/eval-1/with_skill/outputs/`) did not pre-exist and was created with `mkdir -p` before writing the report.
- No issues accessing any files — all reads succeeded.
