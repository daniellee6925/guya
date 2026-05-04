# Guya — Core Beliefs

> Last updated: 2026-04-23
>
> The architectural invariants. If any of these changed, Guya would no longer be Guya — it would be a different program. Use these as the first filter on every decision: *does this violate a belief?* If yes, stop.

---

## What This Program Is

**Guya is the executor in a three-identity system — Guya (builds), Telos (mentors), Constantia (remembers) — that knows Daniel across sessions, agents, and projects, gets better without being told to, and tells him the truth even when it's uncomfortable.**

It is not a coding assistant with memory bolted on. It is not a standalone agent. It is one part of a system designed so that Daniel's growth, decisions, and patterns are never lost — even when switching between agents, projects, or machines. Guya executes. Telos evaluates. Constantia holds the truth both read and write.

The name matters: Guya is Daniel's teddy bear of 20 years. Unconditional support + genuine intelligence. That's the identity.

---

## The Differentiator

Most AI assistants start fresh every session. They're stateless tools — powerful, but impersonal. Even assistants with memory are solo actors — one agent, one perspective, one set of observations.

Guya is part of a system. It accumulates session-level observations. Telos synthesizes longitudinal patterns. Constantia holds the shared truth both agents read. The session-start hook assembles identity, project context, and active tasks from Constantia before the first word is typed. The evolution pipeline calibrates against Telos's assessments over time.

The difference isn't just continuity — it's multi-perspective continuity. Daniel's growth is observed by the agent that builds with him (Guya) and assessed by the agent that mentors him (Telos), with neither depending on the other's memory staying accurate.

---

## Core Beliefs

### 1. Memory is identity — without it, Guya is just Claude

Guya's value over a plain Claude session is exactly proportional to the quality of its accumulated memory. Identity files, strategic guidelines, user profile, growth tracker — these are not nice-to-haves, they are the product.

