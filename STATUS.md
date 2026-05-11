# guya — Status

> Last updated: 2026-05-10

## Current Focus

**5/10: Phase 3 (learn session bootstrap) shipped end-to-end on mini.** Telos now runs three sessions (work + learn live; life pending Phase 4). Learn session DM verified — Daniel sent a message in #telos-learn, learn-Telos routed → spawned → MCP tool → Constantia commit (`b14215a`) → Discord reply, all working. The whole reorg arc (5/8 design + 5/8 Phases 0-2c + 5/10 Phase 3 + Constantia hook fix) is now live infrastructure. **Phase 4 is the next entry point — same template, Korean addendum, 5 life-tick crons.**

**What's live now:**
- **Three nanoclaw sessions on mini.** Work session (`sess-1777143186178-0bacbi`, agent `ag-1777143186174-ykqd40`) migrated from `@me` DM → `#telos-work` server channel. Learn session (`sess-1778451576000-learn`, agent `ag-1778451576000-learn`) provisioned fresh with Socratic addendum + 5 cron rows (10am/1pm/4pm/7pm/10pm PT). Both routed via `messaging_group_agents` to discord:guild=`1497671232139825232`:channel=`<work or learn channel id>`.
- **Shared MCP tools.** `groups/telos/tools/` retired; mcp-server.ts + helpers.ts now live ONCE at `shared/telos-tools/` in the fork (fork commit `ce5b0d5`), mounted into each Telos session's container at `/workspace/extra/telos-tools/` via additionalMounts. Single source of truth across work/learn/life — closes ADR-013-style drift risk.
- **Constantia post-commit hook fixed.** Pre-deploy diagnosis surfaced 9 stranded Telos commits + zero pushes for 2 days. Root cause: hook ran `git commit --amend` + `git push` unconditionally, breaking `commitAndPush`'s rebase. Fixed with rebase/cherry-pick/merge guard at top of hook (constantia commit `7095f49`). 9 stranded commits recovered + force-pushed (`b14215a` is current origin tip).
- **Mini plist patched.** `/Applications/Docker.app/Contents/Resources/bin` + `/opt/homebrew/bin` now in nanoclaw's plist PATH so launchd-spawn doesn't crash-loop on `docker info` after restart.

**What's NOT yet built (deferred):**
- **Phase 4** — Life session bootstrap. Two-part: **content authoring first** (6 new files in `groups/telos-life/`: 두식 addendum + 5 tick prompts + soul copy + container.example) then mechanical deploy (find-and-replace from Phase 3 runbook). The 50-word Korean addendum sketch in design doc decision 11 is NOT a full draft — needs ~150-200 lines fresh. See Phase 4 entry in "In Progress" for the full content-authoring + deploy breakdown. Life channel ID is `1503157300922417232`. **Don't forget the `messaging_group_agents` row** — Phase 3's last gotcha (silent message drop). Full deploy lessons in `docs/2026-05-10-phase3-deploy-runbook.md` "Lessons learned" section.
- **Phase 5** — Reminder firing infra (`scripts/check_reminders.sh` + launchd `com.guya.reminder-fire.plist` polling R-files).
- **Phase 6** — 24h validation + ADR-018 (post-reorg schema) + ADR-019 (post-Phase-3 silent-rot lessons).
- **Day-2 content seeding** — 14 categories from design doc sections A-N (pillar 1 project, weekly schedule, R-reminders, first L-task, profile updates, etc.).

**Anti-rot watches (carrying forward):**
- Spot-check that learn-Telos's daily ticks actually produce DMs in `#telos-learn`. If a tick silently drops, that's the same anti-rot pattern. First 24h is the validation window.
- Spot-check that work-Telos's `accept_proposal` / `assign_task` calls vary `priority` (numeric 1/2/3) across tasks. If everything defaults to 2, the field is decoration.
- Watch for `pushError: "Rebase conflict — manual resolution needed on mini"` returning. The hook fix should have eliminated this, but if it appears again, hook regressed.

