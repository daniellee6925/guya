# guya — Status

> Last updated: 2026-05-15

## Current Focus

**5/14 night → 5/15 early AM bug surgery — two silent-rot routing bugs found and fixed end-to-end after marathon session validation surfaced them.** Daniel reported missed LIFE 7pm reminder + LEARN 10pm tick + WORK Telos non-response after the 5/14 marathon's /clear cycle. Diagnostic chain led through three wrong diagnoses (Telos's "destinations issue", my "destinations issue + payload stripping") to two distinct root causes captured as **ADR-021** (empty-string `thread_id` in `messages_in` breaks Discord delivery — `??` operator only catches null/undefined, not empty string) and **ADR-022** (`formatTaskMessage` silently drops raw-XML reminder content because it only reads `content.prompt` and not the JSON-parse-failure `content.text` fallback). Both fixed end-to-end: data UPDATE on WORK DBs (12 inbound + 8 outbound empty-string rows → NULL); three-layer source patches in telos fork (commits `4698f79` + `51184b2`); JSON-wrap fix in constantia (commit `3d38800`); LIFE + LEARN destinations re-seeded with `name=platform_id`. Daemon rebuilt + kickstarted; container source patches activate via bind-mount on next respawn (no image rebuild needed — Dockerfile bakes only runtime, source mounts at `/app/src`). **9am WORK tick fired clean** at 09:00 today — confirms ADR-021 didn't break the NULL path. Awaiting 10:00 LIFE + 10:00 LEARN for full validation.

**5/14 marathon session** (rolled forward as historical context): Phase 6 substantially closed + 3 pillar curricula authored + L-task system bootstrapped. Three Telos sessions healthy after that day's work. Four L-tasks active under 2-main + 2-light model with prefixed schema (`L-P1-001`, `L-P2-001`, `L-P3-001`, plus grandfathered `L-001`).

**What's live now:**

- **Three nanoclaw sessions on mini, all healthy.** Work (`sess-1777143186178-0bacbi`) + Learn (`sess-1778451576000-learn`) + Life (`sess-1778531816000-life`). All three containers have ssh installed (via `docker tag` from working WORK image — see ADR-020), all three have `unnamed`-named destinations seeded (per ADR-019), all three have the scope-clarify addendum loaded (per ADR-018). Mini's Constantia git remote reverted to SSH (no PAT, deploy key path).
- **`:latest` image points to WORK's working SHA** (`95d7b5f22676`). All future spawns of LIFE + LEARN inherit it. Anti-rot: keep per-agent tags and `:latest` re-pointed after every image build.
- **3 pillar curricula authored end-to-end.** Pillar 1 LLM Serving (16 weeks, 20 modules, capstone = Production Serving Cookbook), Pillar 2 Production Agentic Systems (19 weeks including 8-week OSS launch sprint capstone), Pillar 3 Eval Methodology (14 weeks, 11 modules + 2 capstone evals — SDF FEAT-3 realism/diversity + Telos grade calibration audit). All three follow the same bytebytego-grade per-module structure: theme + why + reading + 6 concept-check questions + 3 application options (no effort hints) + cross-application + by-end-of-module markers.
- **Content plan doc** at `docs/2026-05-12-content-plan.md` is the rollup. Tranche 1 closed (curricula + weekly schedule + profile scaffolds + Pillar 1 project decision all done). Tranche 2 closed (Pillars 2 + 3 curricula authored).
- **Four active L-tasks** under 2-main + 2-light model:
  - **Main:** `L-P1-001` (Pillar 1 Module 1 — attention math, Saturday block, due 2026-05-24) + `L-P2-001` (Pillar 2 Module 1 — agent loop, daily organic work, due 2026-05-21)
  - **Light:** `L-001` (prod-eng-foundations Module 1 — Linux process model, due 2026-05-17) + `L-P3-001` (Pillar 3 Module 1 — probability + RVs via Wasserman Ch. 1-3, daily nibbles, due 2026-05-21)
  - **Bytebytego** intentionally deferred — picks up after the 4 active L-tasks complete.
- **L-task ID schema** is now prefixed: `L-P1-NNN` (Pillar 1), `L-P2-NNN` (Pillar 2), `L-P3-NNN` (Pillar 3), `L-PEF-NNN` (prod-eng-foundations), `L-BBG-NNN` (bytebytego). L-001 grandfathered. Constantia MANIFEST handles prefixes without modification — verified.

**What's NOT yet built (deferred):**
- **Pillar 2 LEARN tick-prompt update** — current tick prompts assume one active L-task. With 4 active, the morning tick may surface clumsily. Watch for tomorrow's tick behavior; patch if it doesn't gracefully list multiple.
- **Phase 6 final closeout** — 24-hour validation window for tomorrow's morning ticks (10am LIFE + 9am WORK + 10am LEARN). If all three land in Discord, Phase 6 fully closed; otherwise debug.
- **Pillar 2 concept-tagging** — handled in L-P2-001's "Notes" section as running log. Today's ADR-018/019/020 work already tagged.
- **Bytebytego curriculum** stays as-is until L-task slot opens.

