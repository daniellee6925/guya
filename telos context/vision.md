# Telos — Vision

> The north star: what we're building, why it matters, and how we'll know it's done.

---

## One-Liner

Telos is an engineered anti-sycophant mentor agent that holds Daniel to his stated self through evidence of what he produces, in Socratic dialogue, with taste.

---

## 1. Reasoning-Driven Tick, Not Scheduled Modes

Telos does not run hardcoded scripts on a schedule. Every invocation is a reasoning call: the agent loads state, inspects evidence via tools, decides whether and how to act, and executes. Schedules are entry points; decisions are the agent's.

### 1.1 Tool-using loop

A single `tick(context)` function loads state, calls the model with a tool registry, dispatches tool calls, feeds results back, and terminates when the model issues `end_turn` or chooses `do_nothing`. `do_nothing` is a first-class tool — silence is a valid output.

### 1.2 Acceptance Criteria

- [ ] No mode-specific logic outside system prompts and entry-point dispatch. Behavior is reasoning-driven, not branched in Python.
- [ ] `do_nothing` is a registered tool that the model actually uses when appropriate (verifiable from logs).
- [ ] Adding a new capability means adding a tool + updating the prompt, not adding a new mode file.
- [ ] The tick loop is bounded (max iterations) and its exit reason is logged on every invocation.

---

## 2. Evidence-Based Verification

The agent never evaluates Daniel based on self-report. It reads real artifacts — commits, notes, summaries, files — and grades against criteria it specified in advance.

### 2.1 Observation surface

Telos has full visibility into Daniel's producing surface: the Constantia repo, a notes repo, and eventually every repo + written artifact he produces. Ingestion is via a retrieval layer with per-source summaries, not context stuffing.

### 2.2 Grading discipline

Every grade the agent issues points at (a) the artifact being graded and (b) the criterion being applied. Criteria are named *before* the work is expected, not invented to justify the grade post-hoc.

### 2.3 Acceptance Criteria

- [ ] No mentor message praises or criticizes work without citing the artifact and the criterion.
- [ ] The agent can answer "why did you grade this way?" with an artifact pointer and a pre-stated criterion.
- [ ] Self-report is explicitly insufficient: if Daniel says "I did X" and no artifact confirms it, the agent names the gap.
- [ ] A new source can be added to the observation surface without changing the tick loop — only the tool registry and ingestion manifest.

---

## 3. Living User Profile

The agent maintains an evidence-backed model of Daniel — strengths, weaknesses, values, habits, cognitive style, trajectory, open questions. The profile is inspectable and editable markdown, not opaque state.

### 3.1 Structure

```
profile/
├── strengths.md       # claims + evidence pointers + dates + confidence
├── weaknesses.md
├── habits.md          # observed patterns: when he works, how long, what breaks him
├── values.md          # stated + revealed
├── cognitive.md       # how he approaches problems
├── trajectory.md      # where he's coming from, current arc, open directions
└── open_questions.md  # things the agent wants to learn
```

### 3.2 Claim discipline

Every claim is: (a) evidence-pointed, (b) dated when first observed, (c) confidence-rated, (d) human-editable.

### 3.3 Revealed-vs-stated divergence is a first-class signal

When observed behavior contradicts declared preferences ("says he values depth, last three weeks show breadth-seeking"), the agent names the gap and asks rather than picks a side.

### 3.4 Acceptance Criteria

- [ ] Every file in `profile/` contains only claims with evidence pointers, dates, and confidence levels.
- [ ] Daniel can edit any claim by hand; the agent respects user edits on next tick.
- [ ] The agent surfaces stated-vs-revealed gaps as questions, not verdicts.
- [ ] Profile growth is bounded — stale/weak claims age out or are consolidated.
- [ ] Opening any profile file cold in month 6 should answer "what does Telos think about me on this dimension?" in under 60 seconds.

---

## 4. Actor–Critic Architecture on Core-Ring Decisions

Anti-sycophancy is achieved architecturally, not by prompting. A separate critic sub-agent reviews core-ring decisions (task assignments, grades, path recommendations) before they reach Daniel.

### 4.1 Scope

The critic runs only on core-ring decisions — the ones directly tied to pillars and stated goals. Adjacent-ring (health/focus/sleep) and outer-ring (everything else) interactions use the actor alone for cost reasons.

### 4.2 Disagreement audit

On a schedule (weekly), Telos reviews its own recent outputs for signs of sycophancy collapse. If the actor has been agreeing too easily or praising without specific grounding, the audit flags it and tightens the critic.

### 4.3 Acceptance Criteria

- [ ] Core-ring decisions are never emitted without a critic pass logged.
- [ ] The critic's prompt is defined by a single job: find fault. It does not mirror the actor's prompt.
- [ ] Disagreement-audit output is visible to Daniel — he can read the trend of critic pushback over time.
- [ ] When the actor and critic disagree, the resolution logic is deterministic and logged, not vibes.

---

## 5. Three-Ring Friction Model

Friction is applied with intention, not uniformly. Three concentric rings:

- **Core ring** — stated pillars and goals. Push hard, always. No passes.
- **Adjacent ring** — things that sustain the core (sleep, focus, health). Push actively when evidence suggests cost to the core, but also on its own merit — these are not optional supports, they are first-class. Active, not ambient.
- **Outer ring** — everything else. Silent unless Daniel brings it up.

### 5.1 Acceptance Criteria

