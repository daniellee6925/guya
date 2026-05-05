# Plan — Task priority field + ideas.md migration

> Drafted 2026-05-04. Implements ideas.md S3. Multi-repo change touching Constantia (validator, hooks, tasks), Telos (MCP server, tick-prompt), and Guya (ideas.md deletion, ADR).

---

## Schema

### `priority` field (new, required on tasks)

| Status | Priority enum | Set by |
|--------|---------------|--------|
| `proposed` | `T1` \| `T2` \| `T3` | Guya (or Telos when self-proposing) |
| `assigned`, `in-progress`, `complete`, `graded` | `P1` \| `P2` \| `P3` | Telos (set on accept, mutable on grade) |
| `rejected` | preserved as-was | n/a (never re-validated) |

Semantics:
- **T1 / P1** = next thing, displaces standing work
- **T2 / P2** = real work, no urgency floor
- **T3 / P3** = backburner, only when blocked on bigger items
- **No T0/P0** — emergency tier. If we hit one and can't escalate, add it then. YAGNI.

T → P at acceptance is **unbound**: Telos picks P fresh based on portfolio. T is a hint, not a contract.

### `pillar` field (extended)

Enum becomes `1 | 2 | 3 | none`. `none` = cross-cutting infra / process / non-growth work that still has to ship. At equal priority, pillar work wins over `pillar: none` (mitigates junk-drawer drift).

---

## Retrofill values (5 existing assigned tasks)

| ID | Proposed P | Why |
|----|-----------|-----|
| TASK-002 | P1 | Real prod hazard (stale-running rows can hang orchestrator) |
| TASK-005 | P1 | Security: prod DB password literal published in public repo |
| TASK-006 | P2 | Slice 5/6 browser smoke — validation, no incident |
| TASK-007 | P2 | Dev ergonomics (Next rewrite target configurable) |
| TASK-008 | P2 | Process improvement (stop per-commit review-evidence dance) |

Pillar stays `2` for all five (current values).

Daniel sanity-checks before commit.

---

## ideas.md migration (7 new proposed tasks)

| ideas.md item | New task | Status | Priority | Pillar |
|---------------|----------|--------|----------|--------|
| S3 (this work) | — | n/a | n/a | — (artifact = the implementation itself) |
| A1 (optimize in pre-commit) | TASK-010 | proposed | T2 | none |
| A2 (task lifecycle states) | TASK-011 | proposed | T2 | none |
| A3 (project-compact skill) | TASK-012 | proposed | T2 | none |
| B1 (poacher skill) | TASK-013 | proposed | T2 | none |
| B2 (Pillar 1 project) | TASK-014 | proposed | T2 | 1 |
| B3 (local UI) | TASK-015 | proposed | T3 | none |
| C1 (second-opinion skill) | TASK-016 | proposed | T3 | none |

After migration: delete `ideas.md`. Constantia tasks become single source of truth for backlog.

Notes:
- A1/A2/A3 collapse to T2 (down from "Tier A — next, fills real gaps"). Without urgency floor, none are "next thing displaces other work" — they're real-work-when-ready, which is T2 territory.
- B2 keeps `pillar: 1` because it's explicitly Daniel's pillar 1 (serving + inference) growth track.
- B1/B3 stay T2/T3 to honor "requires scoping" caveat.

---

## File-level changes

### Repo 1: Constantia (`/Users/daniel/Desktop/constantia`)

**A. `hooks/pre-commit` — validator update**

- Add `priority` to required task fields (line ~45)
- Add status-conditional priority enum check:
  - `proposed` → must match `^T[1-3]$`
  - `assigned|in-progress|complete|graded` → must match `^P[1-3]$`
  - `rejected` → no check
- Extend pillar regex from `^(1|2|3)$` to `^(1|2|3|none)$` (line 59)

**B. `hooks/post-commit` — manifest builder update**

- Add `Priority` column to task manifest header (line 15)
- Extract priority from each task file (line ~28)
- Sort rows: status priority (assigned > in-progress > complete > proposed > graded > rejected) → priority within status → ID
- Output row format: `| ID | Status | Priority | Pillar | Assigned | Assigned By | Purpose |`

**C. `tasks/TASK-002.md`, `TASK-005.md`, `TASK-006.md`, `TASK-007.md`, `TASK-008.md` — retrofill**

- Add `priority: P1` (or P2) line to frontmatter, after `pillar:`

**D. `tasks/TASK-010.md` … `TASK-016.md` — new (ideas.md migration)**

- Seven new files with `status: proposed`, `priority: T*`, `pillar: none|1`, `proposed_by: guya`, `assigned: ` empty, `assigned_by: ` empty
- Body = relevant section from ideas.md (preserve "What / Why / Effort / Done when" structure)

**Single Constantia commit:** validator + post-commit + retrofills + 7 new tasks. Atomic — schema and data ship together.

### Repo 2: Telos (`/Users/daniel/Desktop/telos`)

**A. `groups/telos/tools/mcp-server.ts`**