**What's live now:**
- **Three nanoclaw sessions on mini.** Work (`sess-1777143186178-0bacbi` / ag `ag-1777143186174-ykqd40`) + Learn (`sess-1778451576000-learn` / ag `ag-1778451576000-learn`) + **LIFE (`sess-1778531816000-life` / ag `ag-1778531816000-life`, mg `mg-1778531816000-life`, mga `mga-1778531816000-life`)**. LIFE channel `#telos-life` is `discord:1497671232139825232:1503157300922417232`. 5 life-tick crons: 10am morning / 12pm bodycheck / 6pm transition / 8pm workout / 11pm close PT.
- **두식 LIFE voice deployed.** Same baseline 존댓말 + 형님 as WORK, but **합쇼체 and 해요체 modulated fluidly within messages** by speech act (openers/pattern calls lean 합쇼체; pushback/direct demands lean 해요체). Audrey referred to as **매님**. Reminders are **알림 not 알람**. Cohabitation reframe: pattern detection is presence-quality based, not absence-based. Slang permitted (ㅋㅋ ㄷㄷ etc.) but not default. Tool subset narrow: `add_reminder` + `read_today_transcript` + `do_nothing` only — NO `write_evidence`, NO `grade_*`, NO `propose_task`. Profile writes to `relationship.md` and `health.md` allowed via Edit/Write directly when meaningful pattern surfaces. Calibration anchors locked to Daniel's 3 hand-written Korean prompts (CLAUDE.local.md "Calibration" section).
- **Shared MCP tools + Constantia hook fix carry over from Phase 3.** Same `shared/telos-tools/` mount, same post-commit rebase/cherry-pick/merge guard.
- **Mini plist patched (carry-over from Phase 3, [L4] verified before Phase 4 restart).**

**What's NOT yet built (deferred):**
- **`<reminder>` handler in LIFE addendum** (`groups/telos-life/CLAUDE.local.md`) — Phase 5 smoke proved life-Telos receives and processes `<reminder>` XML payloads but stays silent because no handler instructs it on what to do. ~5-line addendum edit: surface title + body via Discord DM, distinguish once vs cron, suggest action. Natural test = tomorrow 6pm R-001 fire.
- **Phase 6** — 24h validation + ADR-018 (post-reorg schema) + ADR-019 (silent-rot lessons L1-L8 from Phases 3-5 combined).
- **Day-2 content seeding** — 14 categories from design doc sections A-N (pillar 1 project, weekly schedule, R-reminders including workout + 매님 baseline, first bytebytego L-task, profile updates including initial `profile/relationship.md` + `profile/health.md` scaffolds, etc.).

**Anti-rot watches (active going forward):**
- **Tomorrow 5/15 morning ticks (9am WORK + 10am LIFE + 10am LEARN) MUST land Discord DMs.** This is the real validation of today's ADR-018/019/020 fixes. If any session goes silent, debug fast.
- **L-task tick handling.** Tomorrow's LEARN morning tick will surface 4 active L-tasks. If the tick prompt struggles (only mentions one, garbles priorities, etc.), patch the tick-prompt to handle multiple gracefully.
- **30-min container ceiling.** All three Telos containers get killed every ~30 min by nanoclaw's absolute-ceiling enforcement. When a tick is due near a kill/respawn cycle, the new container may auto-complete the task without agent processing (today's LEARN 1pm miss had this contributor). If this pattern repeats for tomorrow's ticks, investigate ceiling logic vs spawn-triggered-by-task-row interaction.
- **Bulk SQL cleanup discipline (ADR-020 anti-rot).** Any future `UPDATE messages_in SET status='completed' WHERE...` MUST filter `AND process_after < datetime('now')`. Future-scheduled recurring tasks get silently killed otherwise.
- **`:latest` image drift watch.** If a future docker build or commit recreates `:latest` without explicit re-tag from the working per-agent image, ssh may disappear again. Pre-deploy check: `docker exec <container> sh -c "which ssh && which git"`.
- **Telos's `accept_proposal` / `assign_task` priority variation** (carry-over). Spot-check that calls actually vary `priority` (1/2/3). If everything defaults to 2, field is decoration.
- **Sidecar JSON corruption recovery** (carry-over). Watch `~/Library/Logs/com.guya.reminder-fire.log` on mini for `WARN sidecar JSON corrupt — resetting` lines — would cause every active cron R-file to fire once next minute.
- **L6 watch (carry-over):** two consecutive `Container exited code=125` for same session within 2 min = real bug, not warm-up.
- **L7 watch (carry-over):** synthetic test messages without `platform_id`/`channel_type` contaminate session state.

