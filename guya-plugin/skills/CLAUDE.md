# guya-plugin/skills — Skill Definitions

This directory contains all Guya skill definitions. Each skill lives in its own subdirectory with a `SKILL.md` file that Claude Code loads when the skill is invoked.

Skills are invoked via `/guya-skill-name` or by matching trigger phrases listed in each `SKILL.md`. The full catalog is also mirrored in `AGENTS.md` for agent-routing reference.

## Skill Catalog

### Setup

| Directory | Skill | Purpose |
|-----------|-------|---------|
| `guya-setup/` | guya-setup | Install Guya git hooks into any repo. Writes `.git/hooks/post-commit` to wire the post-commit scribe. Run once per repo. |

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

## guya-setup Detail

`guya-setup` exists because `PostToolUse:Bash` does not dispatch in Claude Code (platform constraint). The post-commit scribe (`guya-post-commit-scribe.mjs`) therefore cannot be driven by a Claude Code hook — it must be registered as a native git hook.

`guya-setup` installs that git hook. It must be run once in each repo where Guya should be active:

1. Verifies the directory is a git repo.
2. Checks whether `.git/hooks/post-commit` already contains the scribe block.
3. Writes a fresh hook or appends the scribe block to an existing one.
4. Makes the hook executable.

The installed hook is a self-contained bash script that locates the Guya plugin in the Claude Code plugin cache at runtime, then invokes `guya-post-commit-scribe.mjs` via `run.cjs`. It exits silently if `.guya/` does not exist in the repo root, so it is safe to install in repos that are not yet Guya-enabled.

Trigger phrases: "guya setup", "install guya hooks", "set up guya in this repo", "add guya hooks here".

## Adding a New Skill

1. Create a subdirectory under `guya-plugin/skills/` named `guya-<name>/`.
2. Write `SKILL.md` with frontmatter (`name`, `description`) and the full workflow.
3. Add a row to the appropriate table in this file and in `AGENTS.md`.
4. If the skill is wired to an agent, add the wiring note to `guya-plugin/CLAUDE.md`.
