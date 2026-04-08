# How I Use Claude Code — A Practical Guide

> A living document. Updated as I learn new patterns. Started 2026-04-08.

I've been using Claude Code daily for ML engineering, building agent systems, and managing multiple projects. This guide is what I wish someone had given me on day one — structured from basics to advanced, with real examples from my workflow.

---

## Tier 1: Foundations

These are the highest-leverage things to set up first. Each one compounds over time.

### CLAUDE.md — Persistent Project Instructions

The single most important file. Create a `CLAUDE.md` at your project root and Claude reads it every session. No more repeating yourself.

What to put in it:
- What the project is and what it does
- Architecture decisions and why they were made
- Development conventions (language, style, testing approach)
- Current status — what's done, what's in progress

```markdown
# My Project

## What This Is
A REST API for managing inventory. FastAPI + PostgreSQL.

## Conventions
- Python 3.12, type hints everywhere
- Tests in tests/ mirroring src/ structure
- Pydantic models in src/models/, routes in src/routes/

## Current Status
- [x] Auth endpoints
- [x] Product CRUD
- [ ] Order processing (in progress)
```

You can also have a **global** `~/.claude/CLAUDE.md` for instructions that apply everywhere — coding style, tools you prefer, behaviors you always want.

**Key insight:** Treat CLAUDE.md like a living doc, not a one-time config. Update it as the project evolves. If it isn't written down, Claude doesn't know it.

### Custom Slash Commands

Create reusable prompts in `~/.claude/commands/` (global) or `.claude/commands/` (project-local). Each `.md` file becomes a `/command`.

Example — a code review command at `~/.claude/commands/review.md`:
```markdown
Review the code at $ARGUMENTS for:
1. Logic errors and edge cases
2. Security issues (injection, auth, data exposure)
3. Performance concerns
4. Readability and naming

Be specific. Reference line numbers. Prioritize by severity.
```

Now `/review src/auth.py` runs that full prompt. Way better than typing it every time.

### Settings

`~/.claude/settings.json` controls permissions and behavior:
```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm test)",
      "Bash(python -m pytest)"
    ]
  }
}
```

This auto-approves common commands so you're not clicking "allow" 50 times per session.

### Giving Good Context

Start every session with what you're working on and why. One sentence of context makes Claude 10x more useful.

Bad: "fix the bug"
Good: "The /orders endpoint returns 500 when quantity is 0. I think the validation in order_service.py is missing a zero check. Can you look?"

The difference: Claude knows where to look, what the expected behavior is, and your hypothesis. It can either confirm or offer a better diagnosis.

---

## Tier 2: Workflow Patterns

Once you're comfortable with the basics, these patterns make you significantly faster.

### Plan Before Building

For anything non-trivial, use Plan mode (`/plan` or Shift+Tab to toggle). Claude outlines the approach, you review and adjust, then it executes.

This matters because:
- Catches wrong assumptions before code is written
- You learn architecture by reviewing plans, not just reading finished code
- Prevents the "built the wrong thing" problem

When to plan: new features, refactors touching multiple files, anything you'd whiteboard first.
When to skip: small fixes, config changes, one-file edits.

### Review What Claude Writes

This is the hardest habit to build and the most important. Don't just accept code — actually read it.

Pick one thing per edit to understand:
- "Why did you use a dictionary here instead of a class?"
- "What happens if this API call times out?"
- "Why is this async?"

You don't need to review everything. But reviewing *nothing* means you're not learning.

### Break Big Tasks Into Steps

Don't say "build me a full authentication system." Instead:
1. "Let's design the auth flow — what endpoints do we need?"
2. "Implement the JWT token generation"
3. "Add the login endpoint"
4. "Add middleware for protected routes"
5. "Write tests for the auth flow"

Each step is reviewable. You stay in control. You learn more.

### Git Workflow

Let Claude handle the mechanical parts (staging, commit messages, diffing) but make the decisions yourself:
- Review diffs before committing
- Write or approve commit messages — they're documentation
- Don't let Claude push without you checking what's going out

---

## Tier 3: Power User

This is where Claude Code becomes an entire development environment, not just a coding assistant.

### Hooks — Automated Behaviors

Hooks run code in response to Claude Code events. Think of them like git hooks but for your AI workflow.

Hook types:
- **PreToolUse** — runs before a tool executes (can block it)
- **PostToolUse** — runs after a tool completes
- **UserPromptSubmit** — runs when you send a message
- **SessionStart/End** — runs at session boundaries

Real examples from my setup:
- **Pre-commit review** — automatically checks code complexity, cleanup issues, and test coverage before allowing a commit
- **Pre-push validation** — runs linting, tests, and WIP commit detection before pushing
- **Post-commit scribe** — auto-logs every commit to a STATUS.md file
- **Feedback detection** — captures when I correct, confirm, or push back on Claude's approach

Hooks live in `.claude/settings.json` or in plugin configuration. They're Node.js scripts that read JSON from stdin and output JSON.

### Plugins and MCP Servers

Plugins bundle hooks, skills, and tools into installable packages. MCP (Model Context Protocol) servers expose custom tools that Claude can call.

Example: I built a plugin that gives Claude:
- Memory tools (read/write/search persistent memory)
- Evolution tools (track patterns in my usage over time)
- Identity tools (maintain consistent personality across sessions)

This is advanced — start with hooks first, graduate to plugins when you need reusable packages.

### Multi-Model Workflows

Claude Code can orchestrate other AI models for independent perspectives:
- Use a second model for code review (different blind spots)
- Run parallel analysis and synthesize results
- Get architectural opinions from multiple sources before deciding

### Quality Gates

Automated checks that run before key actions:
- **Pre-commit**: complexity check, cleanup scan, test verification
- **Pre-push**: lint, test suite, WIP commit detection
- **Code review**: automated review pass before human review

These catch problems before they ship. Set them up once, benefit forever.

---

## Principles I've Learned

1. **Claude Code is infrastructure, not just a chatbot.** The more you invest in CLAUDE.md, commands, and hooks, the more it compounds.

2. **Context is everything.** A well-written CLAUDE.md makes every session start at 80% instead of 0%.

3. **Review the code.** The fastest way to stop learning is to accept everything blindly. Pick one thing per session to understand deeply.

4. **Automate the repetitive stuff.** If you're doing the same thing every session, make it a command or hook.

5. **Start simple.** CLAUDE.md alone gets you 80% of the value. Don't jump to plugins before you've mastered the basics.

---

## My Current Setup (Reference)

For context, here's what I'm running as of April 2026:

- **Global CLAUDE.md** — coding conventions, design patterns, tool preferences
- **Per-project CLAUDE.md** — project-specific architecture, status, decisions
- **Custom commands** — `/review`, `/optimize`, `/learn`, `/cr`
- **Hooks** — pre-commit quality gate, pre-push validation, post-commit logging, feedback detection, session context assembly
- **Plugin** — Guya (self-evolving agent with memory, identity, and growth tracking)
- **Multi-model** — Claude + Codex + Gemini for code review synthesis

You don't need all of this. Start with Tier 1 and build up as you hit friction.

---

*Last updated: 2026-04-08*
