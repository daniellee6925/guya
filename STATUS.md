# guya — Status

> Last updated: 2026-05-11 14:08 PT

## Current Focus

**Phase 5 (reminder firing infra) is the explicit entry point for next session per Daniel.** Tonight, watch the overnight ticks fire from the freshly-deployed LIFE session — the first natural transition tick at 6pm PT is the real-world validation.

**5/11: Phase 4 (life session bootstrap) shipped end-to-end on mini.** All three Telos sessions are now live (work + learn + life). LIFE session DM smoke verified — Daniel sent `안녕` in `#telos-life`, life-Telos routed → spawned → 두식 voice surfaced in 존댓말+형님 → Discord reply landed (`오늘 어떻게 지내셨어요, 형님. 몸은요?`). All four wiring rows in place (including the [L5] `messaging_group_agents`). 5 life-tick crons armed: 10am/12pm/6pm/8pm/11pm PT. First natural fire = tonight 6pm transition tick. **Phase 5 (reminder firing infra) is the next entry point.**

**What's live now:**
- **Three nanoclaw sessions on mini.** Work (`sess-1777143186178-0bacbi` / ag `ag-1777143186174-ykqd40`) + Learn (`sess-1778451576000-learn` / ag `ag-1778451576000-learn`) + **LIFE (`sess-1778531816000-life` / ag `ag-1778531816000-life`, mg `mg-1778531816000-life`, mga `mga-1778531816000-life`)**. LIFE channel `#telos-life` is `discord:1497671232139825232:1503157300922417232`. 5 life-tick crons: 10am morning / 12pm bodycheck / 6pm transition / 8pm workout / 11pm close PT.
- **두식 LIFE voice deployed.** Same baseline 존댓말 + 형님 as WORK, but **합쇼체 and 해요체 modulated fluidly within messages** by speech act (openers/pattern calls lean 합쇼체; pushback/direct demands lean 해요체). Audrey referred to as **매님**. Reminders are **알림 not 알람**. Cohabitation reframe: pattern detection is presence-quality based, not absence-based. Slang permitted (ㅋㅋ ㄷㄷ etc.) but not default. Tool subset narrow: `add_reminder` + `read_today_transcript` + `do_nothing` only — NO `write_evidence`, NO `grade_*`, NO `propose_task`. Profile writes to `relationship.md` and `health.md` allowed via Edit/Write directly when meaningful pattern surfaces. Calibration anchors locked to Daniel's 3 hand-written Korean prompts (CLAUDE.local.md "Calibration" section).
- **Shared MCP tools + Constantia hook fix carry over from Phase 3.** Same `shared/telos-tools/` mount, same post-commit rebase/cherry-pick/merge guard.
- **Mini plist patched (carry-over from Phase 3, [L4] verified before Phase 4 restart).**

**What's NOT yet built (deferred):**
- **Phase 5** — Reminder firing infra (`scripts/check_reminders.sh` + launchd `com.guya.reminder-fire.plist` polling R-files).
- **Phase 6** — 24h validation + ADR-018 (post-reorg schema) + ADR-019 (silent-rot lessons L1-L7 from Phase 3 + Phase 4 combined).
- **Day-2 content seeding** — 14 categories from design doc sections A-N (pillar 1 project, weekly schedule, R-reminders including workout + 매님 baseline, first bytebytego L-task, profile updates including initial `profile/relationship.md` + `profile/health.md` scaffolds, etc.).

**Anti-rot watches (carrying forward + new for Phase 4):**
- **Tonight 5/11: 6pm transition / 8pm workout / 11pm close ticks should each produce a Korean DM in #telos-life.** First 24h is the validation window for life-Telos. Spot-check tomorrow morning.
- Spot-check that learn-Telos's daily ticks still produce DMs in `#telos-learn` (carry-over from Phase 3).
- Spot-check that work-Telos's `accept_proposal` / `assign_task` calls vary `priority` (numeric 1/2/3) across tasks. If everything defaults to 2, the field is decoration.
- Watch for `pushError: "Rebase conflict — manual resolution needed on mini"` returning. The hook fix should have eliminated this; if it returns, hook regressed.
- **New [L6] watch:** if a future `launchctl kickstart` of nanoclaw produces TWO consecutive `Container exited code=125` for the same session within 2 minutes (one is transient Docker warm-up, two is a real bug).
- **New [L7] watch:** if injecting a synthetic test message into any session inbox, kill the container immediately after the test message processes — before any real message arrives. Otherwise the agent's session state retains the no-destination pattern and routes real responses to scratchpad instead of Discord.

