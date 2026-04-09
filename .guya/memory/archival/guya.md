# guya

## Session Log
- **2026-03-31**: Built Guya from scratch. All 6 phases implemented. Architecture plan via ralplan consensus. Identity files, MCP server (14 tools), 4 hooks, 4 agents, 5 skills. Installed as Claude Code plugin.
- **2026-03-31 session 2-3**: Learned OMC architecture (agents, skills, hooks, composition). Fixed snake_case bug in trace capture. Added pre-filter for trace classification. Added intent detection hook + SDF archival memory. Active Session Behaviors added to context injection.
- **2026-04-05**: Added pre-commit quality harness (test verification, complexity check, cleanup scan + karpathy-review gate). Growth tracker created with Karpathy-level training guideline. Tone guideline updated — casual, unfiltered, roasting welcome. Fixed Zod schema crash in MCP tools. Learning about OpenClaw for standalone Mac Mini agent.
- **2026-04-06**: Fixed CJS wrapper for hooks (ESM stdin piping issue). Moved growth tracker to global ~/.claude/guya/. Added self-awareness guideline (know where your memory lives). Added code review pause guideline. Pre-commit hook now works across all projects.
- **2026-04-07**: Token budget optimization session. Cut CLAUDE.md files from 663→175 lines (73%). Consolidated soul.md + creed.md + hardcoded session behaviors into single soul.md. Trimmed user.md from 77→33 lines. Extracted LLM Design Patterns to docs/llm-design-patterns.md. Updated session-start hook to load consolidated files. Estimated ~1500-2000 token/session savings from static context alone.
- **2026-04-08 AM**: Tooling audit and skill creation session. Installed Codex CLI (gpt-5.4), tested CCG pipeline with live review on SDF director.py. Created 3 custom slash commands: /optimize, /cr, /learn. Built post-commit scribe hook and pre-push validation hook.
- **2026-04-08 session 2**: Infrastructure + bugfix session. Built pre-push PR readiness hook and post-commit scribe hook. Fixed critical pre-commit hook bypass (git add && git commit). Best collaborative pacing session.
- **2026-04-08 PM**: Hook testing and evolution pipeline session. Centralized traces (4,052 from 9 projects). Expanded feedback detection 3→13 patterns. Hardened review gate. Wrote claude-code-guide.md. Growth tracker: "ask why" B-, technical writing B+, milestone #3 done.
- **2026-04-08 Late PM**: Review gate reliability session. Fixed race condition (gate consumption moved to post-commit). Enforced two-pass review. Fixed scribe bugs and test regex.
- **2026-04-08 Evening**: Obsidian vault integration. Created 5 wiki pages (entities: guya, sdf, bosonai, daniel-lee + synthesis: growth-tracker). Added session-end hook auto-sync (growth tracker grades/milestones + project entity status). Created /guya-obsidian-sync manual skill. Shipped 3 regex bugs on first pass — caught by testing and review gate.
- **2026-04-08 Session 5**: Committed previous session's work (two-layer commit validation, reflections/archive). Discovered review gate never fired — all files were exempt via pathExempt (hooks/) and reviewExempt (*.md, *.json). Removed hooks/ from pathExempt, tightened small change threshold to 10 lines, removed maxFiles. Learning session on Claude Code hooks: stdin/stdout contract, Pre/Post timing, matchers, gate pattern, git hooks vs Claude hooks trust model.


## Session 2026-04-08 Late Evening (Decision Harness)

Built decision harness system to force staff-engineer thinking before implementation. Root problem: Daniel delegates scope/constraints decisions to Claude upfront → wrong implementations → rework. Solution: Explicit trigger skills that ask 8-12 probing questions, synthesize into decision doc + full lod-planner plan + task.

**4 skills created:**
- `/feature` (10 questions) — new capability (scope, constraints, success criteria)
- `/bugfix` (8 questions) — debugging/fixing (root cause, blast radius, verification)
- `/refactor` (8 questions) — code quality (specific problems, behavior preservation)
- `/kickoff` (12 questions) — new project from scratch (mirrors lod-planner Phase 0)

**Enforcement hook (UserPromptSubmit):**
- `guya-decision-gate.mjs` detects work intent via regex patterns
- Session-scoped `.active-session` marker prevents circumvention
- Blocks implementation if no harness run in current session
- Post-commit hook clears the marker (one thing per session)

**Code quality:** Reviewed twice (Karpathy + deep review). Fixed defensive checks for tool_input structure. Added observability logging. All tests pass.

**Key insights:**
- Session-scoped enforcement better than time-scoped (one coherent piece of work per session)
- Global skills in guya-plugin work across all projects
- Teaching through questioning forces Daniel to think, not just receive answers
- Hard gate for all projects, no exemptions

**Next:** Restart Claude Code, test `/feature` on SDF idea, iterate on question intensity.


## Session 2026-04-09
- Tools used: unknown, Edit: guya-decision-gate.mjs
- Domains: general
- Traces: 512
