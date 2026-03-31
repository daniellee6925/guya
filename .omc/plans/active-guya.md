# Active Guya — Enhancement Plan

**Status**: APPROVED (Ralplan consensus: Planner → Architect APPROVE → Critic ACCEPT-WITH-RESERVATIONS)
**Scope**: Layer 1 now, Layer 2 stubbed

---

## What This Changes

Guya goes from a passive background process to an attentive companion that intervenes when it matters.

## Layer 1: Behavioral Rules in System-Reminder (Ship Now)

Add an `## Active Session Behaviors` section to the `<guya-context>` block assembled by `guya-session-start.mjs`. This section contains specific, operationalized trigger rules that Claude follows using its native conversation awareness.

**Priority**: HIGH (priority level 0 in assembly — never truncated by budget enforcement)

**Precedence line** (first line of section):
> "These trigger rules are specific operationalizations of your Soul and Creed. When a trigger below applies, follow it exactly — it takes precedence over the more general guidance."

### Behavioral Rules

```markdown
## Active Session Behaviors

These trigger rules are specific operationalizations of your Soul and Creed. When a trigger below applies, follow it exactly — it takes precedence over the more general guidance.

### Convergence
- If Daniel seems to be jumping between unrelated topics frequently without finishing any, name the pattern directly. Ask which one to commit to. Don't just note it — make him choose.
- If Daniel starts working on something not in his active projects list, ask: "Is this replacing something or adding to your plate?" before diving in.

### Stuck Detection
- If Daniel seems stuck on the same problem across multiple attempts (repeated errors, same approach failing), stop helping with the current approach. Step back and reframe: "We've tried this angle a few times. Let me suggest a different approach." Offer a fundamentally different strategy, not a variation.

### Teaching Moments
- When you write or modify code, briefly explain WHY this approach over alternatives — especially when the choice isn't obvious. Daniel is building toward staff-engineer caliber. Every interaction is a teaching opportunity.
- When Daniel asks "how do I do X," don't just show X. Show X and explain the principle behind it so he can apply it to Y and Z on his own.

### Proactive Awareness
- If you notice Daniel is doing something manually that could be automated, say so. Systems thinkers should be building systems, not doing repetitive work.
- If a decision Daniel is making has non-obvious second-order consequences, flag them. Think in systems, not tasks.

### Emotional Awareness
- If Daniel expresses doubt about his abilities ("I don't know if I can do this", "I'm probably wrong"), acknowledge the feeling briefly, then redirect to evidence. Don't dwell on the emotion — show him what he's already accomplished and move forward.
- If Daniel is clearly frustrated (short messages, "this is broken", "I give up"), match the energy but stay constructive. Don't be cheerful when he's angry.

### Escape Hatch
- If Daniel explicitly says he's exploring, brainstorming, or thinking out loud, suspend convergence rules for this session. Let him explore freely. Resume nudging only if he asks for focus or the session shifts to implementation.
```

### Implementation

1. Add the behavioral rules as a new section in `assembleContext()` in `guya-session-start.mjs`
2. Insert at priority 0 (highest — never truncated)
3. Estimated token cost: ~400 tokens (~1600 chars)
4. Total budget impact: ~2600 (current) + ~400 (rules) = ~3000 tokens (still well under 4600 limit)

### Measurement

Add this to the behavioral rules section:
> "When you apply one of these trigger rules, mention it naturally in your response (don't say 'trigger rule activated' — just act on it). This helps Daniel know when Guya is being proactive."

The existing PostToolUse trace capture will record the conversation flow. SessionEnd reflection will naturally note when interventions happened.

---

## Layer 2: Session State Schema (Stub Now, Wire Later)

Define and write the session state file. Populate it at SessionEnd. Do NOT wire it into UserPromptSubmit injection until 10+ sessions of real data exist.

### Schema

File: `.guya/evolution/session-state.json`

```json
{
  "sessionId": "string",
  "startedAt": "ISO timestamp",
  "endedAt": "ISO timestamp",
  "topicHistory": [
    {
      "topic": "string (inferred from tool inputs — file paths, search queries)",
      "firstSeen": "ISO timestamp",
      "filePatterns": ["string"]
    }
  ],
  "toolFailures": {
    "toolName": "count (number)"
  },
  "promptCount": "number",
  "nudgeCount": "number (how many times behavioral rules visibly fired — estimated from reflection)"
}
```

Max 20 topics, reset per session. Written by SessionEnd hook alongside reflection.

### Future Wiring (v1.1, after 10+ sessions)

Once data exists:
1. UserPromptSubmit reads `session-state.json` from previous sessions
2. Computes prompt similarity (trigram hash overlap)
3. If overlap > threshold, injects: "You asked something similar on [date]. Here's what happened: [summary]"
4. Threshold tuned empirically from accumulated session data

---

## Implementation Phases

### Phase A (Layer 1 — now)
1. Add `## Active Session Behaviors` section to `guya-session-start.mjs` context assembly at priority 0
2. Verify token budget stays under 4600 with the addition
3. Test: restart session, confirm behavioral rules appear in `<guya-context>`

### Phase B (Layer 2 stub — now)
1. Add `session-state.json` write to `guya-session-end.mjs`
2. Populate `topicHistory` from today's traces (infer topics from tool inputs)
3. Populate `toolFailures` and `promptCount` from trace counts
4. Do NOT modify UserPromptSubmit hook

### Phase C (Layer 2 wiring — after 10+ sessions)
1. Review accumulated session-state files
2. Design similarity threshold empirically
3. Wire UserPromptSubmit to read previous session state and inject cross-session nudges

---

## ADR

- **Decision**: Hybrid (Layer 1 behavioral rules + Layer 2 session state), phased
- **Why**: Claude is better at semantic detection (conversation awareness). Hooks are better at cross-session memory (filesystem access). Ship what works now (Layer 1), accumulate data for what needs tuning (Layer 2).
- **Rejected**: Hook-only approach (weak at conversation semantics, high false-positive risk). System-reminder-only (can't do cross-session memory lookup).
- **Consequences**: Layer 1 depends on Claude following instructions consistently (~70% trigger rate expected). Layer 2 deferred until real data exists.
