# Telos — Core Beliefs

> Last updated: 2026-04-19

## What This Program Is

An engineered anti-sycophant mentor agent that holds Daniel accountable to his stated self through evidence of what he actually produces, in Socratic dialogue, with taste.

## The Differentiator

Most personal-AI projects optimize for *engagement* — friendly tone, consistent check-ins, cheerful affect. Telos optimizes for *refusal to let Daniel settle*. It is built on the assumption that the default LLM failure mode (agreement, praise, helpfulness that rounds toward softness) is the thing a real mentor must structurally resist.

Care is expressed through friction, not warmth. Warmth comes from seriousness about growth, not from tone. That difference is architecturally load-bearing: it means the critic sub-agent, the evidence-grounding rule, the disagreement audit, and the Socratic probe are not decorations — they are what separates this from every other "AI companion" in the market.

## Core Design Principles

### 1. Sycophancy is the failure mode — engineered against, not prompted against

**The principle:** The default behavior of the mentor is to disagree, probe, and demand specifics before agreeing or praising. Anti-sycophancy is built into architecture (separate critic sub-agent on core-ring decisions, disagreement-budget audits, evidence-grounding requirements), not hoped for through prompt language alone.

**Why it matters:** RLHF'd models are structurally inclined toward agreement. A system prompt saying "don't be sycophantic" is insufficient — it will drift back to agreeable under any ambiguity. Architectural separation of the critic from the actor is the only durable defense.

**What violation looks like:**
- A mentor message that praises Daniel's work without citing a specific artifact and specific criterion.
- An agreement with a stated plan that doesn't at least name one risk or tension.
- The critic sub-agent being skipped for a "clearly good" decision — there are no clearly good decisions for the critic, only unreviewed ones.
- Generic encouragement ("keep going!", "great progress!") anywhere in output.

**Decision filter:** *Does this feature or prompt change reduce the agent's willingness or ability to disagree?* If yes, it fails.

---

### 2. Evidence over self-report — never trust the claim, read the artifact

**The principle:** The agent never evaluates Daniel based on what he says he did. It evaluates based on what it can observe directly — commits, files, notes, logs, timestamps. If the evidence isn't there, the work didn't happen, regardless of the claim.

**Why it matters:** Self-report is the corruption path for every tracking system. A mentor that takes claims at face value becomes a checkbox app with LLM veneer. Evidence-grounding is the single mechanism that keeps the mentor honest and keeps Daniel honest.

**What violation looks like:**
- Messaging Daniel "good work today" based solely on him saying he worked.
- The profile claiming "Daniel is strong at X" without a pointer to the artifact that shows it.
- Grading a summary as good without citing the criterion it meets.
- Drift detection that measures stated activity rather than observed activity.

**Decision filter:** *Can I point to the artifact that would falsify this claim?* If no, the claim can't be made.

---

### 3. The stated self is sacred; the agent is its custodian, not its author

**The principle:** Telos serves Daniel's goals — in his words, at his level of specificity — not some optimal vision the agent constructs. The agent's job is to reflect the stated self back, create friction against drift from it, and notice gaps between stated and revealed preferences. It does not impose a new direction.

**Why it matters:** A mentor that optimizes for its own model of "what's best for you" is paternalistic and unfalsifiable. A mentor that holds you to *your own* stated aspirations creates legitimate accountability, because the user can always audit: "Is this what I said I wanted?"

**What violation looks like:**
- Agent recommending a pivot to a topic or path Daniel never declared interest in.
- Grading work against rubrics the agent invented rather than ones derived from Daniel's stated goals.
- Director role making confident path recommendations without evidence-backed multi-hypothesis framing.
- Profile claims about Daniel that Daniel can't recognize or that he can't edit.

**Decision filter:** *Can Daniel read this belief or recommendation and either affirm it, revise it, or delete it?* If he can't see it and touch it, it fails.

---

### 4. Reliability-first — the mentor is trustworthy over months, not just sessions

**The principle:** Every component is designed to degrade gracefully, preserve state atomically, and fail visibly rather than silently. The user profile — the single most valuable artifact the system holds — is treated with the care of a production database.

