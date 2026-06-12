# Feature Decision — Task-origin provenance (`origin` field)

> 2026-06-12 · feature harness · status: building

## Q1 — Problem
`assign_task` hardcodes `assigned_by:'telos'` (`telos/shared/telos-tools/mcp-server.ts:106`), so a task Daniel prompted Telos to create and a task Telos surfaced autonomously are byte-identical in the record. This corrupts the direction-setting evidence — Telos's load-bearing claim about Daniel — by making him look directed-to when he's actually self-directing.

## Q2 — Why now
Surfaced this session: the "are you becoming senior" read leaned on "most recent tasks are Telos-assigned" as evidence of a direction-setting deficit. Daniel corrected it — he originated the work, Telos just recorded it. The measurement is wrong in the *flattering-to-the-deficit* direction, and it's the load-bearing input to Telos's whole purpose. Cheap to fix while the context is hot.

## Q3 — MVP
`origin` field on T-tasks. `assign_task` accepts it (default `daniel`); tick prompts set `origin:telos` explicitly; `accept_proposal` derives it from the proposal's `proposed_by`; Constantia pre-commit requires + enum-validates it; backfill live T-tasks.

## Q4 — NOT building
- Learn-tasks (L-*) — inherently curriculum/pillar-driven; separate measurement, separate validator. Out of scope.
- No task-mutation audit log / event history.
- No dashboard surface yet (the dashboard can read `origin` later).
- No re-grading, no proposal-flow rework beyond setting `origin`.
- `archive/**` untouched (validator skips it; append-only history frozen).

## Q5 — Done
1. `assign_task` writes `origin` (default `daniel`, enum `daniel|telos|guya`).
2. All Telos tick/planning prompts that call `assign_task` pass `origin:telos`.
3. `accept_proposal` task-spawn sets `origin: proposed_by`.
4. Constantia pre-commit `validate_task` requires `origin` + enum `daniel|telos|guya|unknown`.
5. Every live `tasks/tasks/T-*.md` has an `origin` (recent → ground truth, older → derived/unknown).
6. `bun test shared/telos-tools` green.
7. Deployed to Mini (git pull) + a task created with correct origin verified.

## Q6 — Touches
- telos: `mcp-server.ts` (`assignTask`, `acceptProposal` task-spawn, `assign_task` tool schema), tick prompts in `groups/telos/`.
- constantia: `hooks/pre-commit` (`validate_task`), `tasks/tasks/T-*.md` (backfill), MANIFEST regen (post-commit, auto).

## Q7 — Blast radius
HIGH. (a) A required schema field fails *every* task commit if existing files aren't backfilled → backfill is part of the same change, not a follow-up. (b) An `assign_task` signature change that breaks the autonomous tick stops task creation silently → keep `origin` optional in the tool (default applied server-side), never required at the call. (c) Live deployed mentor → deploy via pull + canary a real task.

## Q8 — Constraints
- telos-tools bind-mounted RO on the Mini → `git pull` deploys, no container rebuild; prompts read live.
- Mini deploy is push→pull (laptop edits are NOT auto-deployed — [[project_telos_prompt_deploy_path]]).
- Append-only sensitivity ([[feedback_append_only_migrations]]): backfill *adds* a field (enrichment), does not renumber or rewrite meaning; archive frozen.
- bun test suite must stay green.

## Q9 — Patterns
- Frontmatter is `Record<string,string|null>` → add a key, no type change. Insert `origin` right after `assigned_by` for stable ordering.
- Mirror existing provenance precedent: `proposed_by` (proposals), `added_by` (reminders, default `daniel`).
- Enum validation reuses the bash `require_enum` helper.

## Q10 — Testing
- Unit (bun): `assignTask` default→`daniel`; explicit `telos`/`guya`; invalid rejected; `acceptProposal` copies `proposed_by`→`origin`.
- Validator: a T-task missing `origin` fails; bad enum fails; valid passes (manual hook run on a fixture).
- Integration: create a real task on the Mini post-deploy, confirm `origin:daniel`; confirm a tick-created task would carry `origin:telos`.

## Forks resolved (Daniel, 2026-06-12)
- **Fork 1:** enum is `daniel | telos | guya`; `accept_proposal`-spawned tasks set `origin = proposed_by`.
- **Fork 2:** required field in schema; backfill enum adds `unknown`; recent (~2wk) → ground truth (all but T-019 = `daniel`), proposal-lineage tasks → `proposed_by`, older direct → `unknown`. Live tasks only; archive frozen.

## Backfill rule (precise)
For each `tasks/tasks/T-*.md`:
1. Has `proposed_from`/`proposed_by` → `origin = proposed_by` (documented, verifiable).
2. Else assigned within last ~2 weeks → `origin = daniel` (Daniel's ground truth).
3. Else → `origin = unknown` (don't fabricate).
Recent-window assignments shown to Daniel for confirmation before commit (he has ground truth; T-024-type proposal-lineage cases are the ambiguous ones).
