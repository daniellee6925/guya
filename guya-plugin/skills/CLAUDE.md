# guya-plugin/skills — Skill Definitions

This directory contains all Guya skill definitions. Each skill lives in its own subdirectory with a `SKILL.md` file that Claude Code loads when the skill is invoked.

Skills are invoked via `/guya-skill-name` or by matching trigger phrases listed in each `SKILL.md`. The full catalog is also mirrored in `AGENTS.md` for agent-routing reference.

## Skill Catalog

### Setup

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-setup/` | guya-setup | Bootstrap Guya in any repo — creates `.guya/` directory tree, writes `pre-commit-config.json`, installs post-commit scribe and pre-commit quality gate. Run once per repo. |

### Core / Identity

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-bootstrap/` | guya-bootstrap | First-run interview that builds Daniel's profile. Triggers automatically when `~/.claude/guya/` is missing. |
| `guya-status/` | guya-status | Show Guya's current state: guideline inventory, trace counts, evolution status. |
| `guya-evolve/` | guya-evolve | Trigger manual guideline consolidation — merge duplicates, promote validated tactics, prune stale ones. |
| `guya-reflect/` | guya-reflect | Manual reflection cycle — surfaces what Daniel should take away and what Guya should learn from a session. |
| `guya-forget/` | guya-forget | Remove a specific guideline or memory by name or description. |
| `guya-scribe/` | guya-scribe | Update `STATUS.md`, `ARCHITECTURE.md`, and relevant `CLAUDE.md` files with current project state. |
| `guya-obsidian-sync/` | guya-obsidian-sync | Sync Guya's knowledge to Daniel's Obsidian vault. |
| `guya-skill-creator/` | guya-skill-creator | Create new skills, improve existing skills, and measure skill performance. |

### Decision Harnesses

Staff-engineer-level decision harnesses. Each forces structured thinking before any implementation begins.

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-decision-kickoff/` | guya-decision-kickoff | Project kickoff harness. Forces product and architecture thinking before writing any code. |
| `guya-decision-feature/` | guya-decision-feature | Feature harness. Forces requirements, design, and test-plan thinking before implementation. |
| `guya-decision-bugfix/` | guya-decision-bugfix | Bug-fix harness. Forces root-cause analysis and reproduction before any fix. |
| `guya-decision-refactor/` | guya-decision-refactor | Refactor harness. Forces scoping, behavior-preservation contract, and rollback plan. |
| `guya-distinguished-engineer/` | guya-distinguished-engineer | Project direction harness. Discusses what the program fundamentally IS, challenges drift against core beliefs, and maintains `context/core-beliefs.md` and `context/vision.md`. |

### Code Review and Quality

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-review/` | guya-review | Focused code review: Karpathy principles, silent errors, scalability, security, race conditions. |
| `guya-deep-review/` | guya-deep-review | Deep second-pass review after `guya-review` findings are fixed. Catches logic bugs, state management issues, data integrity gaps, and observability holes. |
| `guya-pr/` | guya-pr | Pre-PR preparation. Runs a Codex fresh-eyes pass on the full diff, checks PR readiness, surfaces cross-diff inconsistencies, and drafts the PR summary. |
| `guya-optimize/` | guya-optimize | Analyze code for simplification, performance, and resource efficiency opportunities. Report only — no fixes applied. |

### Learning

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-learn/` | guya-learn | Interactive learning session from first principles with active recall and progress tracking. |

### Codebase Exploration

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-scout/` | guya-scout | Codebase onboarding: Explore subagent generates scout-report.md (8 sections incl. Directory Map + Where to Start), then bidirectional Q&A session. |

## guya-setup Detail

`guya-setup` exists because `PostToolUse:Bash` does not dispatch in Claude Code (platform constraint). The post-commit scribe (`guya-post-commit-scribe.mjs`) therefore cannot be driven by a Claude Code hook — it must be registered as a native git hook.

`guya-setup` bootstraps Guya in a repo. It must be run once where Guya should be active:

1. Verifies the directory is a git repo.
2. Creates the `.guya/` directory tree (`memory/{core,recall,archival,reflections}`, `evolution/{traces,guidelines}`, `decisions/`).
3. Copies `pre-commit-config.json` into `.guya/` if none exists.
4. Installs `.git/hooks/post-commit` (scribe) — fresh or appended if a non-guya hook exists.
5. Installs `.git/hooks/pre-commit` (quality gate) — only if no existing pre-commit hook is present. Never clobbers.
6. Verifies and reports what changed.

Templates for both hooks and the default config live in `skills/guya-setup/templates/`. The post-commit hook is a self-contained bash script that locates the Guya plugin in the cache at runtime and invokes `guya-post-commit-scribe.mjs` via `run.cjs`; it exits silently if `.guya/` does not exist. The pre-commit hook reads `.guya/pre-commit-config.json` and enforces test-file existence, file/function LOC limits, and a cleanup scan.

Trigger phrases: "guya setup", "install guya hooks", "set up guya in this repo", "add guya hooks here".

## Adding a New Skill

1. Create a subdirectory under `guya-plugin/skills/` named `guya-<name>/`.
2. Write `SKILL.md` with frontmatter (`name`, `description`) and the full workflow.
3. Add a row to the appropriate table in this file and in `AGENTS.md`.
4. If the skill is wired to an agent, add the wiring note to `guya-plugin/CLAUDE.md`.
