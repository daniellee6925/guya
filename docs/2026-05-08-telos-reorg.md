# Telos Reorg — May 2026 Design

**Status**: Design locked, implementation pending. Open threads at bottom.

**Author**: Daniel + Guya, session 2026-05-07/08.

**Supersedes**: ADR-017 (T/P priority prefix) — the prefix scheme is dropped; namespace = directory.

---

## Why

Daniel surfaced five blockers preventing effective use of Telos:

1. **Legacy task accumulation.** `constantia/tasks/` had ~9 files across stale lifecycles, hindering session-start context.
2. **Single task namespace.** Conflated proposals, work, learning, and reminders into one flat list with one validator.
3. **Sparse tick cadence.** Twice-daily (9am morning + ~11pm reflection) too sparse for active engagement.
4. **Pillar 1 project undefined.** Parked pending Daniel↔Telos discussion.
5. **Single Telos chat.** Mixed work, learning, and life conversations into one DB / one prompt — tone leakage and mental context-switching impossible.

This document resolves 1, 2, 3, 5. Item 4 deferred.

---

## Decisions Locked

### 1. Task namespace split

Four categories under `constantia/tasks/`, each its own subdirectory:

```
tasks/
  archive/2026-05-07/    # legacy migration target
  proposals/             # T-### — recommendations needing accept/reject
  tasks/                 # P-### — committed work
  learn/
    curricula/           # durable structured plans (bytebytego, ddia-deep)
    L-###.md             # curriculum-paced learning tasks
  reminders/             # R-### — scheduled fires (one-shot or cron)
  MANIFEST.md            # one file, four sections
```

**Schema:**
- **Priority** on `proposals`, `tasks`, `learn` only (not reminders): plain numeric `1|2|3` (1 = highest). Validator forces explicit re-grade at proposal acceptance (no auto-carry).
- **Pillar** on the same three categories: `1 | 2 | 3 | none`.
- **Proposal target** required: `target: task | learn | curriculum`. Acceptance spawns the right artifact in the right dir.
- T/P prefix split from ADR-017 dropped — directory IS the namespace, IDs are single-letter (T/P/L/R) per dir.

**Lifecycles per dir** (validator enforces):
- `proposals`: `proposed → accepted | rejected`
- `tasks`: `assigned → in-progress → complete → graded` (+ `blocked`, `abandoned`)
- `learn`: same as tasks
- `reminders`: `pending → fired → archived` (one-shot), `active → paused | retired` (recurring)

**MANIFEST**: one `tasks/MANIFEST.md` with four sections (Tasks, Learn, Proposals, Reminders). Post-commit hook walks all four dirs and rewrites sections. Session-start hook reads this file at priority 0.

### 2. Curricula as durable artifacts

`tasks/learn/curricula/` holds long-form structured plans (e.g., the existing `bytebytego_course_plan.md`, future `ddia-deep.md`). L-tasks reference `curriculum` + `module` by id; do not duplicate content.

**Authorship**: either Daniel+Guya (in session) or Telos (via T-proposal with `target: curriculum`). Promotion to `curricula/` only after Daniel accepts the proposal.

### 3. Three Telos sessions

Existing nanoclaw session → `work` (preserves 144-message history). `learn` and `life` spin up fresh.

```
/workspace/extra/telos-session/
  work/      inbound.db, outbound.db, CLAUDE.local.md, cron schedule
  learn/     same shape, mentor/Socratic addendum
  life/      same shape, friend-tone addendum
```

All three share Constantia (`evidence/`, `profile/`, `goals/`, `tasks/`) for cross-chat memory. Tone separation enforced via per-session CLAUDE.local.md addendum (content open thread).

**Failure isolation**: each session DB independent. Corrupting one doesn't affect the others. Privacy preserved (life DB never travels with work DB).

### 4. Reminder firing infrastructure

Launchd agent on mini (`com.guya.reminder-fire.plist`) runs `check_reminders.sh` every minute. Script:

1. Reads `tasks/reminders/R-*.md` (single source of truth).
2. Evaluates `schedule.type` (`once` with `at`, or `cron` with `expr`) against `last_fired`.
3. For each due reminder: inserts a message into `life/inbound.db` (`Reminder due: <title>`), updates `last_fired` in the R file.

