---
name: guya-decision-bugfix
description: Disciplined diagnosis-and-fix loop for bugs and performance regressions — build a deterministic feedback loop, reproduce, rank falsifiable hypotheses, instrument surgically, fix with a regression test, run a post-mortem. Use whenever Daniel reports a bug, says something is broken / throwing / failing / crashing / "returns the wrong thing", says "debug this", "diagnose this", "fix this bug", or describes a performance regression — even if he doesn't name the skill. This is the FIX path: it changes code to resolve the defect. NOT for reviewing code that already works (guya-review / guya-deep-review), restructuring with no bug present (guya-decision-refactor), or report-only performance analysis that proposes nothing (guya-optimize).
---

# Bugfix — Diagnosis & Fix Loop

A discipline for hard bugs and performance regressions. Skip phases only when you can say *why* out loud.

## The one idea that matters

**A bug is found the moment you have a fast, deterministic, agent-runnable pass/fail signal for it.** Everything after that — bisection, hypothesis-testing, instrumentation — just consumes that signal. Without one, no amount of staring at code will save you. So the center of gravity is Phase 1, not the fix. Spend disproportionate effort there.

This is the opposite of the reflex to start reading code and guessing. Guessing feels like progress and usually isn't. Teach yourself (and Daniel) to build the loop first.

## Marker Management (MANDATORY — before Phase 1)

Create `.guya/decisions/` if needed and write `.guya/decisions/.harness-active`:

    {"type": "bugfix", "started_at": "<current ISO8601 timestamp>"}

This tells Guya's UserPromptSubmit hooks that Daniel's answers during the hunt are *debugging input*, not work commands (decision-gate would block work verbs), context reloads (intent-detect would spam archival), or behavioral corrections (correction-detect would save "no, that's not it" as a fake guideline).

Remove the marker (`rm .guya/decisions/.harness-active`) when the bug is fixed and cleaned up, when Daniel aborts, or when a step fails irrecoverably. It auto-expires after 2 hours as a crash-recovery net.

## Before you hunt — load the ground truth

Two cheap reads that stop you from "fixing" something that was deliberate:

1. **The CLAUDE.md ADR table** + **ARCHITECTURE.md Decision Log** for the area you're touching. Guya records architectural decisions as a numbered ADR table inside `CLAUDE.md` (not `docs/adr/`). A "bug" is sometimes a documented trade-off — know before you revert it.
2. **`context/core-beliefs.md`** (if present). When you reach the fix, you'll check the patch doesn't violate a belief as a shortcut (e.g. breaking a plugin boundary to ship faster).

Use the project's own vocabulary for modules as you go — match the names in CLAUDE.md / STATUS.md, don't invent new ones.

---

## Phase 1 — Build a feedback loop

**This is the skill.** Be aggressive, be creative, refuse to give up. Build the right loop and the bug is 90% solved.

### Ways to construct one — try roughly in this order

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) — drives the UI, asserts on DOM / console / network.
5. **Replay a captured trace.** Save a real request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** A minimal subset of the system (one module, mocked deps) that hits the bug path in a single call.
7. **Property / fuzz loop.** For "sometimes wrong output", run 1000 random inputs and catch the failure mode.
8. **Bisection harness.** If it appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so `git bisect run` can drive it.
9. **Differential loop.** Run the same input through old-vs-new (or two configs) and diff outputs.
10. **HITL bash script.** Last resort, when a human must click. Drive *them* with a structured prompt script so the loop still exists and captured output feeds back to you.

### Treat the loop as a product

Once you have *a* loop, sharpen it:

- **Faster** — cache setup, skip unrelated init, narrow scope. A 2-second deterministic loop is a superpower; a 30-second flaky one is barely better than nothing.
- **Sharper signal** — assert on the *specific* symptom Daniel described, not "didn't crash".
- **More deterministic** — pin time, seed RNG, isolate the filesystem, freeze the network.

### Non-deterministic bugs

The goal isn't a clean repro, it's a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not — raise the rate until it is.

### Performance regressions

Logs are the wrong tool. Establish a **baseline measurement** (timing harness, `performance.now()`, profiler, query plan) as your loop, then bisect against it. Measure first, fix second.

### When you genuinely cannot build a loop

Stop. Say so explicitly, list what you tried, and ask Daniel for one of: (a) access to the environment that reproduces it, (b) a captured artifact (HAR, log dump, core dump, timestamped recording), or (c) permission to add temporary instrumentation. **Do not proceed to hypothesise without a loop** — that's guessing with extra steps.

