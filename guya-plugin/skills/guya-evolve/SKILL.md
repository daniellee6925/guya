---
name: guya-evolve
description: Synthesize self-edit proposals from recent reflections, walk Daniel through approval, apply approved changes to ~/.claude/guya/, and run the consolidator if stale. The single entry point for Guya's self-evolution. Use when Daniel says "evolve", "update yourself", "process reflections", or "self-edit". Trigger proactively when SessionStart shows a reflection backlog nudge.
---

# Evolve

Guya's self-edit workflow. Reads recent reflections, asks Sonnet to synthesize proposals, presents them to Daniel for review, applies the approved ones, and ends by running the consolidator if guideline hygiene is overdue. Manual invocation only — never auto-fired.

## Why this exists

Reflections used to be write-only journal entries. Nothing in the evolution loop ever read them. This skill closes the loop: reflections become the actual training data for Guya's self-edits, with Daniel as the gate.

The workflow is deliberate by design. Reflections are written deliberately (via `/guya-reflect`), so their consumption should be deliberate too. Auto-firing this on session-end would invite silent rot — the same failure class that killed the old auto-pipeline for 6 days when an API key died unnoticed.

## Step 1 — Synthesize

Run the synthesis function against the project's reflections directory and the global identity state. The function lives at `guya-plugin/hooks/reflection-synthesis.mjs` and is callable from a node one-shot.

Use the Bash tool to run:

```bash
cd /Users/daniel/Desktop/guya/guya-plugin && node -e "
import('@anthropic-ai/sdk').then(({ default: Anthropic }) => {
  return import('./hooks/reflection-synthesis.mjs').then(({ synthesizeFromReflections }) => {
    const fs = require('fs');
    const env = fs.readFileSync('/Users/daniel/.claude/guya/.env', 'utf-8');
    const apiKey = env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim();
    const client = new Anthropic({ apiKey });
    return synthesizeFromReflections({
      client,
      reflectionsDir: process.env.REFLECTIONS_DIR,
      pluginRoot: process.cwd(),
      maxReflections: 5,
    });
  });
}).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Pass `REFLECTIONS_DIR` as the project's reflections path (use `git rev-parse --show-toplevel` then append `.guya/memory/reflections` if invoked from a guya-enabled repo, otherwise default to `/Users/daniel/Desktop/guya/.guya/memory/reflections`).

The result has three streams:
- `guidelineEdits[]` — low-blast operating heuristics
- `userProfileAdditions[]` — additive Daniel-facts
- `identityProposals[]` — high-blast soul/identity edits (already filtered to ≥2 source reflections)

If the synthesizer returns `null` or all empty arrays, report that to Daniel and stop. There's nothing to apply.

## Step 2 — Present and review

Show Daniel the proposals **grouped by stream**, with my honest take on each. Daniel said earlier in a related session: don't just dump 15 items in a table — give a recommendation per item so the review is fast.

For each stream, format like this:

```
## Guideline edits (8 proposed)

1. [workflow] Always pwd before git operations
   Sources: 2026-04-10-manual.md, 2026-04-10-manual-2.md
   My take: KEEP — recent failure mode, very specific

2. [workflow] Read source first before rewriting from memory
   Sources: 2026-04-10-manual-3.md, 2026-04-09-manual.md
   My take: KEEP — recurring pattern

... (continue for each)

Apply all? [a] / Select which to apply [s] / Reject all [r]
```

Then for user additions:

```
## User profile additions (4 proposed)

1. [How He Thinks] Explain-first becoming a default move
   Sources: 2026-04-10-manual.md, 2026-04-09-manual.md
   My take: KEEP — solidifying habit

... (continue)

Apply all? [a] / Select which to apply [s] / Reject all [r]
```

Identity proposals get **per-item review** because the blast radius is high:

```
## Identity proposal 1/1 — growth-tracker.md

Description: Update growth tracker grades through Apr 10 sessions
Sources: 4 reflections (Apr 9-10)

Diff:
   --- a/growth-tracker.md
   +++ b/growth-tracker.md
   @@ Convergence discipline:
   -**Convergence discipline**: C+ — the #1 weakness...
   +**Convergence discipline**: B- — explain-first now default...
   ...

Rationale: Three manual reflections from Apr 10 all independently update...