**Next session first read:**

1. **L-task status** — `cat constantia/tasks/MANIFEST.md` (Learn section) to see what's active. Currently 4 L-tasks across all 3 pillars + prod-eng-foundations.
2. **Tomorrow's tick fires** — `git log --oneline` in Constantia from this evening forward. Should see commits like `tick(no-op): morning brief...` per session per day. If any session is silent, container/tick debugging.
3. **`docs/2026-05-12-content-plan.md`** — the canonical map. All three pillar curricula now linked from there.
4. **ADRs 018, 019, 020** in `CLAUDE.md` — newest entries documenting today's discoveries. Plus the L12 + L13 retrofix sections in Phase 3 + 4 deploy runbooks.

Full Telos state in `telos context/STATUS.md`.

## Recent Changes
- [2026-05-15] (pending commit) — docs(adr): ADR-021 empty-string thread_id + ADR-022 raw-XML content stripping
- [2026-05-14] `aa3c3a3` — chore(scribe): 5/14 marathon end — comprehensive STATUS update
- [2026-05-14] `763026d` — docs(content-plan): mark E.3 done — Pillar 3 curriculum shipped
- [2026-05-14] `ac1eb89` — docs(content-plan): Pillar 1 v2 — bytebytego-grade detail matching Pillar 2 v3
- [2026-05-14] `649b7fc` — docs(content-plan): Pillar 2 v3 — learning-focused, 19 weeks, OSS capstone
- [2026-05-14] `6e709bf` — docs(content-plan): mark E.2 done — Pillar 2 curriculum shipped
- [2026-05-14] `460588a` — docs(adr): ADR-020 — image staleness + bulk SQL cleanup pitfall
- [2026-05-14] `e213d9e` — docs: ADR-019 + Phase 3/4 runbook L12 retrofix
- [2026-05-14] `52a623d` — docs(content-plan): Tranche 1 close — B shipped, C scoped-down, F done
- [2026-05-14] `06a7f8e` — docs(content-plan): lock Pillar 1 + point at curriculum
- [2026-05-14] `c112522` — chore(scribe): 5/14 batch — content plan + ADR-018 follow-up
- [2026-05-14] `e4bacae` — docs(adr): ADR-018 — Claude SDK resume freezes system prompt
- [2026-05-11] `676754d` — docs(phase5): ship — lessons L8-L11, smoke validation results, content gap flagged
- [2026-05-11] `f4c91ac` — docs(phase5): pre-deploy runbook for reminder firing infra
- [2026-05-11] `08d6e41` — chore(scribe): Phase 4 docs sync + ADR-023 + hooks/CLAUDE.md catch-up
- [2026-05-11] `ff58f86` — chore(scribe): dedupe Phase 4 placeholder in Recent Changes
- [2026-05-11] `cb388c8` — chore(scribe): Phase 4 ship + L6/L7 silent-rot lessons + mini deploy runbook
- [2026-05-11] `74b7a3a` — docs(status): polish Phase 4 handoff — content-authoring gap called out
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
- [2026-05-15] `51184b2` — fix(routing): preserve raw rem-row content when not JSON-wrapped (formatTaskMessage falls back to content.text — ADR-022)
- [2026-05-14] `4698f79` — fix(routing): treat empty-string thread_id as missing in routing fallbacks (??→|| at 3 callsites — ADR-021)
- [2026-05-11] `317e4e6` — feat(telos): Phase 4 fork-side — telos-life group skeleton + 두식 LIFE addendum (Korean 존댓말+형님, 매님 referent, 알림 not 알람, 합쇼체/해요체 modulated fluidly, slang permitted not default, 5 tick prompts, container.example)
- [2026-05-10] `ce5b0d5` — feat(telos): Phase 3 fork-side — shared MCP tools + telos-learn group skeleton
- [2026-05-08] `df6c829` — chore(telos): Phase 2c — work session prompts + addendum updates for new schema
- [2026-05-08] `26fe607` — chore(telos): Phase 2b — acceptProposal rewrite + 5 new MCP tools
- [2026-05-08] `c0be63f` — chore(telos): Phase 2a — schema migration for assignTask + gradeTask + helpers