Do not move to Phase 2 until you have a loop you believe in.

## Phase 2 — Reproduce

Run the loop. Watch the bug appear. Confirm:

- [ ] It produces the failure mode **Daniel** described — not a different one that happens to be nearby. Wrong bug → wrong fix.
- [ ] It reproduces across runs (or at a high-enough rate for non-deterministic bugs).
- [ ] You captured the exact symptom (error text, wrong output, timing) so later phases can prove the fix addressed *this*.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses before testing any of them.** Single-hypothesis thinking anchors on the first plausible idea and wastes hours.

Each must be **falsifiable** — state the prediction:

> "If X is the cause, then changing Y makes the bug disappear / changing Z makes it worse."

If you can't state the prediction, it's a vibe — sharpen or discard it.

**Show the ranked list to Daniel before testing.** He often re-ranks instantly ("we just deployed a change to #3") or has already ruled one out. Cheap checkpoint, big save. Don't block on it if he's away — proceed with your ranking.

**Murky root cause?** Spawn `guya:guya-debugger` — it returns competing hypotheses with evidence and blast radius. Use it when the ranked list feels like a coin-flip rather than a read.

## Phase 4 — Instrument

Each probe maps to a specific prediction from Phase 3. **Change one variable at a time.**

- **Debugger / REPL** if the env supports it — one breakpoint beats ten logs.
- **Targeted logs** only at the boundaries that distinguish hypotheses. Never "log everything and grep".
- **Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup later is then a single grep — untagged logs survive and rot; tagged logs die clean.

## Phase 5 — Fix

### First, name the fix shape — don't default to "root cause"

State the choice out loud:

- **Scoped patch** — the symptom is contained, the cause is understood, and a small change is genuinely the right call. Legitimate; say so.
- **Root-cause fix** — the patch would mask a defect that will resurface elsewhere. Fix the cause.
- **Refactor** — the bug exists *because* of the module's shape (tangled callers, no seam to test against). The structure is the bug.

Don't reflexively reach for the biggest hammer or the smallest — argue the choice from the evidence you now have.

Check the fix against the ADRs / core beliefs you read up front. If the fix violates one as a shortcut, surface it: *"this resolves the bug but breaks belief/ADR X — proceed or rethink?"*

### Regression test — before the fix, if a correct seam exists

A **correct seam** exercises the *real bug pattern as it occurs at the call site*. If the only available seam is too shallow (a single-caller unit test when the bug needs multiple callers; a test that can't replicate the triggering chain), a test there gives **false confidence** — worse than none.

**If no correct seam exists, that is itself the finding.** The architecture is preventing the bug from being locked down. Note it; it feeds Phase 6.

If a correct seam exists:

1. Turn the repro into a failing test at that seam. (Spawn `guya:guya-tester` to scaffold it if useful.)
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 loop against the original (un-minimised) scenario.

## Phase 6 — Cleanup + post-mortem

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop).
- [ ] Regression test passes (or the absence of a correct seam is documented).
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix).
- [ ] Throwaway harnesses deleted (or moved to a clearly-marked debug location).
- [ ] The winning hypothesis stated in the commit / PR message — so the next debugger learns.

Then two questions worth more than the fix:

- **Blast radius — where else does this pattern live?** The bug you fixed is rarely the only instance. Grep for the same shape across the codebase (same wrong cast, same `??`-vs-`||`, same missing await). A bug found once is a class found everywhere; a fix that lands one site and ignores three is half a fix. Surface the other sites even if you don't fix them this pass.
- **What would have prevented this?** If the answer is architectural — no good test seam, tangled callers, hidden coupling — recommend a follow-up via `/guya-decision-refactor` with the specifics. Make the recommendation *after* the fix is in: you know more now than when you started.

## Post-fix workflow

1. **Commit** — the pre-commit review gate fires automatically. Fix what it surfaces, then re-commit.
2. **Non-trivial fix** — run `/guya-deep-review` *before* committing to get ahead of issues rather than reacting.
3. Remove the `.harness-active` marker.

## Agent integration at a glance

- `guya:guya-debugger` — Phase 3, when root cause is genuinely murky (competing hypotheses + evidence + blast radius).
- `guya:guya-tester` — Phase 5, to scaffold the regression test at the correct seam.
- `/guya-decision-refactor` — Phase 6 handoff, when "what would have prevented this" is structural.
