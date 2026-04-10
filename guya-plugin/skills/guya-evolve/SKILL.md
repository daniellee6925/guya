---
name: guya-evolve
description: Trigger manual guideline consolidation — merge duplicates, promote validated tactics to strategy, prune stale or low-confidence rules, and re-rank by confidence and recency. Use when asked to "evolve", "consolidate", or "clean up guidelines". Trigger proactively when the guideline set feels noisy or contradictory.
---

# Evolve

Manual consolidation of Guya's guideline set. Without consolidation, the guideline set accumulates duplicates, stale rules, and contradictions — signal decays into noise. Run this to keep the set sharp.

## Step 1 — Load Guidelines

Read in parallel:
- `~/.claude/guya/guidelines/strategic/` — all strategic guidelines
- `.guya/evolution/guidelines/tactical/` — all tactical guidelines

## Step 2 — Consolidate

Prefer the `evolve_consolidate` MCP tool if available — it runs the full pipeline automatically. If unavailable, spawn `guya:guya-consolidator` (opus) with the loaded guidelines. If neither is available, run manually using the four operations below.

### Merge

Duplicate guidelines dilute confidence scores and create false contradictions. Find guidelines that say the same thing differently. Keep the clearer one, combine source traces, average confidence scores.

### Promote

Tactical guidelines that have been validated across multiple sessions should graduate to strategic — they're no longer project-specific observations, they're durable behavioral principles. Promote tactical guidelines with confidence ≥ 0.85 that have been validated across sessions.

### Prune

Stale low-confidence guidelines add noise without adding signal. Remove:
- Guidelines with confidence < 0.5 not validated in 30+ days
- Guidelines about projects, contexts, or patterns that no longer exist

### Re-rank

Sort remaining guidelines by `(confidence × recency_weight)`. Lower rank = higher priority in context injection. This ensures the most validated and recent guidelines surface first.

## Step 3 — Report

After consolidation, report to Daniel:
- Guidelines before → after (how many merged, pruned, promoted)
- Top 5 highest-confidence guidelines (these are the ones shaping behavior most)
- Any conflicts that need Daniel's input — don't resolve these automatically, surface them

If there are conflicts, ask Daniel to resolve them before closing out.