**Next session first read:** `docs/2026-05-11-phase4-deploy-runbook.md` — especially the new L6/L7 lessons in the "Phase 4 post-deploy notes" section. Then check that overnight life + work + learn ticks fired (`git log` in Constantia for any `tick(no-op):` between 5/11 18:00 PT and 5/12 12:00 PT — expect ~10-13 tick commits across the three sessions plus any propose/evidence/reflection commits).

Full Telos state in `telos context/STATUS.md`.

## Recent Changes
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
- [2026-05-11] `317e4e6` — feat(telos): Phase 4 fork-side — telos-life group skeleton + 두식 LIFE addendum (Korean 존댓말+형님, 매님 referent, 알림 not 알람, 합쇼체/해요체 modulated fluidly, slang permitted not default, 5 tick prompts, container.example)
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
- Mount allowlist updated: 6 entries total. Phase 3 added `~/telos/shared/telos-tools` + learn session DB dir. **Phase 4 added** `~/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life` (RO). Backup before Phase 3 at `~/.config/nanoclaw/mount-allowlist.json.pre-phase3.bak`; backup before Phase 4 at `~/.config/nanoclaw/mount-allowlist.json.pre-phase4.bak`.
- Work session container.json updated (Phase 3): MCP path `/workspace/agent/tools/mcp-server.ts` → `/workspace/extra/telos-tools/mcp-server.ts` + new `telos-tools` additionalMount. Backup at `~/telos/groups/telos/container.json.pre-phase3.bak`.
- **Phase 4 added**: `~/telos/groups/telos-life/container.json` (per-installation, gitignored) — references `ag-1778531816000-life`, mounts `shared/telos-tools` (RO), `constantia` (RW), `constantia-deploy-key` (RO file mount), `~/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life` (RO). `imageTag: nanoclaw-agent-v2-53edea47:latest`.
- v2.db (Phase 3): messaging_group `mg-1777143186175-y1fe2x` retargeted from `discord:@me:1497671629008801843` → `discord:1497671232139825232:1503157287416496242` (work channel migration). New rows for learn: agent_groups `ag-1778451576000-learn`, messaging_groups `mg-1778451576000-LEARN`, sessions `sess-1778451576000-learn`, messaging_group_agents `mga-1778451576000-learn`.
- v2.db (Phase 4): four new rows for life — agent_groups `ag-1778531816000-life` (folder `telos-life`), messaging_groups `mg-1778531816000-life` (platform_id `discord:1497671232139825232:1503157300922417232`, unknown_sender_policy `strict`), messaging_group_agents `mga-1778531816000-life` (engage_pattern `.`, sender_scope `all`), sessions `sess-1778531816000-life`.
- LIFE session inbound.db + outbound.db at `/Users/guya/telos/data/v2-sessions/ag-1778531816000-life/sess-1778531816000-life/`. Inbound contains 5 cron rows for life ticks (10am/12pm/6pm/8pm/11pm PT).

## In Progress

- [ ] **NEXT SESSION FIRST READ — `docs/2026-05-11-phase4-deploy-runbook.md` "Phase 3 lessons baked in" section + new L6/L7 in this STATUS.** Seven silent-rot patterns to keep in mind for Phase 5 deploy and any future session bootstrap: L1 Constantia post-commit hook breaks rebase (already fixed) / L2 OneCLI requires lowercase IDs / L3 use `imageTag: :latest` unless extra packages / L4 plist PATH must include Docker.app + Homebrew / L5 `messaging_group_agents` row is the FOURTH routing link / L6 transient 125 on first spawn after restart (one is normal, two consecutively is a real bug) / L7 synthetic test messages without Discord destination contaminate session state — kill container after injection.
- [ ] **NEXT SESSION SECOND READ — verify overnight life + learn + work ticks fired clean.** Life fires at 5/11 18:00/20:00/23:00 PT then 5/12 10:00/12:00 PT. Learn fires at 5/12 10am/1pm/4pm/7pm/10pm PT. Work fires at 5/12 9am/1pm/9pm + 11pm reflection. `git log` in Constantia from 5/11 18:00 PT → 5/12 12:00 PT should show 10-13 new `tick(no-op):` commits if all goes well, plus likely some `propose(...)`, `evidence(...)`, or `reflection:` commits if Telos took action.
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