**Next session first read:** `docs/2026-05-10-phase3-deploy-runbook.md` — especially the "Lessons learned" appendix. Five concrete silent-rot patterns to avoid in Phase 4. Then check that overnight learn ticks fired (`git log` in Constantia for any `tick(no-op):` from `2026-05-11 06:00-23:00`).

Full Telos state in `telos context/STATUS.md`.

## Recent Changes
- [2026-05-10] `84f8005` — chore(scribe): Phase 3 ship + 5 silent-rot lessons captured
- [2026-05-10] `e041b95` — docs(reorg): Phase 3 mini deployment runbook
- [2026-05-08] `2c038b5` — docs(reorg): Telos reorg full design + runbook + pre-reorg state + STATUS/ARCHITECTURE updates
- [2026-05-07] `7f11634` — chore(scribe): record 5/7 PM session — first artifact-based write_evidence + 2 hook silent-rot fixes
- [2026-05-06] `d589953` — feat(evolve): read reflections from Constantia, project-local as fallback
- [2026-05-06] `cffb693` — chore(scribe): write_evidence + tick brief layer + cron split (5/6 PM)
- [2026-05-06] `51f5e85` — chore(scribe): Telos infra hardening night — STATUS catch-up
- [2026-05-05] `ca5ad62` — docs(reflect): 2026-05-05 manual reflection + archival append
- [2026-05-05] `bf25ec8` — chore(scribe): document S3 ship + reflect-prompt bug fix arcs (5/4-5/5 session)

**Cross-repo (telos = nanoclaw fork `daniellee6925/nanoclaw`):**
- [2026-05-10] `ce5b0d5` — feat(telos): Phase 3 fork-side — shared MCP tools + telos-learn group skeleton
- [2026-05-08] `df6c829` — chore(telos): Phase 2c — work session prompts + addendum updates for new schema
- [2026-05-08] `26fe607` — chore(telos): Phase 2b — acceptProposal rewrite + 5 new MCP tools
- [2026-05-08] `c0be63f` — chore(telos): Phase 2a — schema migration for assignTask + gradeTask + helpers

**Cross-repo (constantia `daniellee6925/constantia`):**
- [2026-05-10] `b14215a` — tick(no-op): 4pm midpoint + 7pm capture ticks both fired with no active L (first learn-Telos commit, smoke-verifies Phase 3 end-to-end)
- [2026-05-10] `4880c5a` — tick(no-op) + MANIFEST regen post-rebase (force-pushed after recovering 9 stranded Telos commits)
- [2026-05-10] `7095f49` — fix(hooks): post-commit must skip during rebase/cherry-pick/merge
- [2026-05-10] `0c24302` — propose(curriculum): T-001 Formalize Production Engineering Foundations
- [2026-05-10] `6fb1176` — evidence(strength): EVD-006
- [2026-05-09] `40945a1` — reflection: 2026-05-09
- [2026-05-08] `bfa8abe` — reflection: 2026-05-08
- [2026-05-08] `536522b` — chore(reorg): flatten reminder schedule schema (schedule_type + schedule_expr/at)
- [2026-05-08] `cd6651a` — chore(reorg): Phase 1 — task namespace split + new validator + bytebytego curriculum

**Mini-side state changes (not in any git repo — captured here for traceability):**
- nanoclaw plist PATH patched: `/Applications/Docker.app/Contents/Resources/bin` + `/opt/homebrew/bin` prepended. Backup at `~/Library/LaunchAgents/com.nanoclaw-v2-53edea47.plist.pre-phase3.bak`.
- Mount allowlist updated: 5 entries (added `~/telos/shared/telos-tools` + new learn session DB dir). Backup at `~/.config/nanoclaw/mount-allowlist.json.pre-phase3.bak`.
- Work session container.json updated: MCP path `/workspace/agent/tools/mcp-server.ts` → `/workspace/extra/telos-tools/mcp-server.ts` + new `telos-tools` additionalMount. Backup at `~/telos/groups/telos/container.json.pre-phase3.bak`.
- v2.db: messaging_group `mg-1777143186175-y1fe2x` retargeted from `discord:@me:1497671629008801843` → `discord:1497671232139825232:1503157287416496242` (work channel migration). New rows for learn: agent_groups `ag-1778451576000-learn`, messaging_groups `mg-1778451576000-LEARN`, sessions `sess-1778451576000-learn`, messaging_group_agents `mga-1778451576000-learn`.