- `assignTask` (line 198–239):
  - Add `priority: 'P1' | 'P2' | 'P3'` to `AssignTaskArgs`
  - Validate: must be P1/P2/P3
  - Extend pillar validation: `[1, 2, 3, 'none'].includes(args.pillar)`
  - Write `priority` to frontmatter
- `acceptProposal` (line 304–364):
  - Add **required** `priority: 'P1' | 'P2' | 'P3'` to `AcceptProposalArgs`
  - Validate: must be P1/P2/P3
  - Extend pillar validation if `args.pillar` provided
  - Overwrite `priority` in frontmatter on accept (T → P conversion)
- Schema updates in tool registration (lines 623, 682) — add `priority` to inputSchema.

**B. `groups/telos/tick-prompt.md`**

- Section 1 "Ground": add "Note priority alongside status, pillar, age."
- Section 2 (a) `grade_task` for complete: "If multiple complete tasks await grading, pick highest P first."
- Section 2 (b) `accept_proposal`: "Triage proposals by T-priority first, then pillar gap. T → P conversion is unbound — pick P based on current portfolio, not the T value."
- Section 2 (b): add non-pillar branch — "For `pillar: none` proposals, the rubric criterion does not apply. Accept on: concrete artifact-verifiable acceptance, not a duplicate, makes sense given Daniel's stated priorities."
- Section 2 (d) `assign_task`: "At equal priority, pillar work wins over `pillar: none`."
- Section 2 notes: "When multiple priorities apply across action categories, action priority dominates (grade > accept > kill-stale > assign). Within a category, pick highest P/T."

**Single Telos commit:** MCP server + tick-prompt. The fork commit on `daniellee6925/nanoclaw` carries this — no upstream concern.

### Repo 3: Guya (`/Users/daniel/Desktop/guya`)

**A. `ideas.md` — delete**

After Constantia commit lands, delete the file. Constantia is now source of truth.

**B. `CLAUDE.md` — add ADR**

ADR 017: "Task priority field (T-tier proposals, P-tier committed) + pillar `none`." Reasoning: explicit ranking replaces inference; T/P split forces re-grade at accept boundary; `pillar: none` admits non-growth work without pretending it's pillar work.

**C. `STATUS.md` — record completion**

After all three commits land, scribe writes the milestone.

**Single Guya commit:** ideas.md deletion + CLAUDE.md ADR + STATUS.md update.

---

## Order of execution

1. **Constantia commit** — validator + post-commit + retrofills + 7 new tasks. Atomic.
2. **Telos commit** — MCP server + tick-prompt.
3. **Guya commit** — ideas.md deletion + ADR + STATUS.

Three commits, three repos, in order. Verification gates between each (see below).

## Verification gates

- After Constantia commit:
  - Manifest shows Priority column populated.
  - Validator rejects a synthetic task with `pillar: 4` and a synthetic task with `priority: P0`.
  - All 12 task files (5 retrofilled + 7 new) pass validation.
- After Telos commit:
  - `bun test` (or whatever tests exist) passes.
  - Smoke: synthesize an `accept_proposal` call without `priority` → must reject.
  - Smoke: synthesize `accept_proposal(priority: 'P1')` on a real proposed task → must succeed and write `priority: P1` to frontmatter.
- After Guya commit:
  - `ideas.md` no longer exists at repo root.
  - Pre-commit gate (review → deep-review) passes.
  - STATUS.md and CLAUDE.md updated.

## Risks / things to watch

- **Telos hasn't been pushed in a while?** Check fork sync state before editing `mcp-server.ts` — last touched 2026-04-23 per ADR 015 (commit `87d2c4a`). If there's a divergence with upstream, resolve first.
- **MCP server runs in container.** After Telos commit, the running daemon picks up new code only on container restart. Note this in handoff so Daniel restarts before next tick.
- **Existing `assign_task` calls without priority will break.** Telos's tick prompt is the only caller — updating it in the same commit closes that gap. No external callers.
- **Anti-rot watch.** If Telos starts ignoring priority field, this becomes ADR-011-style decoration. Tick-prompt rule must be load-bearing. After 2 weeks: spot-check whether Telos's `accept_proposal` calls actually vary `priority` across tasks. If they all default to P2, the field isn't doing work.

## What this does NOT include

- `set_task_priority` MCP tool for re-ranking mid-flight. Skipped per YAGNI.
- Auto-decay (P1 → P2 after N days). Skipped, no evidence yet that priorities go stale.
- Migration of `proposed_by` semantics. Stays as-is.
- `ideas.md` archival. Just deleted — git history preserves it.

## Rollback

If validator or MCP changes break things:
- `git revert` the Constantia commit (data + schema rollback together).
- `git revert` the Telos commit (MCP rollback).
- Restart Telos container to reload pre-change MCP server.
- ideas.md is reachable in git history if Guya commit needs to be reverted independently.

---

## Estimated effort

~2-3h focused work. Largest line-count: 7 new task files. Largest reasoning load: tick-prompt rule wording (must be unambiguous to a future Telos cold read).