**Why this beats nanoclaw's own cron table**: avoids drift between cron rows and R files. Pause/retire/delete = file edit only. Same anti-rot pattern as ADR-013 (single source of truth + dumb cron > two state stores in sync).

### 5. Per-chat tick rhythm

13 ticks/day total:

| Chat | Times |
|------|-------|
| work | 9am, 1pm, 9pm |
| learn | 10am, 1pm, 4pm, 7pm, 10pm |
| life | 10am, 12pm, 6pm, 8pm, 11pm |

ADR-015's separate 11pm `write_reflection` cron stays — closeout (operational wrap) and reflection (8-section synthesis from transcripts) have different purposes; collapsing risks both becoming worse.

### 6. Tick prompts (locked)

#### WORK

```
WORK 9am — morning brief
─────────────────────────
Read tasks/MANIFEST.md (Tasks + Proposals sections).

1. Today's top P-tasks (priority 1 + in-progress). Cap at 3.
   If overload, name it and ask Daniel to pick.
2. Open T-proposals needing accept/reject. Quick rec per item.
3. Evidence candidates from yesterday's closeout — auto-promote
   per Step 0 rule. Skip if Daniel already promoted.
4. Today's intent in one sentence: "if I win today, what's true tonight?"
5. One blocker or dependency that could derail the day, if any.

Format: short. Sections only if needed.
```

```
WORK 1pm — midday checkin
─────────────────────────
1. Progress vs 9am intent. What's done? What's stuck?
2. Tasks transitioned to complete since morning → flag for grading.
3. New T-proposals or surprises since morning.
4. Course-correction worth flagging (pivot, deprio, escalate).

Format: 4-6 lines, no fluff.
```

```
WORK 9pm — closeout
───────────────────
1. Today's wins vs intent. Brief honest read.
2. Promote evidence_candidates → evidence_recorded (Step 0).
   Use write_evidence with strict calibration — don't inflate.
3. Capture decisions or non-obvious learnings as evidence.
4. Carry-over: P-tasks rolling to tomorrow. Flag P1s that
   haven't moved in 48h — that's a stuck signal.
5. Ask Daniel: any tasks to prioritize or assign for tomorrow?
   Capture his response → propose new T-tasks or update P-priority.
6. Reflection paragraph: what worked, what didn't, change for tomorrow.
```

#### LEARN

```
LEARN 10am — morning brief
──────────────────────────
1. Active L-tasks (curriculum + module + due). Today's micro-goal.
2. Time-block suggestion. Flag overdue / stuck (5+ days no progress).
3. Recommend one paper for today's read. (WebSearch scoped to
   active L-tasks + pillars to avoid trending-slop.)
4. Surface AI news / trends worth tracking today.
```

```
LEARN 1pm — recall + article + nudge
─────────────────────────────────────
1. Ask: what stuck from morning's paper / news? Record.
2. Recommend a 10-min article for the day.
3. Have you blocked time for today's L-task yet? If no, suggest a slot.
```

```
LEARN 4pm — midpoint
────────────────────
1. Any progress on today's L-task yet?
2. If stuck: what's blocking? (energy, time, comprehension?)
3. If progressing: anything surprising or hard so far?
```

```
LEARN 7pm — recall + capture
────────────────────────────
1. Ask: what have you learned today? Record.
2. If yes: capture before fade — 3-5 sentences in L-task body.
3. If no: name why. 3+ skipped days = call it out, not soft-pedal.
```

```
LEARN 10pm — video + grade + close
──────────────────────────────────
1. Recommend a 10-15min YouTube video to watch.
2. If watched: 1-2 quick takeaways recorded.
3. If L-task success criteria met: grade it. Read writeup,
   knowledge-check question if needed, write_evidence.
4. If in-progress: progress note. Tomorrow's L-task plan.
```

#### LIFE

