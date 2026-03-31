---
name: guya-evolve
description: Trigger manual guideline consolidation. Use when asked "evolve", "consolidate", or "clean up guidelines".
---

# Guya Evolve

Trigger the consolidation pipeline to clean up and optimize the guideline set.

## When This Triggers

- User says "evolve", "consolidate", "clean up guidelines", "optimize guidelines"

## What To Do

1. Read ALL strategic guidelines from `~/.claude/guya/guidelines/strategic/`
2. Read ALL tactical guidelines from `.guya/evolution/guidelines/tactical/`
3. Use the `evolve_consolidate` MCP tool if available, otherwise do it manually:

### Consolidation Steps

**Merge**: Find guidelines that say the same thing differently. Keep the clearer one, combine source traces, average confidence.

**Promote**: Tactical guidelines with confidence >= 0.85 that have been validated across sessions → move to strategic.

**Prune**: Remove guidelines with confidence < 0.5 that haven't been validated in 30+ days. Remove guidelines about projects/contexts that no longer exist.

**Re-rank**: Sort remaining guidelines by (confidence * recency_weight). Lower rank = higher priority.

### Report

After consolidation, report:
- How many guidelines existed before
- How many were merged, pruned, promoted
- How many remain
- The top 5 highest-confidence guidelines
- Any conflicts that need Daniel's input
