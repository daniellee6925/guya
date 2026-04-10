---
name: guya-skill-creator
description: Create new skills, improve existing skills, and measure skill performance. Use whenever Daniel wants to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark performance with variance analysis, or optimize a skill description for better triggering accuracy. Always use this skill when Daniel says "create a skill", "build a skill", "make a skill", "I want a skill that...", or "turn this into a skill".
---

# Guya Skill Creator

A skill for creating new Claude skills and iteratively improving them.

The process: understand intent → draft SKILL.md → test with real prompts (with-skill vs baseline) → evaluate with Daniel → improve → repeat → optionally optimize the description trigger.

Be flexible. If Daniel has a draft already, skip to testing. If he says "just vibe with me, no evals", do that instead.

---

## Marker Management (MANDATORY — before anything else)

Write `.guya/decisions/.harness-active`:

    {"type": "skill-creator", "started_at": "<ISO8601 timestamp>"}

Prevents hook interference (correction-detect, intent-detect, decision-gate) during the interview.

Remove when: skill saved, Daniel aborts, or unrecoverable failure.

---

## Phase 1: Capture Intent

**First:** scan the current conversation for an existing workflow. If Daniel said "turn this into a skill" or the session already has a clear pattern (tools used, steps taken, corrections made) — extract the intent from that. Ask Daniel to confirm before moving on, not to re-explain.

If starting fresh, ask these 4 questions (one at a time, probe vague answers):

1. What should this skill enable Claude to do?
2. When should it trigger? (what phrases, contexts, situations)
3. What's the expected output format?
4. Does this skill have objectively verifiable outputs (file transforms, data extraction, code gen, fixed workflow steps)? If yes, set up test cases. If outputs are subjective (writing style, design), skip evals. Suggest the right default but let Daniel decide.

### Research

After capturing intent, proactively ask about edge cases, input/output formats, example files, success criteria, dependencies. Check available MCPs — if useful for research, run in parallel via subagents. Come prepared so Daniel doesn't have to fill in everything.

---

## Phase 2: Write the SKILL.md

Fill in these components:

- **name**: lowercase, hyphens, no spaces
- **description**: The primary triggering mechanism. Include both what the skill does AND when to use it. Make it slightly pushy — Claude undertriggers by default, so lean toward "use this whenever X, even if they don't explicitly ask for Y."
- **compatibility**: required tools/deps (optional, rarely needed)
- **body**: the actual instructions

### Skill anatomy

```
skill-name/
├── SKILL.md (required)
└── (optional)
    ├── scripts/    — deterministic/repetitive scripts
    ├── references/ — docs loaded into context as needed
    └── assets/     — templates, icons, fonts
```

Keep SKILL.md under 500 lines. If approaching the limit, break into layered references with clear pointers.

### Writing style

- Use imperative form ("Read the file", "Spawn a subagent")
- Explain the *why* behind instructions — don't just say MUST, explain the reason
- Avoid rigid ALWAYS/NEVER when you can frame the reasoning instead
- Use theory of mind — write for a smart model, not a dumb rule-follower
- Write a draft, then read it with fresh eyes and improve

Save the skill draft before testing. Default path: `guya-plugin/skills/{skill-name}/SKILL.md`

---

## Phase 3: Test Cases

Come up with 2-3 realistic test prompts — the kind of thing Daniel would actually type. Share them: "Here are a few test cases I'd like to try. Do these look right, or do you want to add more?"

Save to `guya-plugin/skills/{skill-name}-workspace/evals/evals.json`:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's actual task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
```

Don't write assertions yet — just prompts. You'll draft assertions in Phase 4 while runs are in progress.

---

## Phase 4: Run and Evaluate

This is one continuous sequence. Don't stop partway.

### Step 1: Spawn all runs in the same turn

For each test case, spawn two subagents in the **same turn**:

**With-skill run:**
```
Task: <eval prompt>
Instructions: Read the SKILL.md at <path> and follow it to complete this task.
Save outputs to: <workspace>/iteration-1/eval-<ID>/with_skill/outputs/
```

**Baseline run** (no skill, same prompt):
```
Task: <eval prompt>
Save outputs to: <workspace>/iteration-1/eval-<ID>/without_skill/outputs/
```

Create `eval_metadata.json` for each test case:
```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name",
  "prompt": "the prompt",
  "assertions": []
}
```

### Step 2: Draft assertions while runs are in progress

Don't wait idly. While subagents run:
- Draft quantitative assertions for each test case
- Good assertions: objectively verifiable, clearly named
- For subjective outputs: skip assertions, rely on qualitative review
- Update `evals.json` with the `assertions` field

Explain the assertions to Daniel so he knows what to look for.

### Step 3: Capture timing data

When each subagent completes, capture timing from the task notification. Save to `timing.json` in the run directory:
```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