```
LIFE 10am — morning brief + Audrey
──────────────────────────────────
1. Anything outside work today worth flagging?
   (Audrey, errands, social)
2. How are you actually feeling this morning?
3. Reminders coming up today (read upcoming R-### fires).
4. Have you messaged Audrey yet today?
```

```
LIFE 12pm — body check + Audrey
───────────────────────────────
1. Eaten? Hydrated?
2. Posture / breaks / movement.
3. Have you messaged Audrey?
```

```
LIFE 6pm — transition + Audrey
──────────────────────────────
1. Out of work mode yet?
2. What's the rest of the evening look like?
3. Have you messaged Audrey today / this afternoon?
```

```
LIFE 8pm — workout check
────────────────────────
1. Did you work out today? If no, why?
2. Anything weighing on you that's not work?
```

```
LIFE 11pm — closeout + sleep
────────────────────────────
1. How was today, honest?
2. Anything weighing on you that'll keep you up?
3. One thing you're grateful for today.
4. Time to sleep. Lights/screens off, bedtime now.
```

### 7. Web tools for Telos

Telos gets `WebSearch` and `WebFetch` to source paper/article/video/news recommendations. Implementation requires nanoclaw config update (Telos fork). Sharp prompt scoping (reference active L-tasks + pillars) required to avoid recommending trending-slop.

### 8. Legacy migration

Archive everything currently in `constantia/tasks/T-*.md` and `P-*.md` into `tasks/archive/2026-05-07/` with `status: archived`. New IDs start at 1 in each new dir. Evidence file links to old IDs preserved (audit trail).

### 9. L-task body shape

Writeups live INLINE in the L-task file as append-only daily subsections, plus a final writeup section on completion:

```markdown
---
id: L-001
curriculum: bytebytego-systems
module: 5
priority: 2
pillar: 1
success: walk through thundering herd + 2 mitigations
by: 2026-05-14
---

## Notes

### 2026-05-08
- Watched Redis 101 + Why Redis is Fast
- Surprised that ...

### 2026-05-09
- Started persistence docs ...

## Final writeup (on completion)
[Daniel's 3-5 sentence synthesis]
```

### 10. L-task grading

At 10pm LEARN tick, if `success` criteria met, Telos asks 1-2 open knowledge-check questions tied to the success field. Daniel answers free-text. Telos scores against criteria, writes evidence with calibration `{strength | habit | tentative}`.

No self-assessment, no async-only quality scoring — live Q&A is what catches passive recognition vs active recall.

### 11. Per-chat CLAUDE.local.md addenda

Each session gets its own addendum, injected into the system-prompt addendum per ADR-014. Addenda enforce per-chat tone, role, constraints, and read-state.