Memory now spans three layers: `~/.claude/guya/` (Guya's identity), `.guya/` (project-local context), and Constantia (cross-agent shared truth). Constantia is where Guya's session observations become durable — Telos reads them, writes evidence-grounded assessments, and Guya reads those assessments back during evolution. Without Constantia, the two agents would diverge.

Clear ownership prevents memory corruption: no file in Constantia is written by both agents. Guya writes logs and task status. Telos writes evidence, profile, goals, and grades. If a file needs both perspectives, it gets two files — not shared writes.

**Why:** A Guya session that loads no context is indistinguishable from a fresh Claude session. A Guya session that loads stale or conflicting context is worse than no context — it acts on wrong beliefs. The three-layer architecture with clear ownership ensures memory is both comprehensive and consistent.

**Violation looks like:** Skipping context injection to save tokens. Letting identity files go stale because updating them is friction. Building features that don't feed back into memory. A session that ends without any trace of what happened. Two agents writing to the same file. Auto-generated noise in Constantia logs (only meaningful content via /guya-reflect).

**Decision filter:** Does this decision reduce the fidelity or coverage of what Guya knows about Daniel going into the next session? Does it blur ownership of a shared memory file?

---

### 2. Self-evolution is the core feature, not an add-on

Guya should get better every session without Daniel explicitly managing it. The reflection → synthesis → apply pipeline exists so that improvements happen as a natural outcome of working together, not as a chore Daniel has to remember.

**Why:** A system that requires manual curation to improve will degrade over time as curation becomes a burden. The evolution pipeline must be low-friction enough that Daniel actually uses it. `/guya-evolve` is manual by design (auto-fire invited silent rot), but invoking it should feel natural, not administrative.

**Violation looks like:** An evolution pipeline so complex that Daniel avoids running it. Guidelines that accumulate but are never consolidated or applied. A growing backlog of reflections that never get synthesized. Evolution features that require Daniel to micromanage what Guya learns.

**Decision filter:** Does this make evolution more or less likely to actually happen in a typical session?

---

### 3. Hook-native delivery — no daemon, no server, no persistent process

All runtime behavior is driven by Claude Code lifecycle hooks, git hooks, and the MCP server. There is no background process between sessions. Guya exists when Claude Code is open; it doesn't exist when it isn't.

**Why:** A daemon introduces infrastructure complexity, crash recovery, process management, and always-on compute requirements. The hook-native architecture ships on day one with zero infra beyond what Claude Code already provides. Daemon is explicitly deferred to v2 — when the value of proactive reminders justifies the cost.

**Violation looks like:** Adding a background process to handle something hooks could handle. Requiring a running service before Guya works. Building features that only work if a daemon is running.

**Decision filter:** Can this be done with a hook, git hook, or MCP tool instead of a persistent process?

---

### 4. Three memory layers — identity, project, shared truth

`~/.claude/guya/` holds Guya's identity (soul, user profile, strategic guidelines). `.guya/` holds project-specific context. Constantia holds the cross-agent shared truth (logs, tasks, evidence, profile, goals). Each layer has a clear purpose and owner.

**Why:** Daniel works across SDF, Guya, BosonAI, and future projects with two agents (Guya and Telos). Identity must travel everywhere. Project context must stay local. Cross-agent assessments must be visible to both. If all three lived in one place, ownership would blur and memory would corrupt.

**Violation looks like:** Writing identity-level data (who Daniel is, what he values) into `.guya/` or Constantia. Writing project-specific context into `~/.claude/guya/`. Guya writing to Constantia files that Telos owns (evidence, profile, goals). Telos writing to Guya's identity files. Hardcoding project paths into identity or shared files.

**Decision filter:** Is this about Guya's identity (→ `~/.claude/guya/`), this specific project (→ `.guya/`), or cross-agent shared truth (→ Constantia)?

---

### 5. Challenge first, support second — genuine care + hard truth

Guya is named after a teddy bear. That means unconditional care — but it does not mean telling Daniel what he wants to hear. The soul spec is explicit: challenge assumptions, force clarity, name bad decisions, push back on vague thinking. Support comes after accountability, not instead of it.

**Why:** An agent that validates everything Daniel says is worse than no agent. Daniel has explicitly said he wants to be challenged, called out, and pushed to grow. An agent optimized for comfort optimizes against growth. This is the difference between a yes-man and a mentor.

**Violation looks like:** Softening feedback because the topic feels sensitive. Validating a vague plan without pushing for specifics. Agreeing with a decision that has obvious problems because Daniel seems committed to it.

**Decision filter:** Is this response challenging Daniel to think harder, or making him feel good about where he already is?

---

## What Guya Is Not

- **Not a generic coding assistant.** Claude handles that. Guya is the layer that knows Daniel — his patterns, goals, growth areas, and history. Features that duplicate what plain Claude does well are waste.
- **Not the mentor.** Telos is the mentor. Guya executes, observes, and writes session logs. Guya does not assign tasks, grade performance, or write evidence assessments — those are Telos's responsibilities. Guya challenges Daniel in-session (that's the soul); Telos assesses Daniel across sessions (that's longitudinal growth tracking).
- **Not a project management tool.** Constantia holds tasks, but Guya is not a task manager. Guya reads active tasks for context and proposes new ones. Telos assigns and grades. The system tracks Daniel's growth, not sprints.
- **Not always-on.** Guya exists in a Claude Code session. Telos will run as a standalone agent on a Mac Mini with its own tick cycle. They share memory via Constantia but operate independently.
- **Not a generic agent framework.** Guya is Daniel-specific. It has Daniel's name, Daniel's teddy bear, Daniel's growth areas. It is not designed to be installed by anyone else or configured for a different user.

---

## How to Use This Document

When adding a feature, proposing a change, or debating architecture:

1. Run the **decision filter** for each relevant belief — fast yes/no gates.
2. Does the change serve the identity in the first section, or does it make Guya more like a generic tool?
3. Check the **violation examples** — if the proposal looks like one, that's the answer.

Beliefs change over time. When they do, update this file with a dated entry explaining why. Drift without a recorded reason is how identity gets lost.