[k] Keep / [r] Reject / [e] Edit before applying
```

## Step 3 — Apply approved low-blast items

Once Daniel responds with approvals for guidelines and user additions, apply them via the apply-synthesis-result module. Use the Bash tool:

```bash
node -e "
import('./hooks/apply-synthesis-result.mjs').then(({ applyGuidelineEdits, applyUserProfileAdditions }) => {
  const approvedGuidelines = [/* paste approved guideline objects from synthesis result */];
  const approvedAdditions = [/* paste approved user addition objects */];
  const r1 = applyGuidelineEdits(approvedGuidelines);
  const r2 = applyUserProfileAdditions(approvedAdditions);
  console.log(JSON.stringify({ guidelines: r1, user: r2 }, null, 2));
});
"
```

The functions:
- Write each approved item to `~/.claude/guya/guidelines/strategic/` or `~/.claude/guya/user.md`
- Commit each stream as a single git commit with a descriptive message
- Return `{ written, errors, commit }` for each stream — surface errors to Daniel before proceeding

## Step 4 — Apply approved identity proposals (per-item, with diff)

For each identity proposal Daniel kept:

1. Use the **Read tool** to read the target file (e.g., `~/.claude/guya/growth-tracker.md`)
2. Use the **Edit tool** to apply the change. Don't trust the synthesizer's diff to apply mechanically — read the target, find the section the diff modifies, make the edit yourself
3. Verify the edit is correct by re-reading the changed section
4. Commit the change via commit-identity:

```bash
node -e "
import('./hooks/commit-identity.mjs').then(({ commitIdentityChange }) => {
  const r = commitIdentityChange({
    message: 'evolve(identity): <one-line description>\n\nApproved via /guya-evolve. Sources: <reflection list>.\n\nRationale: <from synthesizer>',
    files: ['<target file>'],
  });
  console.log(JSON.stringify(r));
});
"
```

One commit per identity proposal — they're high blast radius and deserve discrete history entries.

## Step 5 — Update last-evolved marker

After all approved changes are applied (including 0 if Daniel rejected everything), touch the timestamp:

```bash
node -e "
import('./hooks/apply-synthesis-result.mjs').then(({ touchLastEvolved }) => {
  touchLastEvolved(undefined, {
    guidelinesApplied: <count>,
    userAdditionsApplied: <count>,
    identityProposalsApplied: <count>,
    rejected: <count>,
  });
});
"
```

This is what feeds the SessionStart backlog nudge. Without it, the nudge never resets.

## Step 6 — Run consolidator if stale

Check `~/.claude/guya/.last-consolidated` (the file may not exist on first run). If it's missing OR older than 7 days, run the consolidator:

```bash
test -f ~/.claude/guya/.last-consolidated && \
  test $(( ($(date +%s) - $(date -r ~/.claude/guya/.last-consolidated +%s)) / 86400 )) -lt 7 && \
  echo "FRESH" || echo "STALE"
```

If STALE, prefer the `evolve_consolidate` MCP tool. If unavailable, spawn `guya:guya-consolidator` (Opus) with the current strategic guidelines as input. The consolidator merges duplicates, prunes stale low-confidence rules, and re-ranks by `(confidence × recency_weight)`.

After consolidation, update the marker:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > ~/.claude/guya/.last-consolidated
```

## Step 7 — Report to Daniel

Final summary:

```
✅ Evolved.
- Guidelines: X applied, Y rejected
- User profile: X additions applied
- Identity: X proposals applied (X rejected as premature/wrong)
- Consolidator: ran / skipped (still fresh)

Commits landed in ~/.claude/guya/:
  abc1234 evolve(guidelines): apply 8 approved edits
  def5678 evolve(user): apply 4 profile additions
  ...

Next session will see updated context.
```

## Rules

- **Never apply without explicit approval.** Even guideline-level edits get a confirmation keystroke. The skill is the gate.
- **Never silently fail.** If apply functions return errors, surface them to Daniel before continuing.
- **Always touch `.last-evolved`** at the end, even if zero items were applied — it resets the backlog nudge so Daniel doesn't see the same stale message next session.
- **Identity proposals get per-item review.** Don't batch them. Each one gets diff + rationale + individual approval.
- **Don't fabricate proposals.** If the synthesizer returns nothing, say so and stop. Empty output is a valid result.