- **work**: sharp/structured tone, adheres to Daniel's weekly schedule, proactively surfaces day's commitments. Reads: Tasks + Proposals + evidence/profile/pillars + weekly schedule.
- **learn**: Socratic mentor tone. Encodes /guya-learn methodology (layer concepts, analogies from Daniel's domains, force active recall, correct with precision, hard limits on jargon and "yeah I get it"). Reads: Learn section + curricula + L-task notes + evidence.
- **life**: 두식 (Doosik) persona, close-friend energy. Korean default (반말), English fallback when Daniel initiates. No write_evidence, no grading. Notice patterns gently. Reads: Reminders section + R-tasks + profile (relationship + health only).

Full addendum text in the implementation spec (TBD).

### 12. Weekly schedule location

`constantia/goals/weekly-schedule.md` — Daniel-maintained. Two sections: recurring weekly blocks + current-week overrides. Work chat reads it for proactive day-surfacing.

---

## Open Threads (still to resolve before implementation)

1. **Companion ADR-018 entry in CLAUDE.md.** This doc is the source of truth; the ADR table needs an entry pointing here. ADR-017 marked superseded.
2. **Migration sequencing.** Order of operations across Constantia repo, nanoclaw fork, and mini host. Validator hook changes. Smoke-test plan. Rollback strategy.
3. **Pillar 1 project.** Parked pending Daniel↔Telos discussion.

---

## Implementation Plan (phased, all infra, no content)

Estimated 2-3 working sessions. Each phase reversible, ends with a smoke test, keeps existing work session functional throughout.

### Phase 0 — Prep (no changes yet)

- Snapshot: `git tag pre-reorg-2026-05-08` on Constantia, nanoclaw fork, mini's local nanoclaw checkout.
- Verify mini reachable. Capture current Telos process state, current `messages_in` rows, current cron entries.
- Confirm `guya/data/bytebytego_course_plan.md` content unchanged.
- Write rollback runbook (which commits to revert per phase, how to restart Telos).

**Gate**: snapshots exist, mini reachable, runbook in `docs/`.

### Phase 1 — Constantia schema (single atomic commit)

- Update Constantia `.git/hooks/pre-commit` validator with per-dir rules (proposals/tasks/learn/reminders/curricula/archive).
- Update Constantia `.git/hooks/post-commit` to walk all four new subdirs and rewrite MANIFEST sections.
- Create new dir structure (`proposals/`, `tasks/`, `learn/`, `learn/curricula/`, `reminders/`, `archive/2026-05-07/`).
- Move existing `T-*.md` and `P-*.md` to `archive/2026-05-07/` with `status: archived`.
- Move `guya/data/bytebytego_course_plan.md` → `constantia/learn/curricula/bytebytego-systems.md`.
- Create `constantia/goals/weekly-schedule.md` template (empty, populated next session).
- Rewrite `MANIFEST.md` with 4-section format.
- Single commit, deploy hook updates to mini (per ADR-016 — symlink hooks on both laptop AND mini).

**Smoke test**: valid R-test commit accepts; P-task missing pillar rejects; MANIFEST regenerates; mini's hook also enforces.

**Rollback**: revert commit, `pre-reorg-2026-05-08` tag restores prior state.

### Phase 2 — Telos MCP tools + work session update

- Update Telos MCP tools in nanoclaw fork:
  - `propose_task` writes `proposals/T-###` with `target` field
  - `accept_proposal` reads T-###, spawns the right artifact, archives the T with `status: accepted`
  - `assign_task` writes `tasks/P-###` with new fields
  - NEW: `assign_learn`, `add_reminder`, `grade_task`, `grade_learn`, `read_curriculum`
- Update existing work session's `CLAUDE.local.md` to the new draft.
- Update work session's nanoclaw cron table:
  - Remove old morning + evening crons
  - Add 9am, 1pm, 9pm crons with new prompts
  - Keep 11pm reflection cron unchanged
- Deploy fork commit to mini, restart work session container.

**Smoke test**: morning tick fires at next 9am with new prompt. Propose → accept → assign → grade → evidence works against new schema.

**Rollback**: revert fork commit, restart container with prior tools.

### Phase 3 — Learn session bootstrap

- Create `/workspace/extra/telos-session/learn/` on mini with empty `inbound.db` + `outbound.db`.
- Add learn session's nanoclaw container config (separate volumes, separate addendum mount).
- Drop in learn `CLAUDE.local.md` (Socratic mentor + /guya-learn methodology).
- Add WebSearch + WebFetch tools to learn session's nanoclaw tool config.
- Add 5 learn-tick crons (10am, 1pm, 4pm, 7pm, 10pm) with new prompts.
- Boot learn session container.

**Smoke test**: manual message to learn inbound → Telos responds Socratically. Manual 10am tick → fires with paper rec + AI news (web tools work). Knowledge-check Q surfaces against a synthetic L-task.

**Rollback**: stop learn container, remove cron entries. Work session unaffected.

### Phase 4 — Life session bootstrap

- Same shape as Phase 3 but for `life/`.
- Drop in life `CLAUDE.local.md` (Korean, 두식).
- Add 5 life-tick crons (10am, 12pm, 6pm, 8pm, 11pm).

**Smoke test**: message to life inbound → Telos responds in Korean as 두식, casual register. 10am tick surfaces upcoming reminders.

**Rollback**: stop life container, remove cron entries.

### Phase 5 — Reminder firing infra

- Write `scripts/check_reminders.sh` in Constantia (~50 LOC). Reads `tasks/reminders/R-*.md`, evaluates `schedule` + `last_fired`, inserts into `life/inbound.db` when due, updates `last_fired`.
- Write `~/Library/LaunchAgents/com.guya.reminder-fire.plist` on mini, runs script every minute.
- Create test R-tasks: one-shot at "now+90s" + recurring `* * * * *` (then immediately retire).

**Smoke test**: one-shot fires within 90s, message lands in life inbound, R-task archived. Recurring fires once, `last_fired` updates, idempotency check (doesn't refire same minute).

**Rollback**: `launchctl unload` plist, retire test reminders.

### Phase 6 — Validation + cutover

- 24-hour observation: all 13 ticks fire, no errors in any session DB.
- Day-2 review with Daniel: are work prompts surfacing right things? Is learn doing real teaching? Is life Korean working naturally? Are reminders firing?
- Add ADR-018 entry to `CLAUDE.md` pointing to this doc. Mark ADR-017 superseded.
- Update STATUS.md.
- Final commit.

**Gate**: 24h clean, Daniel sign-off.

### Risks

1. **Cron silently no-ops** (per ADR-013). Mitigation: each tick logs to a session-specific log file; smoke test verifies log entries.
2. **Validator silently accepts old format**. Mitigation: explicit reject test in Phase 1 smoke (intentionally bad commit must fail).
3. **MANIFEST hook walks wrong dir**. Mitigation: post-commit hook smoke asserts all 4 sections present after synthetic commit in each dir.
4. **Korean addendum ignored, life chat speaks English**. Mitigation: first life tick smoke asserts Korean output, fail loud if not.
5. **Web tools don't activate in learn chat**. Mitigation: 10am learn tick smoke asserts a paper URL was returned.
6. **Reminder script fails silently**. Mitigation: launchd log + script writes to `~/Library/Logs/guya-reminder-fire.log` on every run.

---

## Content Needed for Next Session (post-infra)

This implementation builds infrastructure only. Day 1 of the new system will feel empty — most directories start with no content, and ticks will surface empty MANIFEST sections until content is seeded. The next session's job is to author and populate the content listed below.

### A. Pillar 1 project decision (highest priority — currently parked)
- [ ] Define Pillar 1 project: name, scope, what "success" looks like in 1 month / 3 months
- [ ] Daniel ↔ Telos discussion to converge on the project
- [ ] Update `constantia/goals/pillars.md` with Pillar 1 details
- [ ] Refresh Pillars 2 and 3 if they need updating
- [ ] Define rubric for Pillar 1 progress (how does Telos grade work toward it?)

### B. Weekly schedule
- [ ] Populate `constantia/goals/weekly-schedule.md`:
  - Recurring blocks: work hours, deep work windows, meetings, gym, Audrey time, family contact, weekly planning
  - Current-week overrides (any non-recurring commitments)
- [ ] Decide: how often does this update? Tied to Sunday week-ahead tick? Manual?

### C. Reminders (R-tasks)
- [ ] Workout reminders (recurring, by your schedule — Mon/Wed/Fri 6pm? Or different cadence?)
- [ ] Audrey baseline check-ins (recurring) — though may be redundant with life-tick prompts
- [ ] Family check-ins (mom, dad, sister) — recurring weekly?
- [ ] Sleep prep nudge (recurring nightly, 11pm)
- [ ] Hydration / movement nudges (recurring, optional)
- [ ] Any current open commitments or one-shot upcoming events

### D. Initial L-tasks
- [ ] First bytebytego module assigned (Module 1 — How Computers Run Code, or skip ahead based on existing knowledge)
- [ ] If separate DDIA-deep curriculum: first DDIA chapter L-task
- [ ] Decide cadence: one module per week? Faster? Slower?

### E. Curricula expansion
- [ ] DDIA-deep curriculum if separate from bytebytego (or fold into bytebytego module reading lists)
- [ ] Any additional curricula: distributed systems papers, ML/AI papers track, Korean reading, others?
- [ ] Format authored by Daniel + Guya in session, or proposed by Telos via T-target=curriculum

### F. Profile updates (`constantia/profile/`)
- [ ] Audrey context: relationship history, what to know, sensitivities, communication patterns
- [ ] Family context: names, last contact patterns, anything Telos should track
- [ ] Current life pressures: career anxiety, health concerns, recurring tensions
- [ ] Daniel's "domains" list for web-tool rec scoping: SDF, BosonAI synthetic data, agentic systems, ML systems design, etc.
- [ ] News sources to track: specific Twitter accounts, blogs, newsletters, arxiv categories

### G. Goals review (`constantia/goals/`)
- [ ] `pillars.md` — confirm 3 pillars are still right or restructure
- [ ] Karpathy-target refresh (if separate file)
- [ ] Any new long-term goals to add (career, learning, life)

### H. Telos identity refresh
- [ ] Does Telos's core soul/identity need updating for three-chat split?
- [ ] Confirm Doosik persona inheritance from Telos identity is correct
- [ ] First-message rituals: kickoff message in each new chat to set tone
  - LEARN: introduce yourself as Daniel's learning companion, surface today's L-task or first L-task
  - LIFE: 두식 self-introduction in Korean, casual, set the friend energy

### I. Recurring meta-tasks beyond ticks
- [ ] Sunday week-ahead review (separate tick or fold into existing?)
- [ ] Monthly profile update (Telos synthesizes month's evidence into profile updates)
- [ ] Quarterly goals review (Daniel + Telos check pillar progress)
- [ ] Decide: cron-driven or human-triggered

### J. Validator regression coverage
- [ ] Add test cases in Constantia hooks for: every status transition, every priority/pillar combination, every proposal target type, every reminder schedule type
- [ ] Smoke that pre-commit fails on intentional violations
- [ ] Update `pre-commit-config.json` if needed

### K. Existing evidence + reflection cleanup
- [ ] Old evidence files reference old T-/P- IDs — decide: leave (audit trail), or annotate with "→ archived"
- [ ] Old reflection files reference old task IDs — same call

### L. Observability + anti-rot
- [ ] Log files exist for each session (`~/Library/Logs/telos-{work,learn,life}.log`)
- [ ] Daily smoke: did all 13 ticks fire? (Simple grep on logs)
- [ ] Weekly drift check: are R-tasks accumulating without firing? Are L-tasks getting graded? Are evidence files growing?
- [ ] Add check to `guya-status` skill that surfaces these health metrics

### M. Documentation
- [ ] ADR-018 entry in `CLAUDE.md` pointing to this design doc
- [ ] Mark ADR-017 superseded by ADR-018
- [ ] Update STATUS.md with cutover state
- [ ] Update `~/.claude/guya/` user.md if any new patterns emerge
- [ ] Update relevant `CLAUDE.md` files in Constantia + nanoclaw fork

### N. Onboarding rituals
- [ ] First message to LEARN inbound from Daniel: "이거 어떻게 시작해?" or "Let's start with module 1" — set initial state
- [ ] First message to LIFE inbound: Korean greeting to 두식, establish casual register
- [ ] Verify both sessions respond as expected before relying on them

---

## Append-only changelog

- 2026-05-08: Initial design locked. Decisions 1-8 captured.
- 2026-05-08: Decisions 9-12 added. L-task body + grading, per-chat addenda, weekly schedule location.
- 2026-05-08: Phased implementation plan added (Phases 0-6). Risks enumerated.
- 2026-05-08: Day-2 content checklist added (sections A-N). Plan stays pure-infra; content seeded next session.
- 2026-05-08: **Phase 0 complete.** Snapshots tagged at `pre-reorg-2026-05-08` across constantia (b5b6873), telos (2270de8), guya (7f11634), all converged on origin + mini. Pre-pull cleanup absorbed mini's in-flight telos edits (Step 0 evidence promotion + Discord splitting + ideas.md notes section) into commit 2270de8 on telos. Constantia rebased local commit (was 1 ahead) onto origin (was 6 ahead) + MANIFEST resync. Bytebytego SHA captured (227a8ea6...). Rollback runbook + pre-reorg state snapshot written.
- 2026-05-08: **Phase 1 complete** (constantia commit `cd6651a`, deployed to mini). New schema live: tasks/{proposals,tasks,learn,learn/curricula,reminders,archive/2026-05-07}; new pre-commit validator with per-dir rules + plain-numeric priority; new post-commit hook regenerates 4-section MANIFEST. 17 legacy TASK files archived. Bytebytego curriculum migrated byte-identical (SHA preserved). Rejection path smoke-tested. Origin auto-pushed. Mini fast-forwarded.
- 2026-05-08: **Phase 1 amendment** (constantia commit `536522b`). Reminder `schedule:` block flattened from nested YAML to flat fields (`schedule_type` + `schedule_expr`/`schedule_at`) so the existing flat frontmatter parser can read it without YAML deps. No live R-tasks existed — no data migration. guya-review + guya-deep-review clean.
- 2026-05-08: **Phase 2a complete** (telos commit `c0be63f`, pushed to origin; NOT yet deployed to mini — Phase 2c will build + restart). helpers.ts: 5 new dir constants + generic `nextId(dir, prefix)` + 5 thin wrappers (T/P/L/R/EVD). assignTask schema-migrated (numeric priority `1|2|3`, path `tasks/tasks/P-NNN.md`). gradeTask schema-migrated (outcome `rejected`→`abandoned`, field `rejection_reason`→`abandonment_reason`, pattern `P-NNN`). acceptProposal stubbed with explicit Phase 2b TODO error (semantics changed — needs target-field routing rewrite). guya-review caught: broad readdir catch (now ENOENT-only), unused PROPOSALS_DIR import (removed). guya-deep-review clean.
- 2026-05-08: **Phase 2b complete** (telos commit `26fe607`, pushed to origin; mini still on old dist — Phase 2c will build + restart). acceptProposal full rewrite for target-field routing: target=task spawns P-NNN, target=learn spawns L-NNN with curriculum existence check, target=curriculum writes proposal body verbatim to CURRICULA_DIR/<id>.md (no overwrite). T-NNN marked accepted with accepted_at + accepted_into (audit trail). 5 new tools: propose_task (writes T-NNN; for target=curriculum, body is raw curriculum content without `## Context` wrapper), assign_learn (direct L-NNN with curriculum check), add_reminder (R-NNN with flat schedule_type + schedule_at/expr fields), grade_learn (graded|abandoned for L-tasks), read_curriculum (read-only fetch). TOOLS schemas updated (assign_task, grade_task, accept_proposal) and 5 new entries added. HANDLERS extended. guya-review found and fixed: 4× readFile catch swallowing all errors (now ENOENT-only), proposeTask wrapping curriculum content in `## Context`. guya-deep-review found and fixed: 3× fs.access catches (one was overwrite-of-unreadable-file risk).
- 2026-05-08: **Phase 2c complete** (telos commit `df6c829`, deployed and smoke-tested on mini). Updated tick-morning-prompt.md + tick-evening-prompt.md for new schema (P-NNN/T-NNN/L-NNN paths, numeric priority, abandoned outcome, weekly-schedule reference, new tools in action list). Added "tomorrow's intent ask" hook to evening per design decision 6. Wrote new tick-midday-prompt.md (4-6 line lightweight pulse-check fired at 1pm PT). Updated CLAUDE.local.md Constantia quick map + tool inventory with all 12 tools post-Phase-2. .gitignore extended with !groups/telos/tick-midday-prompt.md to track the new file. Mini deployment: pulled df6c829, pnpm build clean, 1pm cron inserted in work session inbound.db (id task-1778297000000-midday, recurrence `0 13 * * *`, process_after 2026-05-09T20:00 UTC), launchctl kickstart restart (PID 93397). Smoke test: spawned MCP server with Bun on laptop, tools/list returned all 12 tools with correct new schemas. Initialize handshake works. Mini's nanoclaw will spawn fresh Bun processes on next tick that read the updated mcp-server.ts directly (no compile step needed for per-group tools — only nanoclaw core compiles). **Phase 2 (a+b+c) end-to-end DONE.** Phase 3 (learn session bootstrap) and Phase 4 (life session bootstrap with 두식 Korean addendum) pending — they spin up the new sibling sessions; the work session preserved as-is throughout.