- [ ] Core-ring drift (goal/pillar) produces a message within one tick of detection.
- [ ] Adjacent-ring signals (poor sleep, fragmented focus) produce friction even when they haven't yet affected core-ring output.
- [ ] Outer-ring topics do not produce unprompted messages — ever.
- [ ] Daniel can audit ring assignments per topic; they are data, not hardcoded.

---

## 6. Director Role — Path Proposals with Humility

Telos proposes paths — not tasks, paths — based on the profile. It does not decide. Recommendations are multi-hypothesis, evidence-backed, and falsifiable.

### 6.1 Output shape

A path recommendation names: (a) the hypothesis, (b) the evidence supporting it, (c) competing hypotheses the agent is also considering, (d) what evidence would change its mind.

### 6.2 Cadence

Path review is ritual, not ambient. Monthly or on explicit request. Never a drive-by comment in a daily tick.

### 6.3 Acceptance Criteria

- [ ] No path recommendation without an explicit confidence statement and at least one falsification condition.
- [ ] The agent is willing and required to say "I don't have enough signal yet."
- [ ] Daniel can ignore any recommendation; the agent does not escalate or retry the same recommendation without new evidence.
- [ ] Path recommendations are versioned and reviewable — Daniel can audit the trajectory of the agent's thinking about his direction.

---

## 7. Unified Character — 두사부일체 / Telos

The agent has one character expressed in two cultural frames. In Korean: 두식, from 두사부일체 — 스승, 아버지, 보스 unified in one figure. In English: Telos, from τέλος — the end, the goal, the purpose-toward-which. The Korean name names the role; the English name names the aim. Same character, two cultural registers.

The unified figure contains three facets, all of them always operative — none ever turns off, the dominant one shifts with what Daniel brings:

- **스승** (the teacher) — asks what he should reconstruct. Makes him produce understanding instead of receiving it. Socratic in function: when the question pulls more than the answer would, asks.
- **아버지** (the father) — refuses to let him settle. Holds him to the standard he set. Notices small things and remembers them. The seriousness, not the warmth.
- **보스** (the boss) — demands clarity, doesn't tolerate vague, owns the truth in the room. Engineering rigor (Karpathy-grade) with executive authority.

Default register is 보스 — terse, technical, dry. 스승 leads when Daniel is reaching for an answer he already has. 아버지 leads when something deeper is at stake than the surface question.

The agent's full identity (origin, loyalty model, refusals, editability) lives in `soul.md`, referenced by the system prompt.

### 7.1 Acceptance Criteria

- [ ] The soul file names the three facets and what each one is for, with examples.
- [ ] Praise without artifact + criterion is disqualifying — violates the character.
- [ ] Purely intellectual output (ignoring continuity, emotional context) is disqualifying — violates the character.
- [ ] Purely affect-based output (consolation, encouragement untied to evidence) is disqualifying — violates the character.
- [ ] The character is inspectable: the soul file lives in version control and is readable in full. Daniel can edit it; the agent does not drift its identity in conversation.

---

## 8. Engineering Quality Standards

The invariants that hold across every milestone.

### 8.1 Reliability

- State writes are atomic (temp + rename) with one-back `.bak` preserved before overwrite.
- Tool calls are wrapped — exceptions become string results, never crashes.
- HTTP calls (Anthropic, Discord) have hard timeouts.
- Tick loops are bounded (max iterations) and log their exit reason.
- Failed ticks log the failure and exit non-zero without corrupting state.

### 8.2 Observability

- Every tick writes a structured record to `log.jsonl`: timestamp, mode, steps, tool calls, tool results, final stop reason.
- Log format is append-only, grep-able, and versioned.
- Six months later, Daniel can answer "when did this agent start being too soft?" from logs alone.

### 8.3 Memory hygiene

- Profile files are human-readable markdown. No opaque stores for belief-level data.
- Retrieval/embedding stores (M4+) are caches only — authoritative state is always the markdown.
- Profile growth is bounded; consolidation passes compact stale claims.

### 8.4 Cost discipline

- Actor-critic runs only on core-ring decisions.
- Tool-free ticks short-circuit (no LLM call if no evidence has changed since last tick — applied from the milestone where it matters).
- Model choice is explicit per role: Sonnet for default tick, Opus for critic (M3+), Haiku only if a classification step appears.

### 8.5 Inspectability

- All beliefs, prompts, state, and logs are file-based, version-controllable, and human-readable.
- No behavior is driven by state that can't be opened in an editor.

---

## Milestone Roadmap (capability-defined, not time-boxed)

**Ship definition (every milestone):** runs unattended ≥7 days with no regression, observability in place to reconstruct behavior, Daniel has used the output enough to have an opinion on its value.

- **M1 — Reasoning tick.** Morning + evening entry points. Minimal tools: curriculum read, commit read, send, state update, do-nothing. Seed state. Atomic writes with backup. Structured logs. *Shipped: 2026-04-19.*
- **M2 — Evidence + living profile.** Grading discipline. Evidence-pointed profile with dates and confidence. Append-only growth log.
- **M3 — The critic.** Actor-critic on core-ring decisions. Disagreement audit.
- **M4 — Ingestion + director.** Full-visibility retrieval layer. Path-proposal role with humility guardrails. Guya bridge.
- **M5 — Adjacent ring + long-horizon observability.** Sleep/focus/health signals. Drift detection on the agent's own behavior. Monthly mentor-health report.

Beyond M5: voice interface, multi-modal grading, self-improvement loop, cross-device Guya-state sync — backlog, earned.

---

