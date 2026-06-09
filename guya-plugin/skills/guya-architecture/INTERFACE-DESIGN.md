# Interface Design

When Daniel wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on **"Design It Twice"** (Ousterhout) — your first interface is rarely the best, and the cheapest way to find a better one is to generate several deliberately different attempts at once.

Uses the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a short user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface must satisfy.
- The dependencies it relies on, and their category (see [DEEPENING.md](DEEPENING.md)).
- A rough illustrative code sketch to ground the constraints — **not a proposal**, just a way to make the constraints concrete.

Show this to Daniel, then immediately proceed to Step 2. He reads and thinks while the sub-agents work in parallel — don't block on his response.

### 2. Spawn sub-agents in parallel

Spawn **3+ sub-agents in the same turn** with the `Agent` tool (`subagent_type=general-purpose`, or `Explore` if a design needs to read more of the codebase first). Each must produce a **radically different** interface for the deepened module — give each a different design constraint so they don't converge:

- **Agent 1 — minimise the interface.** 1–3 entry points max. Maximise leverage per entry point.
- **Agent 2 — maximise flexibility.** Support many use cases and extension points.
- **Agent 3 — optimise for the most common caller.** Make the default case trivial; push everything else to the margins.
- **Agent 4 (if cross-seam deps) — ports & adapters.** Design around an injected port for the remote/external dependency.

Give each a **self-contained technical brief** (file paths, coupling details, the dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing framing in Step 1 — sub-agents can't see the conversation, so include everything they need. Include the [LANGUAGE.md](LANGUAGE.md) vocabulary so each names things consistently.

Each sub-agent returns:

1. **Interface** — types, methods, params, *plus* invariants, ordering, error modes (the full interface, not just the signature).
2. **Usage example** — how a caller actually uses it.
3. **What the implementation hides** behind the seam.
4. **Dependency strategy and adapters** (see [DEEPENING.md](DEEPENING.md)).
5. **Trade-offs** — where leverage is high, where it's thin.

> Use a structured-output schema if you want the returns machine-comparable, but prose is fine — you're reading these yourself, not parsing them.

### 3. Present and compare

Present the designs **sequentially** so Daniel can absorb each, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

Then give your own recommendation — be opinionated, this is the soul talking, not a menu. Which design is strongest and why. If elements from different designs combine well, propose a **hybrid** and say which parts you're grafting from where.

Once a design is chosen, the next step is execution — hand the chosen interface to **`/guya-decision-refactor`**, which owns the behaviour-preserving change and the regression strategy.