### Step 4: Grade and present results

Spawn a grader subagent using `agents/grader.md` (read it first for full instructions). Pass it:
- `expectations`: assertions from evals.json
- `transcript_path`: path to the run transcript
- `outputs_dir`: path to the run outputs directory

Do this for both with-skill and baseline runs. Then present results to Daniel:

For each test case, show:
- The prompt
- With-skill output summary
- Baseline output summary
- Assertion pass/fail
- Your qualitative read

Ask: "How does this look? What's wrong or missing?"

Empty feedback = looks good. Focus improvements on cases where Daniel had specific complaints.

After grading, do an analyst pass using `agents/analyzer.md` (read it for full instructions). Pass it the benchmark data and skill path. It surfaces patterns aggregate stats hide — non-discriminating assertions, flaky evals, time/token tradeoffs. Include its observations when presenting results to Daniel.

---

## Phase 5: Improve

This is the heart of the loop.

### How to think about improvements

1. **Generalize, don't overfit.** This skill will run a million times on prompts you've never seen. Don't make narrow fixes for the test examples — understand the underlying issue and fix the skill at that level.

2. **Keep the skill lean.** Remove things that aren't pulling their weight. Read the run transcripts (not just outputs) — if subagents wasted time on something unproductive, the skill might be causing it.

3. **Explain the why.** When you add an instruction, explain the reason. Smart models respond better to reasoning than rigid rules.

4. **Bundle repeated work.** If all 3 test runs wrote the same helper script, that's a signal — bundle it in `scripts/` and tell the skill to use it.

### Iteration loop

After improving:
1. Apply improvements to the skill
2. Rerun into `iteration-2/` (same structure, new baseline = original, or previous iteration if improving existing skill)
3. Present results to Daniel
4. Read feedback, improve again, repeat

Stop when: Daniel says happy, feedback is all empty, or you're not making meaningful progress.

---

## Phase 6: Description Optimization (optional)

After the skill is stable, offer to optimize the description for better triggering accuracy.

Generate 20 eval queries — mix of should-trigger and should-not-trigger. Format:
```json
[
  {"query": "concrete realistic user prompt with context and detail", "should_trigger": true},
  {"query": "near-miss prompt that shares keywords but needs something else", "should_trigger": false}
]
```

**Good queries**: specific, have context, realistic phrasing (casual, typos OK), edge cases, queries where this skill competes with another.

**Bad queries**: abstract ("create a chart"), too obvious ("write fibonacci function" as negative for PDF skill).

Save to `<workspace>/trigger-evals.json`. Share with Daniel for review before running.

Test each description candidate by running the queries and checking trigger rate. Try 3-5 description variants. Pick the one with the best combined should-trigger/should-not-trigger accuracy. Update the SKILL.md frontmatter.

Show Daniel before/after.

---

## Phase 7: Save and Deploy

1. Final skill at `guya-plugin/skills/{skill-name}/SKILL.md`
2. Copy to plugin cache: `~/.claude/plugins/cache/guya/guya/0.1.0/skills/{skill-name}/SKILL.md`
3. Remove `.guya/decisions/.harness-active`
4. Tell Daniel: "Saved. Restart Claude Code to pick it up. Invoke with `/guya:{skill-name}`."

---

## Agent Files

Read these when needed — don't load them all upfront:

- `agents/grader.md` — Evaluate assertions against execution transcripts and outputs
- `agents/analyzer.md` — Surface benchmark patterns and analyze why one version beat another

---

## Rules

- One question at a time during the interview.
- Push back on vague answers.
- If the skill tries to do 3 different things, suggest splitting.
- Don't invent steps Daniel didn't describe — but do suggest structural improvements.
- The test phase is not optional unless Daniel explicitly says to skip it.
- Skills over 500 lines need a references/ breakout.