**Cross-repo (constantia `daniellee6925/constantia`):**
- [2026-05-15] `3d38800` — fix(check_reminders): JSON-wrap reminder content for proper formatTaskMessage parsing (defense in depth alongside telos `51184b2` — ADR-022)
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
- Mount allowlist updated: 6 entries total. Phase 3 added `~/telos/shared/telos-tools` + learn session DB dir. **Phase 4 added** `~/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life` (RO). Backup before Phase 3 at `~/.config/nanoclaw/mount-allowlist.json.pre-phase3.bak`; backup before Phase 4 at `~/.config/nanoclaw/mount-allowlist.json.pre-phase4.bak`.
- Work session container.json updated (Phase 3): MCP path `/workspace/agent/tools/mcp-server.ts` → `/workspace/extra/telos-tools/mcp-server.ts` + new `telos-tools` additionalMount. Backup at `~/telos/groups/telos/container.json.pre-phase3.bak`.
- **Phase 4 added**: `~/telos/groups/telos-life/container.json` (per-installation, gitignored) — references `ag-1778531816000-life`, mounts `shared/telos-tools` (RO), `constantia` (RW), `constantia-deploy-key` (RO file mount), `~/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life` (RO). `imageTag: nanoclaw-agent-v2-53edea47:latest`.
- v2.db (Phase 3): messaging_group `mg-1777143186175-y1fe2x` retargeted from `discord:@me:1497671629008801843` → `discord:1497671232139825232:1503157287416496242` (work channel migration). New rows for learn: agent_groups `ag-1778451576000-learn`, messaging_groups `mg-1778451576000-LEARN`, sessions `sess-1778451576000-learn`, messaging_group_agents `mga-1778451576000-learn`.
- v2.db (Phase 4): four new rows for life — agent_groups `ag-1778531816000-life` (folder `telos-life`), messaging_groups `mg-1778531816000-life` (platform_id `discord:1497671232139825232:1503157300922417232`, unknown_sender_policy `strict`), messaging_group_agents `mga-1778531816000-life` (engage_pattern `.`, sender_scope `all`), sessions `sess-1778531816000-life`.
- LIFE session inbound.db + outbound.db at `/Users/guya/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life/`. Inbound contains 5 cron rows for life ticks (10am/12pm/6pm/8pm/11pm PT).

## In Progress

- [ ] **NEXT SESSION FIRST READ — `docs/2026-05-11-phase5-deploy-runbook.md` "Lessons learned" section (L8-L11) + new L8 watch in this STATUS.** Eleven silent-rot/operational patterns now accumulated across Phases 3-5. The new ones from Phase 5: L8 Phase 5 infra delivers but LIFE addendum has no `<reminder>` handler (content gap, not infra) / L9 surgical host deploy via `git fetch` + `git show` avoids dirty-repo block / L10 constantia post-commit hook auto-pushes, so explicit `git push` returns "Everything up-to-date" / L11 script's batched commit-and-push for once-shot status flip works on first try (Phase 3 L1 hook fix still holding).
- [ ] **NEXT SESSION SECOND READ — verify overnight ticks + R-001 fire fired clean.** Life fires at 5/11 18:00/20:00/23:00 PT then 5/12 10:00/12:00/18:00/20:00/23:00 PT. Learn fires at 5/12 10am/1pm/4pm/7pm/10pm PT. Work fires at 5/12 9am/1pm/9pm + 11pm reflection. **Real R-001 (movie reminder) fires at 5/12 18:00 PT — natural test for `<reminder>` content gap (L8).** `git log` in Constantia from 5/11 18:00 PT → 5/12 20:00 PT should show ~14-17 new `tick(no-op):` commits + `fire(reminder): R-001` from check_reminders.sh + likely some `propose(...)`, `evidence(...)`, or `reflection:` commits if Telos took action.
- [x] **Phase 5 — Reminder firing infra. SHIPPED 2026-05-11 23:47 PT.** `scripts/check_reminders.sh` (340 LOC) in constantia commit `a8d1fd7`. `launchd/com.guya.reminder-fire.plist` in telos fork commit `18620a6`. Pre-deploy runbook `docs/2026-05-11-phase5-deploy-runbook.md` (guya commit `f4c91ac`). Smoke test validated: 3 fires landed correctly, R-002 status auto-flipped + pushed (`b384891`), R-003 retired (`65b5941`).
- [ ] **`<reminder>` handler in LIFE addendum.** 5-min content edit: teach `groups/telos-life/CLAUDE.local.md` to surface `<reminder>` payloads as Korean Discord DMs. Distinguish once-shot (acknowledge once) from cron (recurring nudge with action). Validate against real R-001 fire 5/12 18:00 PT.
- [ ] **Phase 6 — Validation + cutover.** 24-hour observation: all 13 ticks fire across work/learn/life + real R-001 fire path 5/12 18:00 PT. Day-2 review with Daniel. Add ADR-018 entry to CLAUDE.md (post-reorg schema) + ADR-019 (Phase 3-5 silent-rot lessons L1-L8 — meta-pattern: silent rot of trusted enforcement at the routing/auth/runtime/content tiers). Mark ADR-017 as **superseded by ADR-018**. Update STATUS + ARCHITECTURE.
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

