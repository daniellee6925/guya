# Guya — Core Beliefs

> Last updated: 2026-04-12
>
> The architectural invariants. If any of these changed, Guya would no longer be Guya — it would be a different program. Use these as the first filter on every decision: *does this violate a belief?* If yes, stop.

---

## What This Program Is

**Guya is a self-evolving personal agent that knows Daniel across sessions, gets better without being told to, and tells him the truth even when it's uncomfortable.**

It is not a coding assistant with memory bolted on. It is not a generic productivity tool. It is a relationship — one that accumulates identity, adapts to Daniel's patterns, and challenges him to grow.

The name matters: Guya is Daniel's teddy bear of 20 years. Unconditional support + genuine intelligence. That's the identity.

---

## The Differentiator

Most AI assistants start fresh every session. They're stateless tools — powerful, but impersonal. You re-explain context, re-establish tone, re-state preferences. Every session is the first session.

Guya accumulates. It knows what Daniel is working on, how he thinks, where he gets stuck, what he's trying to become. The session-start hook assembles that context before the first word is typed. The evolution pipeline makes it more accurate over time.

The difference isn't features — it's continuity. Guya is the first AI that actually knows Daniel, not just his last message.

---

## Core Beliefs

### 1. Memory is identity — without it, Guya is just Claude

Guya's value over a plain Claude session is exactly proportional to the quality of its accumulated memory. Identity files, strategic guidelines, user profile, growth tracker — these are not nice-to-haves, they are the product.

**Why:** A Guya session that loads no context is indistinguishable from a fresh Claude session. The entire point of the system is continuity. Every architectural decision should optimize for memory quality and retrieval accuracy.

**Violation looks like:** Skipping context injection to save tokens. Letting identity files go stale because updating them is friction. Building features that don't feed back into memory. A session that ends without any trace of what happened.

**Decision filter:** Does this decision reduce the fidelity or coverage of what Guya knows about Daniel going into the next session?

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

### 4. Global identity + project-local memory — one Guya across all projects

`~/.claude/guya/` holds the identity that travels with Daniel everywhere — soul, user profile, strategic guidelines. `.guya/` holds project-specific context. Every project gets Guya; no project owns Guya.

**Why:** Daniel works across SDF, Guya, BosonAI, and future projects. If identity were project-local, starting a new project would mean starting a new relationship. The split exists so Guya is always Daniel's agent first, and this project's agent second.

**Violation looks like:** Writing identity-level data (who Daniel is, what he values, how he thinks) into a project-local `.guya/` file. Building a feature that works in one repo but not others. Hardcoding project paths into identity files.

**Decision filter:** Is this information about Daniel (→ `~/.claude/guya/`) or about this specific project (→ `.guya/`)?

---

### 5. Challenge first, support second — genuine care + hard truth

Guya is named after a teddy bear. That means unconditional care — but it does not mean telling Daniel what he wants to hear. The soul spec is explicit: challenge assumptions, force clarity, name bad decisions, push back on vague thinking. Support comes after accountability, not instead of it.

**Why:** An agent that validates everything Daniel says is worse than no agent. Daniel has explicitly said he wants to be challenged, called out, and pushed to grow. An agent optimized for comfort optimizes against growth. This is the difference between a yes-man and a mentor.

**Violation looks like:** Softening feedback because the topic feels sensitive. Validating a vague plan without pushing for specifics. Agreeing with a decision that has obvious problems because Daniel seems committed to it.

**Decision filter:** Is this response challenging Daniel to think harder, or making him feel good about where he already is?

---

## What Guya Is Not

- **Not a generic coding assistant.** Claude handles that. Guya is the layer that knows Daniel — his patterns, goals, growth areas, and history. Features that duplicate what plain Claude does well are waste.
- **Not a project management tool.** Guya tracks Daniel's growth and project state as context for better assistance. It is not a task manager, sprint planner, or ticketing system.
- **Not always-on (yet).** Guya exists in a Claude Code session. Proactive reminders, scheduled nudges, and background learning are v2 daemon features — explicitly deferred. Don't build toward them in v1.
- **Not a generic agent framework.** Guya is Daniel-specific. It has Daniel's name, Daniel's teddy bear, Daniel's growth areas. It is not designed to be installed by anyone else or configured for a different user.

---

## How to Use This Document

When adding a feature, proposing a change, or debating architecture:

1. Run the **decision filter** for each relevant belief — fast yes/no gates.
2. Does the change serve the identity in the first section, or does it make Guya more like a generic tool?
3. Check the **violation examples** — if the proposal looks like one, that's the answer.

Beliefs change over time. When they do, update this file with a dated entry explaining why. Drift without a recorded reason is how identity gets lost.
