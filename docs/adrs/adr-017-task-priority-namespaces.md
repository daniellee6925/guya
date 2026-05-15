# ADR-017: Task `priority` field — split namespaces + `pillar: none` for cross-cutting work

**Status:** Accepted
**Date:** 2026-05-04

## Decision

Required `priority` field on tasks with status-conditional enum:
- `proposed` → T1, T2, T3 (Guya's hint)
- `assigned`, `in-progress`, `complete`, `graded` → P1, P2, P3 (Telos's stamp)
- `rejected` preserved as-was

T → P at acceptance is unbound — Telos picks P fresh against portfolio, T is a hint not a contract.

`pillar` enum extended to `1|2|3|none` for cross-cutting infra/process work; pillar work wins at equal priority.

`assign_task` and `accept_proposal` MCP tools now require `priority` arg. Tick-prompt rewritten: action priority dominates (grade > accept > kill-stale > assign > nothing); within a category, highest P/T wins.

## Why

The validator forced `pillar: 1|2|3` and tick-prompt required rubric-anchorage on every accept; non-growth infra/security/process work had no clean home and accumulated as friction (5 assigned tasks were all pillar-tagged but only loosely so). Adding `priority` makes urgency explicit instead of inferred from prose.

Splitting T/P prefixes prevents lazy carry-over at the accept boundary — Telos must re-grade priority based on current portfolio rather than blindly inheriting Guya's hint. T → P is therefore unbound (proposal's T value is informational, not contractual).

`pillar: none` admits cross-cutting work explicitly rather than pretending it's pillar work; at equal priority, pillar work still wins in Telos's queue (mitigates junk-drawer drift).

Constantia is now single source of truth for backlog — `ideas.md` deleted at Guya repo root; 7 entries migrated to Constantia tasks TASK-010..016 as `status: proposed`.

## Anti-rot watches

2-week spot check that Telos's accepts actually vary `priority` across tasks; if all default to P2, the field is decoration.

## Commits

- Constantia `bd0359e` (schema), fix-up `5f8a261` (9 task retrofills + 7 new tasks from `ideas.md`)
- Telos fork `ca38dac` (priority-aware MCP tools + tick-prompt)