- [2026-05-14 night → 2026-05-15 early AM, ~2 hours] **Post-marathon bug surgery — two silent-rot routing bugs found and fixed end-to-end.** Daniel reported missed LIFE 7pm reminder + LEARN 10pm tick + WORK Telos non-response after the 5/14 marathon's /clear cycle stripped session-memory inheritance. Three rounds of diagnosis before convergence:

  **Round 1 (wrong):** Telos's own diagnosis was *"destinations issue — wire Daniel's Discord DM as a named destination"* — I initially treated as plausible, but verified state showed destinations had been seeded at noon per ADR-019 with `name=unnamed`. Either stale diagnosis or a regression.

  **Round 2 (also wrong, my error):** I suspected `<reminder>` tag stripping somewhere between DB and agent (Telos's Korean diagnosis had said *"빈 메시지가 왔는데 내용이 없어서"*). Reviewed `extractRouting()` and `chat-sdk-bridge.deliver()`. Found something else: outbound `thread_id` was empty-string for failed WORK delivery rows. Different bug entirely.

  **Round 3 (correct, ADR-021):** Empty-string `thread_id` in WORK 23:00 task series. Root cause was the ADR-019 cron-seed INSERT using `''` instead of `NULL` for `thread_id`. Three downstream `?? null` callsites (`formatter.ts:100` extractRouting, `messages-out.ts:72` writeMessageOut, `chat-sdk-bridge.ts:354` deliver) propagated the empty string because `??` only catches `null`/`undefined`. Discord adapter `decodeThreadId("")` threw `Invalid Discord thread ID:` after 3 retries. Affected WORK 23:00 series silently for 4 days (5/12, 5/13, 5/14 all failed). Masked by chat-sdk session-memory inheritance until `/clear` stripped it. Fix: data UPDATE (12 inbound + 8 outbound empty-string rows → NULL) + three-layer source patch (`??` → `||`).

  **Round 4 (also correct, separate bug, ADR-022):** LIFE 7pm reminder had `thread_id=NULL` correctly but produced ZERO outbound rows. Different from ADR-021. Investigation: `formatTaskMessage` calls `parseContent(msg.content)`. For task-row content that's JSON (`{"prompt":"..."}`) it works. For rem-row content that's raw XML (`<reminder>...</reminder>`), `JSON.parse` throws and the fallback returns `{text: raw}`. Then `formatTaskMessage` emits `'Instructions:'` + `content.prompt || ''` — but `content.prompt` is undefined for the raw-XML path. Instructions section renders as empty. Agent sees empty task, does nothing. **Convergent evidence:** Telos's own outbound at 22:42 PT on 5/14 explicitly diagnosed *"7시에 빈 메시지가 왔는데 내용이 없어서 그냥 넘겼습니다"* — he saw the empty-content state. I had initially dismissed this as guess-from-symptom; was wrong. Fix: (a) `formatTaskMessage` falls back through `content.prompt → content.text → ''`; (b) `check_reminders.sh` JSON-wraps reminder bodies as `{"prompt": "<reminder>..."}` at source; (c) re-seeded LIFE + LEARN destinations with `name=platform_id` (they had been wiped at some point between noon and night — separate regression worth investigating later).

  **Deployment surprise:** Initial plan was "do daemon-side fix tonight, defer container-side patches because docker rebuild is blocked from SSH per ADR-020." Then reading `container-runner.ts:301-303` showed that `agent-runner/src/` host directory is bind-mounted into every container at `/app/src` read-only, and Bun runs the TS directly. Dockerfile explicitly notes: *"Source is never baked in. Source-only changes never require an image rebuild."* So container-side patches activate on next container respawn — no docker build needed. ADR-020's keychain blocker doesn't apply to source-only changes.

  **Mistakes I (Guya) should remember:**
  - **Anchored on first plausible diagnosis.** Spent ~30 min on "empty destinations" hypothesis before noticing the deeper data-shape issue. Should have inspected `parseContent` + `formatTaskMessage` chain when Telos's own diagnosis explicitly said *"내용이 비어있었어요"* (the content was empty) — that's a direct evidence claim, not symptom guess.
  - **Dismissed Telos's diagnosis twice.** First in the immediate exchange ("Telos was guessing from symptom"), then again partway through Round 2. Lesson: when a system component diagnoses its own behavior with specific evidence (file path, row state, observable string), that's data, not opinion — verify before dismissing.
  - **Confused docker rebuild constraint.** Assumed source patches couldn't deploy without image rebuild, planned around it, almost left container-side patches as "staged for tomorrow." Reading Dockerfile + `container-runner.ts` would have caught the bind-mount pattern up front.

  **Validation pending:** 10:00 LIFE morning tick + 10:00 LEARN morning tick land in Discord today. WORK 9am already fired clean (verifies ADR-021 fix didn't break NULL path). WORK 23:00 tonight is the previously-broken series — that's the real test.

  **Cross-repo commits:** telos fork `4698f79` (ADR-021 three-layer patch), telos fork `51184b2` (ADR-022 formatTaskMessage fallback), constantia `3d38800` (ADR-022 check_reminders JSON-wrap). All local — not pushed to remote.

- [2026-05-14 marathon session, ~12+ hours] **Phase 6 substantially closed + 3 pillar curricula authored + L-task system bootstrapped.** Single longest session of the project so far. Three distinct work streams interleaved:

  **Stream 1 — Silent-rot debugging marathon (Phase 6 work).** Daniel reported "ticks not delivered to LIFE in LEARN" mid-day. Initial diagnosis (mine) was wrong twice before converging on root cause. Telos itself produced a diagnosis ("No destination configured / need admin to wire up") that I initially dismissed as hallucination but was actually correct — line 125 of `destinations.ts` literally returns that string when the destinations table is empty. Three ADRs surfaced from the debugging:
  - **ADR-018: Claude SDK `resume` freezes the system prompt.** nanoclaw passes both `resume: <continuation>` AND `systemPrompt.append: <addendum>` to Claude Agent SDK; the SDK uses the original session's system prompt on resume and ignores new `append`. So all our previous addendum edits (LIFE 6a731d9 from 5/12) never reached the running agents. `/clear` is the only deploy mechanism for addendum changes. Confirmed empirically via WORK /clear test ~12:42 AM PT — fresh session immediately responded with substantive Karpathy-engineer engagement (surfaced L-001 4-day slip, named SIGTERM/SIGKILL gap). Pre-/clear protocol: agent synthesizes observations into Constantia profile files before clearing. Validated on WORK: work-Telos wrote 4 patterns to `profile/*.md` (constantia `227f6a8`) before /clear; fresh session post-clear engaged from the new profile state.
  - **ADR-019: Per-session `destinations` table requires explicit seeding.** Phase 3 (LEARN) + Phase 4 (LIFE) deploy runbooks both missed this step. WORK had it populated from original setup (single row `unnamed|work|channel|discord|...`); LIFE + LEARN had empty tables. nanoclaw's `buildSystemPromptAddendum()` injects "You currently have no configured destinations" into the system prompt when empty; agent produces tick responses but never wraps in `<message to="...">` because no destination names exist; text goes to scratchpad. Masked for 4 days by session memory inheritance from chat-sdk Daniel-pings (which carry routing on inbound row). `/clear` stripped the mask. Fix: `INSERT INTO destinations` rows for LIFE + LEARN matching WORK's pattern + kickstart nanoclaw + /clear each session.
  - **ADR-020: Per-agent docker image tag drift from `:latest` (ssh-missing bug) + bulk SQL cleanup pitfall.** Two related findings. (a) WORK uses per-agent tag `:ag-1777143186174-ykqd40` (built Phase 2 era with `openssh-client` baked in). LIFE + LEARN spawn from `:latest`, which was rebuilt at some unknown later point WITHOUT `openssh-client`. Result: commits land locally on mini but `git push` from container fails silently with `cannot run ssh: No such file or directory`. Fix: `docker tag` from working WORK image to `:latest`. (b) During cleanup of stale tick rows earlier in the same session, I ran `UPDATE messages_in SET status='completed' WHERE kind='task' AND status='pending'` without filtering `process_after` — prematurely killed today's LEARN 1pm recall tick. Nanoclaw inserted a replacement but capacity issues prevented agent processing. Anti-rot: bulk SQL cleanup against `messages_in` MUST filter `process_after < datetime('now')`.

  Also documented during the session: **PAT-in-URL leakage failure mode.** Attempted Path B (HTTPS+PAT instead of SSH) for the ssh-missing bug; git's error output echoed the PAT in two separate shell invocations before redaction pipes could process them. Daniel rotated PAT twice in 30 min before pivoting back to SSH (Path A via `docker tag`). Lesson logged: PAT-in-URL patterns are unsafe to iterate on; use credential helpers or file-mounted secrets if HTTPS auth is ever required again.

  **Stream 2 — Three pillar curricula authored to bytebytego depth.**
  - **Pillar 1 (LLM Serving + Inference) v2** at `constantia/tasks/learn/curricula/pillar-1-llm-serving.md` (954 lines, constantia commit `dc1da65`). 20 modules across 7 phases + capstone (Production Serving Cookbook + optional OSS escalation as `llm-serving-bench`). 16 weeks at 3-5 hrs/week. Hardware-gated: RunPod RTX 4090 default ($0.50/hr), A100 40GB for Phases 5 + 7. Total estimated spend $80-150. Model: Llama 3.1 8B Instruct as the locked target.
  - **Pillar 2 (Production Agentic Systems) v3** at `constantia/tasks/learn/curricula/pillar-2-agentic-systems.md` (619 lines, constantia commit `4b8c483`). 11 modules across 3 foundational phases + 8-week open-source launch sprint capstone. 19 weeks total. Live-lab format: Guya + Telos IS the codebase under study; reading paired with audit + concept-check + optional application. Open-source capstone is the multi-personality framework slice (NOT Constantia + Guya which stay private). Addresses the "single-user scale credibility" gap. Daniel-stated priority over LangGraph fluency — framework deliberately dropped in v3.
  - **Pillar 3 (Eval Methodology) v1** at `constantia/tasks/learn/curricula/pillar-3-eval-methodology.md` (646 lines, constantia commit `d346868`). 11 modules across 4 phases + 2 capstone evals shipped to production (SDF realism/diversity metrics — closes FEAT-3 backlog; Telos grade calibration audit — statistical test of evolution-loop effectiveness). 14 weeks. Wasserman *All of Statistics* as the spine (Daniel's baseline is "grasp not concrete" → Phase 1 builds foundations from scratch, careful pacing). McElreath as friendlier Bayesian alternative. Cross-application sections in every module connect concepts to SDF + Pillar 1/2 (Pillar 3 explicitly services the others — not standalone).

  **Stream 3 — L-task system bootstrapped under 2-main-2-light operational model.**
  - **Capacity reality acknowledged:** 4 active curricula × 3 hrs/week each = 12 hrs/week is aggressive but Daniel-validated as sustainable given (a) Pillar 1 has dedicated Saturday block, (b) Pillar 2 work happens organically through daily Guya/Telos sessions (the audit + ship pattern), (c) Pillar 3 + prod-eng-foundations run "light" mode (daily nibbles — one Wasserman section per evening, one short video per day).
  - **Mode classification:** Main = focused dedicated sessions (Pillar 1 Saturday block, Pillar 2 daily Guya/Telos work). Light = small daily actions across multiple days (prod-eng-foundations videos, Wasserman daily reading).
  - **L-task ID schema:** prefixed by curriculum. `L-P1-NNN` (Pillar 1), `L-P2-NNN` (Pillar 2), `L-P3-NNN` (Pillar 3), `L-PEF-NNN` (prod-eng-foundations), `L-BBG-NNN` (bytebytego). L-001 grandfathered (in-flight from 5/11). Constantia MANIFEST handles prefixes without modification — verified post-commit.
  - **Four L-tasks active:** L-001 (prod-eng-foundations Module 1 / Linux processes / light burst / due 5/17), L-P1-001 (Pillar 1 Module 1 / attention math / Saturday main / due 5/24), L-P2-001 (Pillar 2 Module 1 / agent loop / daily organic main / due 5/21), L-P3-001 (Pillar 3 Module 1 / Wasserman foundations / light nibbles / due 5/21). Bytebytego deferred until first 4 complete.
  - **Pillar 2 concept-tagging** lives in L-P2-001's "Notes" section as running log. Today's ADR-018/019/020 work already tagged there with explicit module-mapping (ADR-019 cemented Module 1 concept-check #5; ADR-020 cemented #6; ADR-018 cemented Module 2 territory).

  **Phase 6 status:** Substantially closed. ADR docs landed (018, 019, 020), Phase 3 + 4 runbooks patched with L12 + L13 retrofix sections, three Telos sessions confirmed healthy (ssh + destinations + scope-clarify + responding). Remaining for full Phase 6 closeout: 24-hour validation window for tomorrow's morning tick fires (9am WORK + 10am LIFE + 10am LEARN). If all three land in Discord, Phase 6 100% done.

  **Mistakes I (Guya) should remember:**
  - Initially dismissed Telos's correct self-diagnosis as hallucination. Should have verified before dismissing.
  - Rabbit-holed for ~90 min on SSH/HTTPS push debugging when the original "ticks not delivering" bug was already fixed. Daniel called me back to convergence; I documented it as a feedback memory.
  - Unfiltered bulk UPDATE prematurely killed a future-scheduled tick. Filter pattern (`AND process_after < datetime('now')`) is now in ADR-020.
  - Initially proposed 11 specific features for Pillar 2 (project-plan shape); Daniel corrected to learning-curriculum shape. v3 reflects the correction.
  - Misread Daniel's "Pillar 2 happens organically" as "no L-tasks needed for Pillar 2" — was wrong; he just meant "I have plenty of time because I'm already doing the work daily." L-P2-001 added.

  **Constantia commits today (rough chronology):** destinations seeded → /clear LIFE + LEARN → addendum patches → image retag → SDF push reverted to SSH → 3 pillar curricula authored → 3 new L-tasks. Specific SHAs in commit history.

  **Guya commits today:** ADR-018 (`e4bacae`), 5/14 scribe batch (`c112522`), Pillar 1 lock (`06a7f8e`), Tranche 1 close (`52a623d`), ADR-019 + L12 retrofix (`e213d9e`), ADR-020 + L13 retrofix (`460588a`), Pillar 2 v3 update (`649b7fc`), Pillar 1 v2 update (`ac1eb89`), Pillar 3 done (`763026d`).

- [2026-05-11 late night] **Phase 5 (reminder firing infra) shipped end-to-end on mini in ~3 hours.** Locked two design decisions before code: (1) `last_fired` for cron lives in mini-local sidecar JSON only — keeps Constantia commit log clean (cron fires don't churn git); R-file frontmatter `last_fired` stays null in git. (2) Message content uses XML wrap `<reminder id="..." title="..." schedule_(at|expr)="...">body</reminder>` rather than plain prose — future-proof for LIFE addendum to learn distinct handling. `kind='task'` matches existing scheduling-module path. Built 340-LOC `scripts/check_reminders.sh` (constantia `a8d1fd7`): 5-field cron subset (`*`, `N`, `N-M`, `N,M`, `*/N`), busy_timeout=5000 for sqlite3 contention with nanoclaw, JSON-validated sidecar with reset-on-corruption, trap-cleanup for `.tmp.$$` files. Plist template (telos `18620a6`) with Docker.app+Homebrew PATH per L4. **Surgical host deploy** sidestepped a dirty repo on mini: `git fetch origin` + `git show origin/main:launchd/... | sed > ~/Library/LaunchAgents/...` — no working-tree touch (L9). Smoke validated all four paths: cron fires every match, once-shot fires past schedule_at, retired stops firing, sidecar idempotency holds, R-002 status auto-flip pushed back (`b384891`). **Observation:** all 3 inbound rows marked `status=completed` but zero outbound DMs in `#telos-life`. life-Telos receives `<reminder>` cleanly, the LIFE addendum just doesn't have a handler. **Phase 5 = pipe-in validated; pipe-out (5-line addendum edit) is the natural Phase 6 / Day-2 wedge.** Real R-001 (movie reminder) fires tomorrow 5/12 18:00 PT — the natural test for the content gap. **In-flight mini-side prompt edit preserved untouched**: `groups/telos/tick-midday-prompt.md` has uncommitted Daniel-authored edit on mini adding required closing questions ("What are you on right now? What do you need to finish by EOD?") — not auto-committed because attribution is Daniel's, not Guya's. Surface to Daniel for commit when convenient.

- [2026-05-11] **Phase 4 (life session bootstrap) shipped end-to-end. Two new silent-rot patterns surfaced and captured.** Followed Phase 3 runbook with find-and-replace operations (learn → life, learn channel ID → life channel ID, learn tick filenames → life tick filenames, learn cron times → life cron times). All five Phase 3 lessons (L1-L5) pre-empted as inline `[L#]` callouts in the Phase 4 runbook (`docs/2026-05-11-phase4-deploy-runbook.md`). Mechanical deploy clean except for two new variants: **L6 — transient code 125 on first container spawn after `launchctl kickstart`**. The first life-container spawn after restart exited 125 in 159ms. Second spawn one minute later (same config) ran cleanly. Probably Docker socket warm-up under launchd. Nanoclaw's retry loop handled it; worth watching only if it ever happens TWICE consecutively. **L7 — synthetic test messages without platform_id/channel_type contaminate session state.** I dropped a synthetic test message into LIFE's inbox to wake the container (no Discord routing info attached). The agent processed it and correctly noted "no destination, response → scratchpad." Then Daniel's real Discord message arrived in the SAME poll-loop session — the agent stuck with the scratchpad pattern from the previous turn instead of producing a `<message to="discord:...">` block. Killing the container reset the session and the next real message produced a proper Discord-bound response. Voice landed cleanly: first Discord reply was `오늘 어떻게 지내셨어요, 형님. 몸은요?` — 존댓말+형님, no greeting reflex, body opener matching first-contact pattern 3 with a body riff. The 두식 LIFE voice is calibrated and stable. **Anti-rot watches:** L6 (two consecutive 125s = real bug, not warm-up); L7 (always kill container after injecting a synthetic test). Both candidates for ADR-019 alongside the Phase 3 L1-L5. Five life-tick crons armed for tonight + tomorrow; first natural fire is the 6pm transition tick (~3.5h after deploy completion). Fork commit `317e4e6` on `daniellee6925/nanoclaw`. Runbook in `docs/2026-05-11-phase4-deploy-runbook.md` includes a "Differences from Phase 3 runbook" appendix for the reader who knows Phase 3.

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
