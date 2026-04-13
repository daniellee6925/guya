# Guya

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8A2BE2)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./guya-plugin/.claude-plugin/plugin.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**A self-evolving personal AI coding agent for Claude Code. Knows who you are, gets better every session, and challenges you to grow.**

_Don't adapt yourself to AI. Adapt AI to you._

[Why Guya exists →](PHILOSOPHY.md) • [Quick Start](#quick-start) • [Commands](#commands) • [Architecture](ARCHITECTURE.md)

---

<p align="center">
  <img src="assets/guya.png" alt="Guya" width="400" />
</p>

---

## What is Guya?

Most AI coding tools start every session from zero. Guya doesn't.

Guya is a Claude Code plugin that turns your coding agent into a persistent personal companion — one that remembers who you are across sessions, learns from every interaction, and actively pushes you to make better decisions instead of letting you hand off all the thinking.

It's built on one idea: **the bottleneck in AI coding isn't the model, it's the rider.** The full thesis is in [PHILOSOPHY.md](PHILOSOPHY.md).

---

## Quick Start

**Step 1: Install**

```bash
/plugin marketplace add https://github.com/daniellee6925/guya
/plugin install guya
```

**Step 2: First-run interview**

```bash
/guya-bootstrap
```

Guya asks who you are, how you like to work, what you're trying to get better at. Takes about 5 minutes. This builds your identity file.

**Step 3: Start using it**

```bash
# Kicking off a new project? Force real decisions up front.
/guya-decision-kickoff

# New feature in an existing project?
/guya-decision-feature

# Session going well? End it properly so Guya learns.
/guya-reflect
```

That's it. Session-start context, memory, and evolution are automatic.

---

## What it does differently

- **Remembers who you are.** Identity, preferences, growth areas, project state — all auto-loaded at session start. No re-explaining.
- **Forces real decisions.** Decision harnesses (kickoff / feature / bugfix / refactor) make you state scope, constraints, and success criteria *before* Claude writes a single line.
- **Learns from reflections.** `/guya-reflect` writes what happened. `/guya-evolve` turns accumulated reflections into guideline updates. Next session behaves differently — automatically.
- **Tracks your growth.** A growth tracker watches the engineering skills you're trying to improve, so the system knows which scaffolding you should outgrow over time.
- **Hard-stops bad commits.** Pre-commit review gate (Karpathy-style) actually blocks, not warns. Can't negotiate with it at 1 a.m.
- **Works across every project.** Global identity in `~/.claude/guya/` + project-local memory in `.guya/`. One Guya, every repo.

---

## Commands

### Decision harnesses
Force real thinking before implementation. Claude is the advisor, you are the decider.

| Command | Use when |
| --- | --- |
| `/guya-decision-kickoff` | Starting a new project. Produces architecture + implementation plan before any code. |
| `/guya-decision-feature` | Adding a feature to an existing project. Scope + constraints + success criteria first. |
| `/guya-decision-bugfix` | Fixing a bug. Forces root-cause thinking and blast-radius assessment. |
| `/guya-decision-refactor` | Refactoring. No vague "clean up" — specific problems, behavior preservation, regression strategy. |
| `/guya-distinguished-engineer` | Zoom out. Debate what this program fundamentally should be. Challenges decisions against core beliefs. |

### Review & ship

| Command | Use when |
| --- | --- |
| `/guya-review` | Focused review applying Karpathy principles — complexity, silent errors, scalability, races. |
| `/guya-deep-review` | Deep second-pass review after `/guya-review` findings are fixed. |
| `/guya-optimize` | Analyze code for simplification, performance, and efficiency opportunities. |
| `/guya-pr` | Pre-PR prep — Codex fresh-eyes pass, scope/breaking-change checks, summary generation. |

### Memory & evolution

| Command | Use when |
| --- | --- |
| `/guya-reflect` | End-of-session reflection. Surfaces what went well, what didn't, what to change. |
| `/guya-evolve` | Synthesize recent reflections into self-edit proposals. Review, approve, apply. |
| `/guya-forget` | Remove a specific guideline or memory. |
| `/guya-scribe` | Update STATUS / ARCHITECTURE / CLAUDE.md files with current project state. |

### Learning & exploration

| Command | Use when |
| --- | --- |
| `/guya-learn` | Socratic learning session on any topic. Active recall, explanation-back, tied to your actual projects. |
| `/guya-scout` | Onboard to a new codebase — high-level architecture down to key components. |

### Setup & status

| Command | Use when |
| --- | --- |
| `/guya-bootstrap` | First-run interview. Builds your user profile. |
| `/guya-setup` | Install Guya's git hooks into the current repo (pre-commit review, post-commit scribe). |
| `/guya-status` | Show Guya's current state — what it knows, recent activity. |
| `/guya-obsidian-sync` | Sync Guya's knowledge into your Obsidian vault. |
| `/guya-skill-creator` | Create / improve / eval custom skills. |

---

## How it works

Guya is built on four primitives, each doing exactly one job:

- **Agents** — specialized contexts for specific kinds of work (e.g. reflection synthesizer, consolidator)
- **Skills** — reusable playbooks the model follows for repeated tasks (the `/guya-*` commands above)
- **Hooks** — things that must happen automatically, not by discipline (session-start context, pre-commit review, post-commit scribe)
- **Memory** — three-tier (core / recall / archival), global identity + project-local state, versioned in git

The session-start hook assembles who you are, what project this is, and what happened last time — before the first message. The evolution pipeline (reflect → synthesize → apply) runs on-demand to keep Guya's behavior improving over time.

Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Why this exists

Most of the AI coding discourse is about the harness — which tool, which stack, which loop. I think that's one level too low.

Everyone is riding the same horse (Opus 4.6). The rider is what differs. A harness built for Karpathy will throw a newbie rider off. The right harness is one that fits *you* — your level, your weaknesses, the tasks you actually repeat.

Guya is my attempt at that. It's also an attempt to solve the deeper problem: that I kept letting Claude make decisions for me because I didn't know enough to make them myself. A plugin that forces me to decide, learns from how I work, and grows me into a better engineer — not just a more dependent one.

The full argument (with stories, mental model, and the two-sided bet) is in **[PHILOSOPHY.md](PHILOSOPHY.md)**. Read that if the *why* matters more than the *how*.

---

## Project structure

```
guya/
├── guya-plugin/           # The Claude Code plugin itself
│   ├── skills/            # /guya-* slash commands
│   ├── agents/            # Specialized sub-agents
│   ├── hooks/             # Session-start, pre-commit, post-commit, session-end
│   └── tools/             # MCP server (memory, evolution, identity tools)
├── context/
│   ├── core-beliefs.md    # Architectural invariants
│   └── vision.md          # Acceptance criteria + north star
├── ARCHITECTURE.md        # System design
├── STATUS.md              # Current project state
└── PHILOSOPHY.md          # Why this project exists
```

Global identity lives in `~/.claude/guya/` (user profile, growth tracker, strategic guidelines). Project-local state lives in `.guya/` inside each repo.

---

## Status

Guya is in **active personal use** by its author. It is not packaged for general distribution — no npm release, no marketplace listing yet. The code is open for reading and forking if you want to build your own version.

See [STATUS.md](STATUS.md) for current focus and [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

---

## License

[MIT](./LICENSE) © 2026 Daniel Lee

---

## Credits

Built on ideas from Letta/MemGPT (three-tier memory), Reflexion (verbal reinforcement), EvolveClaw (SCOPE classification), OMC (agent orchestration), and claude-mem (cross-session persistence).