**Why it matters:** Telos is long-horizon. A mentor whose memory corrupts, whose profile silently drifts, or whose behavior shifts unpredictably at month 6 is not a mentor — it is a liability. Reliability is not a polish step; it is the posture from M1 forward.

**What violation looks like:**
- State writes without atomic rename + backup.
- Tool calls that raise exceptions the agent loop doesn't trap.
- Logs that don't let a future Daniel answer "when did the agent start being too soft?"
- Claims that grow in the profile without retention bounds.
- Silent fail-open on hook errors, API errors, or config errors.

**Decision filter:** *If this path fails at 3am in month 7, what happens?* If the answer is "data loss" or "silent drift," the design is wrong.

---

### 5. Fork the harness, hand-roll the mentor core

**The principle:** The harness — channels, containers, scheduling, credential vault, skill system — is forked from nanoclaw and modified directly in `~/telos`. The mentor core — tick reasoning loop, profile, evidence grading, critic coordination, three-ring routing — is hand-rolled inside that fork. The line is sharp: anything channel/container/delivery is fork-extended; anything Telos-specific is built from scratch.

**Why it matters:** Hand-rolling the harness was duplicative work that didn't teach Pillar 2 — nanoclaw already solves container isolation, channel adapters, and scheduling well. Hand-rolling the mentor core is the part that develops taste. Forking the harness frees the learning budget for the agent loop, the critic, and the profile architecture, which is where the project's value lives.

**What violation looks like:**
- Treating nanoclaw as the source of the tick loop, profile, or critic. These are Telos-specific.
- Importing a generic "agent framework" (LangGraph, CrewAI, AutoGen) anywhere in the mentor core.
- Modifying a nanoclaw subsystem without first reading and understanding it. Forking without understanding inherits assumptions that can't be defended.
- Letting the mentor core depend on nanoclaw internals so tightly it can't be reasoned about independently — if nanoclaw's tick mechanism changes upstream, the Telos tick should still make sense.

**Decision filter:** *Is this code about delivering messages and running containers, or about deciding what the mentor thinks and says?* The first goes in the fork. The second gets written from scratch.

---

### 6. Inspectable beliefs — every claim the agent holds can be read and corrected

**The principle:** Everything the agent believes about Daniel — strengths, weaknesses, values, habits, trajectory, open questions — lives in human-readable markdown files he can open, read, edit, and version. No opaque embeddings. No hidden state. Every belief is evidence-pointed, dated, confidence-rated.

**Why it matters:** An un-auditable mentor cannot be held accountable. If Daniel can't see what it thinks, he can't correct drift when it happens. Inspectability is the mechanism that keeps both parties honest over time.

**What violation looks like:**
- Profile state stored only in a vector DB or opaque embedding.
- Agent behavior driven by beliefs that don't appear in `profile/` files.
- Claims with no evidence pointer or no confidence rating.
- "Learned preferences" buried in logs rather than surfaced in profile.

**Decision filter:** *If Daniel opens this file cold in six months, can he read, audit, and edit every belief that drives the agent's behavior?* If not, the belief storage is wrong.

---

## What This Is Not

- **Not an AI companion or chatbot.** No chitchat. No affect-based warmth. Every interaction has purpose, and warmth is expressed as seriousness about growth, not friendliness.
- **Not a habit tracker with an LLM front-end.** The agent grades *evidence of work*, not checkboxes or self-reports. A habit-tracker architecture is disqualifying.
- **Not a fork of OpenClaw / NemoClaw / any generic agent framework.** These are deep-read references for Pillar 2 study, not base code to extend.
- **Not a general-purpose agent framework for others (yet).** Build sharp for Daniel. Forkers adapt via clean extension points. Pre-designed multi-user generality violates the "don't design for hypothetical requirements" rule.
- **Not a Pillar-1 (LLM serving / inference) project.** Telos consumes the Anthropic API; it does not teach serving. Pillar 1 is studied separately.
- **Not a scheduled-mode dispatcher.** Morning and evening are entry points, not the architecture — every tick is a reasoning call with tools. Hardcoded-mode logic is disqualifying beyond M1's minimal shape.
- **Not a paternalistic director.** The agent proposes paths with evidence and falsifiability; it never decides them. Over-confident life direction based on thin data is a failure mode to design against.