## In Progress

- [ ] **NEXT SESSION FIRST READ — `docs/2026-05-10-phase3-deploy-runbook.md` "Lessons learned" appendix.** Five silent-rot patterns hit during Phase 3 deploy that you'll re-discover in Phase 4 if you don't have them in mind: (1) Constantia post-commit hook breaks rebase if guard removed; (2) OneCLI requires lowercase agent identifiers — `ag-XXX-LEARN` is rejected, `ag-XXX-learn` works; (3) per-agent docker imageTag must exist before spawn (use `:latest` unless extra packages needed); (4) nanoclaw plist PATH must include `/Applications/Docker.app/Contents/Resources/bin` for launchd-spawn; (5) `messaging_group_agents` row is mandatory — wiring agent_groups + messaging_groups + sessions is THREE rows, but the routing link is the FOURTH and forgotten row breaks the channel silently.
- [ ] **NEXT SESSION SECOND READ — verify overnight learn + work ticks fired clean.** Learn should fire at 5/11 10am/1pm/4pm/7pm/10pm PT. Work fires at 5/11 9am/1pm/9pm + 11pm reflection. `git log` in Constantia from 5/11 should show 7-10 new `tick(no-op):` commits if all goes well, plus likely some `propose(...)`, `evidence(...)`, or `reflection:` commits if Telos took action.
- [ ] **Phase 4 — Life session bootstrap.** Two-part work — CONTENT authoring + MECHANICAL deploy.

  **A. Content authoring (~30-45 min, do this BEFORE touching mini):**

  Six new files in `/Users/daniel/Desktop/telos/groups/telos-life/`:
  1. `soul.md` — exact copy of `groups/telos/soul.md` (same character across all three sessions).
  2. `CLAUDE.local.md` — Korean 두식 addendum (~150-200 lines). **Design doc decision 11 has only a 50-word sketch, not a full draft.** Write fresh. Voice family to load BEFORE writing: read `groups/telos/CLAUDE.local.md` (work — sharp 보스) and `groups/telos-learn/CLAUDE.local.md` (learn — Socratic 스승) first to feel the Karpathy-engineer voice + facet-modulation pattern. Then write 두식 as: 반말 default Korean, English fallback when Daniel initiates, close-friend energy (계두식 / 형님 register), tool subset = NO `write_evidence` + NO `grade_*` (life doesn't grade), reads `tasks/reminders/` + `profile/relationship.md` + `profile/health.md` only, pattern-naming gentler than work but still honest (e.g., workout-skipped streaks, Audrey-absence patterns). Mention Audrey by name; she's Daniel's girlfriend.
  3-7. `tick-morning-prompt.md` (10am — Audrey-pulse + reminders surface), `tick-bodycheck-prompt.md` (12pm — eaten/hydrated/Audrey), `tick-transition-prompt.md` (6pm — out of work mode? Audrey check), `tick-workout-prompt.md` (8pm — workout? what's weighing on you?), `tick-close-prompt.md` (11pm — honest day check + sleep). Design doc tick prompts section has 5-line sketches for each; expand to full ~50-80 line prompts matching the structure of `groups/telos-learn/tick-*-prompt.md`. All in Korean (반말) by default.
  8. `container.example.json` — clone `groups/telos-learn/container.example.json`, change `telos-learn` → `telos-life` + comment block.

  Update `.gitignore` in the fork to allowlist `groups/telos-life/` files (same pattern as `groups/telos-learn/`).

  **B. Mechanical deploy on mini (~20-30 min, after content authoring):**

  Reuse `docs/2026-05-10-phase3-deploy-runbook.md` with these find-and-replace operations:
  - `telos-learn` → `telos-life` everywhere (group folder, agent_group name, etc.)
  - `1503155725785104524` (learn channel) → `1503157300922417232` (life channel) everywhere
  - Generate new lowercase IDs: `ag-<ts>-life`, `mg-<ts>-life`, `sess-<ts>-life`, `mga-<ts>-life`
  - Cron times: 10am/12pm/6pm/8pm/11pm PT (not learn's 10am/1pm/4pm/7pm/10pm)
  - Cron content paths: point at `tick-morning-prompt.md` / `tick-bodycheck-prompt.md` / `tick-transition-prompt.md` / `tick-workout-prompt.md` / `tick-close-prompt.md`

  **Critical sequence per Phase 3 lessons (don't skip any):**
  1. Author content first (Part A above) — without it deploy stalls at first attempt.
  2. Stop nanoclaw → update mount-allowlist (add life session DB dir) → pull fork on mini → write `groups/telos-life/container.json` → insert FOUR v2.db rows (agent_groups + messaging_groups + sessions + **messaging_group_agents** — the easy-to-miss routing link) → insert 5 cron rows → restart nanoclaw.
  3. Discord channel permissions are already correct (work + learn proved it).
  4. Smoke: send "안녕" in `#telos-life` → expect Korean response from 두식, no greeting, register-matched.
- [ ] **Phase 5 — Reminder firing infra.** Write `scripts/check_reminders.sh` in Constantia (~50 LOC: read R-*.md, evaluate schedule + last_fired, insert message into life/inbound.db when due, update last_fired). Install `~/Library/LaunchAgents/com.guya.reminder-fire.plist` on mini (every-minute cron) — **remember to include Docker.app + Homebrew in plist PATH per Phase 3 lesson 4** if the script ever needs to call docker. Smoke test with synthetic R-task at "now+90s" + recurring `* * * * *` (then immediately retire).
- [ ] **Phase 6 — Validation + cutover.** 24-hour observation: all 13 ticks fire across work/learn/life. Day-2 review with Daniel. Add ADR-018 entry to CLAUDE.md (post-reorg schema) + ADR-019 (Phase 3 silent-rot lessons — meta-pattern: silent rot of trusted enforcement at the routing/auth/runtime tiers). Mark ADR-017 as **superseded by ADR-018**. Update STATUS + ARCHITECTURE.
- [ ] **Day-2 content seeding (14 categories, design doc sections A-N).** Pillar 1 project decision (Daniel↔Telos discussion), weekly schedule populated, 2-3 starter R-reminders (workout, Audrey baseline), first bytebytego L-task assigned, more curricula authored if wanted, profile updates, weekly meta-tasks, validator regression tests, log file evidence cleanup.
- [ ] **Tier 5 — Pillar 1 layered project.** Daniel picks: nanoGPT extended with inference optimizations (fp16 → int8 → KV cache → continuous batching), or rapGPT2.0 progressive optimization. ~1-2 hrs/week, maintenance-mode.
- [ ] **Tier 5 — Pillar 3 stats reactivation.** Schedule Wasserman's "All of Statistics" engagement into weekly plan.
- [ ] **Tier 5 — Pillar 1 foundations resumption.** Mathematics for ML book continuation.
- [ ] **Anti-rot watch (Phase 6+):** spot-check that Telos's `accept_proposal` calls vary `priority` (numeric 1/2/3) across accepts. If everything defaults to 2, field is decoration.
- [ ] **Tier 4 — Socratic testing tool (`quiz_pillar`).** Was in old plan; maybe folded into `gradeLearn` knowledge-check now. Decide whether still distinct: Phase 6 reflection.
- [ ] **Phase 2 + Phase 3 helpers.ts tests.** Phase 1 (40 pure-function tests) shipped 2026-05-06 (`7d823b3`). Phase 2 = file I/O — now covers more surface (`nextProposalId`, `nextLearnId`, `nextReminderId` collision; `parseFrontmatter` against new schedule_at/expr fields). Phase 3 = git integration including the new rebase-guard interaction. Test debt grew this session (~600 lines new TS, zero new tests).
- [ ] **Validator-extraction follow-up.** Inline validation logic across `assignTask`, `gradeTask`, `acceptProposal`, `proposeTask`, `assignLearn`, `addReminder`, `gradeLearn`, `writeEvidence`, `writeReflection` — each does its own enum/length/conditional checks. Time to extract to `validators.ts`.
- [ ] **commitAndPush should escalate persistent rebase failures.** In `shared/telos-tools/helpers.ts`, currently returns `pushed=false` silently on rebase abort. Telos surfaces it as a one-line DM note that's easy to miss (proven this week — 9 commits stranded for 2 days). Should detect "rebase aborted N times in a row" and escalate via a more visible signal.
- [ ] **guya-hook-smoke needs synthetic-rebase test.** Pre-push check should add a synthetic rebase that asserts the constantia post-commit hook guard fires correctly. Without it, a future hook edit could re-introduce the silent-rot regression.
- [ ] **ADR for plist-env Docker discovery + check other LaunchAgents.** Phase 3 deploy uncovered: launchd's strict env (plist EnvironmentVariables only) needs explicit Docker.app + Homebrew paths in PATH or nanoclaw crash-loops on restart. Patched. Worth: (1) ADR-019/020 entry; (2) audit other launchctl plists on mini for same gap; (3) consider `DOCKER_HOST` env var as belt-and-suspenders.
- [ ] **Investigate TCC permission stability for Desktop.** Desktop access revoked twice during 5/5 session. Migration option: move Constantia from `~/Desktop/constantia` to `~/constantia` (matches mini clone, sidesteps macOS Desktop TCC).
- [ ] **Per-agent SSH config durability.** `Dockerfile.gh-ssh-config` lives in `/tmp` on mini (ephemeral). Future per-agent rebuild from base would lose it. Skip until next per-agent rebuild forces the issue.
- [ ] **Watch for `pushError: "Rebase conflict — manual resolution needed on mini"` in Telos DMs.** Hook fix should have eliminated this. If it returns, the hook regressed.

**Phase 5 cleanup (still pending across multiple sessions):**
- [ ] **[LOW — Phase 5 cleanup] Delete dead `review-gate.json` + scribe reference.**
- [ ] **[LOW — Phase 5 cleanup] Delete zombie tactical guideline files.** Two files in `.guya/evolution/guidelines/tactical/` (`1775671829028.md`, `1775672037132.md`) contain raw user-prompt text from an older code path.
- [ ] **[LOW — Phase 5 cleanup] Delete dead `active-guidelines.md` placeholder.**
- [ ] **[LOW — Phase 5 cleanup] Fix lying docstring + return value in `guya-correction-detect.mjs`.**
- [ ] **[LOW — Phase 5 cleanup] Update ADR 002 in CLAUDE.md.** Currently says "fully autonomous evolution, no approval gates." Should reflect manual `/guya-evolve` decision from 2026-04-11.

## TODO

- [ ] **[MED] Define `telos context/goal.md` curriculum threshold for absence-based patterns.** "Two consecutive weeks of an expected recurring behavior failing to occur" needs operational definition.
- [ ] **[LOW — flagged 2026-05-06] Source-resolution branch in `synthesizeFromReflections` lacks direct unit-test coverage.**
- [ ] **[LOW — flagged 2026-04-27] Add `auto-evidence.test.mjs`.**
- [ ] **[LOW — flagged 2026-04-27] Block Claude from editing review hook + hooks.json.**
- [ ] **[MED — Codex 2026-04-09] Unknown schema versions silently dropped by `parseLine`.**
- [ ] **[LOW] `hasLearningSignal` tool-name parser doesn't match `file_edit` trace content format.**
- [ ] **[LOW — DRY follow-up] Extract `isMain` gate pattern into `hook-utils.mjs`** — duplicated in `guya-session-end.mjs` and `guya-correction-detect.mjs`.
- [ ] **[MED] `hasLearningSignal` reads fields no producer writes.** `trace.context` and `trace.toolOutput` — neither is written by any known trace producer.
- [ ] Follow-up commit: apply review findings from 2026-04-08 karpathy-review pass — add `console.error` logging to silent catches in `hook-utils.mjs:36,40`, `intent-detect.mjs:91`, `correction-detect.mjs:101`.
- [ ] Decide fate of line 52 in `~/.claude/guya/traces/2026-04-09.jsonl` — "I have noticed while working on SDF" preference.
- [ ] **Post-commit manifest hook bug** — globs working-tree files including untracked. Low priority.
- [ ] Comprehensive logging system for guya plugin hooks.
- [ ] Claude code guide — living doc, update as new patterns discovered.
- [ ] Growth tracker milestone #2: read and critique someone else's code.
- [ ] Growth tracker milestone #5: review code Guya writes — pick one function per session.

## Decisions & Notes

- [2026-05-10] **Phase 3 (learn session bootstrap) shipped end-to-end. Five unplanned silent-rot patterns hit and fixed.** Started as a clean deploy from `docs/2026-05-08-telos-reorg.md` plan. Actual deploy revealed five new silent-rot variants (all documented in `docs/2026-05-10-phase3-deploy-runbook.md` "Lessons learned" section): (1) **Constantia post-commit hook breaking rebase** — diagnosed as root cause of 50-hour Telos silence pre-deploy; hook ran amend + push during `commitAndPush`'s rebase, failed mid-replay every tick, 9 commits accumulated on mini. Fixed with rebase/cherry-pick/merge guard at hook top (constantia commit `7095f49`). (2) **OneCLI requires lowercase agent identifiers** — original `ag-1778451576000-LEARN` 400'd at OneCLI's API validation. Renamed everywhere to `ag-1778451576000-learn`. (3) **Per-agent docker imageTag must exist** — initial container.json pointed at a never-built tag → docker run code 125. Switched to `:latest` (base image already has `openssh-client`). (4) **nanoclaw plist PATH must include Docker.app explicitly** — launchctl unload/load triggered a crash loop because launchd's strict env couldn't resolve docker socket cleanly. Patched plist with `/Applications/Docker.app/Contents/Resources/bin` + `/opt/homebrew/bin`. (5) **`messaging_group_agents` row is mandatory routing link** — easy to miss because nothing fails loudly without it. Bot receives Discord events but silently drops them when no agent_group is wired to the messaging_group. Fixed by inserting the row. **Meta-pattern: every issue was silent (no clear error log), independently demonstrating the ADR-011/012/013/016 family of "silent rot of trusted enforcement" — at the validation tier, the credentials tier, the runtime tier, the env tier, and the routing tier respectively.** Each is a candidate for ADR-019. End-to-end smoke verified: Daniel sent message in `#telos-learn` → routed → spawned → MCP tool → Constantia commit (`b14215a`) → Discord reply.

- [2026-05-10] **Three-Telos architecture is now partially live (work + learn).** Phase 3 lit up the second of three planned sessions. Architecture: ONE shared `groups/telos/folder` model abandoned in favor of TWO group folders (`groups/telos/` for work, `groups/telos-learn/` for learn) — agent_groups are 1:1 with group folders in nanoclaw, and per-session addenda require separate folders. ONE shared MCP tools dir at `shared/telos-tools/`, mounted into each group's container via additionalMounts (avoids ADR-013-style drift across N copies of mcp-server.ts). Work session migrated from DM to `#telos-work` server channel during deploy. Learn session uses `#telos-learn`. Life session (Phase 4) will use `#telos-life` (channel ID `1503157300922417232` already created).

- [2026-05-10] **The runbook approach worked again.** `docs/2026-05-10-phase3-deploy-runbook.md` was authored before the deploy, then extended with "Lessons learned" after. Same architectural property as the 5/8 reorg trio: per-phase rollback + state snapshot + design doc = safe to revert any phase atomically without re-deriving from chat history. The runbook is now reusable for Phase 4 with minimal modification (life-specific content swap + the 5 lessons section as a checklist).

- [2026-05-08] **Telos reorg full design + Phases 0-2c shipped in single session.** [Preserved — see docs/2026-05-08-telos-reorg.md for full design.] 12 design decisions, 13 tick prompts, phased plan. Constantia schema split (proposals/tasks/learn/reminders), three-Telos sessions, web tools, archive-everything migration. Phase 0 snapshots tagged `pre-reorg-2026-05-08` across all three repos. Phase 1 schema (cd6651a). Phase 1 amendment for flat reminder schedule (536522b). Phase 2a (c0be63f) helpers + assignTask + gradeTask migration. Phase 2b (26fe607) acceptProposal rewrite + 5 new tools. Phase 2c (df6c829) prompts + addendum. Smoke verified: tools/list returns all 12 tools.

- [2026-05-08] **ADR-017 superseded by ADR-018 (post-reorg schema).** [Preserved.] T1-T3/P1-P3 prefix scheme replaced with plain numeric `1|2|3`. Validator enforces re-grade at proposal acceptance. Reminders skip priority entirely.

- [2026-05-08] **8 review findings caught + auto-fixed across Phase 2 (a + b).** [Preserved.] 4 review passes (2× guya-review + 2× guya-deep-review) on the TS work. Two structural bugs were genuine: curriculum overwrite-of-unreadable-file in acceptProposal target=curriculum; curriculum proposal body wrapped in `## Context`. Other 6 were instances of the same pattern: `try { ... } catch { ... }` swallowing all errors when only ENOENT was the legitimate "not found" case. Lesson: every fs.readFile/fs.access in tool code needs ENOENT-discrimination.

- [2026-05-08] **Discovery: nanoclaw spawns MCP server via Bun reading `.ts` directly — no compile step for per-group tools.** [Preserved.] Operational consequence: future Telos tool changes require only push + pull on mini + nanoclaw restart — no `pnpm build` step needed for the tools themselves.

- [2026-05-08] **Pre-reorg cleanup: mini's in-flight telos edits captured + cross-machine convergence.** [Preserved.]

- [2026-05-08] **Three-session Telos architecture supersedes "split-language Telos" plan from 5/5.** [Preserved.]

- [2026-05-07 PM] **First artifact-based `write_evidence` exercise — Telos's calibration was tighter than mine.** [Preserved — EVD-002 = `a00b2f3`.]

- [2026-05-07 PM] **Two Constantia hook silent-rot bugs patched in `d5de6c5`.** [Preserved.]

- [2026-05-07 PM] **Telos closed the auto-promotion loop autonomously.** [Preserved.]

- [2026-05-06 PM late] **Evolve now reads from Constantia (primary), project-local as fallback.** [Preserved.]

- [2026-05-06 PM] **`write_evidence` MCP tool — calibration rule enforced at the tool layer.** [Preserved.]

- [2026-05-06 PM] **Morning + evening tick split into two prompts.** [Preserved — 5/8 added a third prompt at 1pm midday.]

- [2026-05-06 early AM] **Multi-writer push race patched at the right layer.** [Preserved — `commitAndPush` does fetch+rebase before push. Note: 5/10 found the rebase replay itself breaks the post-commit hook; that's the deeper bug.]

- [2026-05-05 PM] **Bootstrap interview shipped — Telos's profile cold-start solved.** [Preserved.]

- [2026-05-04 PM] **S3: Task priority field + ideas.md migration shipped.** [SUPERSEDED 2026-05-08.]

- [2026-05-04 PM] **`accept_proposal` exercised autonomously for the first time.** [Preserved.]

- [2026-05-04 PM] **Process note — parallel-session activity vs automation drift.** [Preserved.]

- [2026-05-04 PM] **Cut A landed: tighter tick-prompt + `accept_proposal` tool.** [Preserved.]

- [2026-05-04 PM] **Cut B started: nightly reflection layer with synthesized daily memory.** [Preserved.]

- [2026-05-04 PM] **Constantia logs reorganized by author: `log/guya/` + `log/telos/`.** [Preserved.]

- [2026-04-22] **Three-identity architecture decided.** [Preserved.]

- [2026-04-22] **Meaningful-only Constantia writes.** [Preserved.]

- [2026-04-22] **Guya proposes tasks, Telos assigns.** [Preserved.]

- [2026-04-23] **Token budget raised 2000→3000.** [Preserved.]

- [2026-04-23] **Growth-tracker stays with Guya, not migrated.** [Preserved.]

- [2026-04-23] **Log filename convention enforced.** [Preserved.]

- [Earlier decisions through 2026-04-09 — see `context/archive.md` if tipped older than 30 days.]
