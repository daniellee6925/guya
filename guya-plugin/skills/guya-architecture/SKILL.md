---
name: guya-architecture
description: Find architectural friction and propose DEEPENING opportunities — turning shallow modules (interface nearly as complex as the implementation) into deep ones (a lot of behaviour behind a small interface), for testability and AI-navigability. Walks the codebase, presents candidates as a visual before/after HTML report, then grills the chosen one and optionally designs its interface via parallel sub-agents. Use when Daniel wants to improve architecture, find where modules are shallow / tightly coupled / hard to test, consolidate code that forces bouncing between many small files, or asks "where's the architectural friction here". This is FIND-AND-DESIGN, not execute — it hands the chosen refactor to guya-decision-refactor. NOT for hunting bugs (guya-decision-bugfix), report-only perf/simplification (guya-optimize), reviewing a diff (guya-review), or whole-program direction/identity (guya-distinguished-engineer).
---

# Architecture — Deepening Opportunities

Surface architectural friction and propose **deepenings** — refactors that turn shallow modules into deep ones. The aim is concrete: **testability** (you can verify behaviour through one interface) and **AI-navigability** (an agent or a human can understand a concept without bouncing across ten files).

This is a *thinking lens*, not a linter. You're not counting lines or flagging style — you're asking "where is this codebase paying interface cost without buying leverage?"

## The lens — learn it before you walk

Three ideas do all the work. Internalise them; the rest is mechanics.

- **Depth = leverage behind a small interface.** A module is **deep** when a lot of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation. Shallow modules cost you twice: you pay to learn the interface *and* you don't get much for it.
- **The deletion test.** Imagine deleting the module. If complexity *vanishes*, it was a pass-through — it was never earning its keep. If complexity *reappears, scattered across N callers*, the module was concentrating something real. "Reappears scattered" is the signal you're hunting.
- **The interface is the test surface.** Callers and tests cross the same seam. If you find yourself wanting to test *past* an interface (reaching into internals, querying the DB directly instead of through the module), the module is the wrong shape.

Use the vocabulary in **[LANGUAGE.md](LANGUAGE.md)** *exactly* — module, interface, implementation, depth, seam, adapter, leverage, locality. Consistency is the point; drifting into "component / service / boundary / wrapper" defeats it. Read it before Phase 1.

## Marker Management (MANDATORY — before Phase 1)

Create `.guya/decisions/` if needed and write `.guya/decisions/.harness-active`:

    {"type": "architecture", "started_at": "<current ISO8601 timestamp>"}

The grilling loop is a back-and-forth — this stops Guya's UserPromptSubmit hooks from misreading Daniel's design answers as work commands (decision-gate), context reloads (intent-detect), or behavioural corrections (correction-detect). Remove it (`rm .guya/decisions/.harness-active`) when the review is done, when Daniel aborts, or on irrecoverable failure. Auto-expires after 2 hours.

## Before you walk — load the ground truth

1. **The CLAUDE.md ADR table** + **ARCHITECTURE.md Decision Log.** Guya records architectural decisions as a numbered ADR table inside `CLAUDE.md` (not `docs/adr/`). **ADRs are decisions you must not re-litigate** — if a "shallowness" is actually a documented trade-off, don't suggest reversing it unless the friction is real enough to reopen the ADR (and then say so explicitly).
2. **`context/core-beliefs.md`** (if present) — a deepening that violates a core belief (e.g. collapsing a plugin boundary the belief protects) is a non-starter; know the beliefs before you propose.
3. **Module names.** This project has **no domain glossary** — so name modules as the *code* names them (match `CLAUDE.md` / `ARCHITECTURE.md` / `STATUS.md`). Don't invent domain nouns; "the OrderHandler" only if that's what it's called.

---

## Phase 1 — Explore

Spawn the **Explore** subagent (`Agent` tool, `subagent_type=Explore`) to walk the codebase. Don't run a rigid checklist — explore organically and note where *you* feel friction. The honest signals:

- Understanding one concept requires bouncing between many small modules.
- A module is **shallow** — its interface is nearly as complex as its implementation.
- Pure functions were extracted *only* for testability, but the real bugs hide in how they're wired together (no **locality** — the complexity moved, it didn't concentrate).
- Tightly-coupled modules **leak** across their seams (module A reaches into B's internals).
- A part of the system is untested or hard to test *through its current interface*.

Apply the **deletion test** to anything you suspect is shallow. "Yes, deleting it scatters complexity across callers" is the candidate you want. "Deleting it changes nothing" means it's a pass-through worth collapsing for a different reason (noise removal, not deepening).

## Phase 2 — Present candidates as an HTML report

Write a **self-contained HTML file** to the OS temp dir so nothing lands in the repo. Resolve from `$TMPDIR` (fall back to `/tmp`, or `%TEMP%` on Windows); write `<tmpdir>/architecture-review-<timestamp>.html`. Open it (`open` on macOS, `xdg-open` on Linux, `start` on Windows) and tell Daniel the absolute path.

The diagrams carry the weight. Each candidate is a card with a **before/after visualisation** of the shallowness collapsing into depth, plus sparse prose in glossary terms:

- **Files** involved · **Problem** (one sentence) · **Solution** (one sentence) · **Wins** (bullets in `locality`/`leverage` terms) · **Before/After diagram** · **Recommendation strength** badge (`Strong` / `Worth exploring` / `Speculative`).
- **ADR conflict?** If a candidate contradicts an ADR in the CLAUDE.md table, only surface it when the friction genuinely warrants reopening that ADR — mark it in an amber callout: *"contradicts ADR-0NN — but worth reopening because…"*. Don't list every refactor an ADR forbids.

End with a **Top recommendation** card — which one you'd tackle first and why.

Full scaffold, diagram patterns, and style rules: **[HTML-REPORT.md](HTML-REPORT.md)**. Use [LANGUAGE.md](LANGUAGE.md) vocabulary throughout — concision is not licence to drift into non-glossary words.

**Do NOT propose interfaces yet.** After the file is written, ask: *"Which of these would you like to explore?"*

## Phase 3 — Grilling loop

Once Daniel picks a candidate, drop into a grilling conversation — challenge-first, one thread at a time. Walk the design tree with him: the constraints, the dependencies (and which **category** they fall in — see [DEEPENING.md](DEEPENING.md)), the shape of the deepened module, what sits behind the seam, which tests survive the change and which become waste.

Side effects happen *inline* as decisions crystallise — don't batch them:

- **Daniel rejects the candidate with a load-bearing reason?** Offer to record it as an ADR so a future architecture pass doesn't re-suggest the same thing: *"Want me to capture this as an ADR (`/guya-scribe arch: …`) so this doesn't come back up?"* Only offer when the reason is durable and non-obvious — skip "not worth it right now" and self-evident rejections.
- **Want to explore alternative interfaces for the deepened module?** Use the parallel sub-agent pattern in **[INTERFACE-DESIGN.md](INTERFACE-DESIGN.md)** ("Design It Twice" — your first interface is rarely the best).
- **Ready to execute the chosen deepening?** This skill *designs*; it does not restructure code. Hand off to **`/guya-decision-refactor`** — that harness owns the behaviour-preservation contract, the regression strategy, and the actual change. Pass it the deepened-module design as the target.

## Agent integration at a glance

- `Agent subagent_type=Explore` — Phase 1, walk the codebase.
- Parallel `Agent` subagents — [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md), generate radically different interfaces.
- `/guya-decision-refactor` — execute the chosen deepening (behaviour-preserving).
- `/guya-scribe arch: …` — record a rejected candidate as an ADR so it doesn't recur.
