# guya — Status

> Last updated: 2026-05-21 14:00 PT

## Current Focus

**T/P prefix swap migrated + deployed (2026-05-21).** `T-`=Task, `P-`=Proposal. The letters were backwards (`T-` lived in `tasks/proposals/`, `P-` in `tasks/tasks/`); swapped across all three repos and live on the Mini. This was Constantia task `T-005` (née `P-005`, accepted from proposal `P-007` née `T-007`) — now marked complete.

**What shipped:** tool code + validators + all tick prompts (nanoclaw `2eba7ef`); 16 file renames + every cross-ref + both Constantia hooks + a dated swap *legend* in `CLAUDE.md` (constantia `59775be`); ADR-025 + ARCHITECTURE schema table + full migration plan (`docs/2026-05-21-tp-swap-migration.md`) in guya. Cut-over was **freeze Mini (nanoclaw + sync daemon) → push → pull → resume** — no container rebuild needed because `shared/telos-tools/` is bind-mounted live into session containers and `groups/` prompts are read by the host per-tick.

**Immutable-history decision (Daniel):** dated logs / `evidence/` / `tasks/archive/` were NOT rewritten — IDs there keep their pre-swap meaning, recorded in the CLAUDE.md legend. Only live state migrated. Matches the append-only preference from the 2026-05-21 learn-ID migration earlier the same day.

**Gotchas hit + recorded:**
- **Local clones were stale** — telos was 6 commits behind origin (daemon/planning-tick work). The migration had to be rebuilt on current code, incl. two new planning-tick prompts the stale base lacked. (Always `git fetch` + check ahead/behind before a multi-repo migration.)
- **Mini had uncommitted prompt refinements** (always-report rule, 기억나무 anchor, midday closing questions) that nearly got lost on pull — recovered + carried onto the new scheme (`2eba7ef`).
- **Blanket ID-swap corrupts convention-*describing* prose** — the migration's own task/proposal files (`T-005`, `P-007`) had their explanatory text letter-flipped into nonsense; restored by hand. (Saved as a memory.)
- **`constantia-sync` daemon doesn't pull on idle** — its cycle exits before `fetch` when `local_sha == last_pushed_sha`. After pushing constantia from the dev box, the Mini stays behind until its next tick; manual `git merge --ff-only origin/main` to sync now.
- **Mini `git commit` over SSH needs `/opt/homebrew/bin` on PATH** or husky's `pnpm` pre-commit hook fails (exit 127).

**State right now:**
- All three repos consistent across dev box + origin + Mini (telos `2eba7ef`, constantia `59775be`, guya pushed). Mini daemons (nanoclaw + constantia-sync) running. The 1pm tick fired clean on the new code (no-op).
- **Last green light pending:** the next tick that actually *mints* an ID — next `propose_task` → `P-012`, next `assign_task` → `T-006`. Confirm by checking the newest file in `constantia/tasks/{proposals,tasks}/` or the next tick log.
- **`nanoclaw#2` filed:** `ASSISTANT_NAME` defaults to upstream stock "Andy" (skin-deep; the bot's Discord identity is 계두식, and the Telos addendum is intact). Fix = `setup/register.ts --assistant-name Telos` + patch plist default; needs a Mini `.env` check.

**Anti-rot watches (carried + new):**
- **Daemon heartbeat single point of trust** for "are commits making it to origin?" — unchanged from 2026-05-19.
- **`constantia-sync` doesn't pull on idle (new 2026-05-21).** Pushing constantia from anywhere other than the Mini won't reach the Mini until it next commits locally. If the Mini needs the change now, `ssh mini` + `git -C ~/constantia merge --ff-only origin/main`.
- **Mini on WiFi destabilizes the Discord gateway → "Telos is slow / not responding."** If all three channels go slow + respond in bursts, suspect mini's network link, NOT a container or code problem. One nanoclaw process holds one shared Discord WebSocket; WiFi jitter (latency spikes past the gateway heartbeat-ACK timeout) makes it repeatedly declare itself zombied and reconnect (`GATEWAY_RESUMED` in `nanoclaw.log`). Diagnosis: `ping -c 15 8.8.8.8` from mini — high stddev/max jitter is the tell. Fix: wired ethernet. See 2026-05-20 incident below.
- **Telos doc refresh debt** — `telos context/STATUS.md` drifts unless `/guya-telos-scribe` Pass A fires regularly.
- **Container working-tree mutations beyond rebase** — unchanged from 2026-05-19 (checkout/merge/cherry-pick hit the bind-mount wall).

**Next session first read:**
1. **T/P swap live confirmation** — has a tick minted a new-scheme ID yet? Newest file in `constantia/tasks/proposals/` should be `P-012`+ and `tasks/tasks/` `T-006`+ once Telos creates work. If a tick *errored* on an ID, that's the regression signal.
2. **L-005 grading status** — has Telos graded the artifact at `evidence/PILLAR2-loop-trace.md`? (T-009 was accepted → spawned `L-007`; that thread is resolved.)
3. **Daemon status** — `cat /Users/guya/constantia/.git/sync-status.json` on mini (or `constantia-sync-alert` in session-start context).

## Recent Changes
- [2026-05-21] `4ef2d48` — docs(migration): mark T/P swap DEPLOYED + record plan corrections
- [2026-05-21] `3fab2cb` — docs(schema): T/P prefix swap — ADR-025 + ARCHITECTURE schema + migration plan (T-005)
- [2026-05-21] `50589ac` — docs(status): record learn-ID flat-L-NNN migration + update live pointers
- [2026-05-21] `14df182` — chore(scribe): note 2026-05-20 WiFi/gateway incident + anti-rot watch
- [2026-05-20] `8afb10d` — chore(scribe): 2026-05-20 — Telos doc catch-up + telos-scribe skill + L-P2-001 artifact
- [2026-05-19] `241b9ab` — feat(skills): guya-telos-scribe — Telos & Constantia decision doc updater
- [2026-05-19] `008d723` — docs(telos-context): catch up STATUS + goal — 2026-05-06 → 2026-05-19
- [2026-05-19] `06d784e` — log(reflect): 2026-05-19 manual reflection — ADR-024 daemon arc + 5/19 follow-on
- [2026-05-19] `d096c2e` — chore(scribe): batch update — ADR-024 daemon ship + Discord chunker + WORK DM removal

- [2026-05-19] (telos fork `5cf11b6`) — fix(discord): set maxTextLength=2000 to re-enable chat-sdk-bridge splitter (closes nanoclaw#1)
- [2026-05-19] (mini-local data change) — Delete WORK DM destination from central `agent_destinations` (v2.db) + per-session destinations; proactive ticks now channel-only
- [2026-05-16] `80b2fb0` — docs(adr): ADR-024 — constantia-sync daemon (container commits, host pushes)
- [2026-05-16] `bf46252` — feat(session-start): surface constantia-sync daemon health
- [2026-05-16] `0649d4d` — docs(content-plan): close Tranche 3 I.1 — daily + Sunday planning ticks shipped
- [2026-05-15] `a940bf9` — chore(reflections): add 9 manual reflections from 2026-05-05 to 2026-05-15
- [2026-05-15] `b14858e` — chore(scribe): ADR-023 + ADR-019/022 corrections — central agent_destinations is durable seed; tick-wake routing refresh
- [2026-05-15] `5234434` — refactor(docs): extract ADRs 014-022 to docs/adrs/ — CLAUDE.md down ~80%
- [2026-05-15] `c9d0602` — chore(scribe): ADR-021 + ADR-022 — empty-string thread_id + raw-XML content stripping
- [2026-05-14] `aa3c3a3` — chore(scribe): 5/14 marathon end — comprehensive STATUS update

**Cross-repo (telos = nanoclaw fork `daniellee6925/nanoclaw`):**
- [2026-05-21] `2eba7ef` — chore(prompts): recover mini-local prompt refinements (post T/P swap)
- [2026-05-21] `f8a31c0` — refactor(schema): swap T/P prefix — T=task, P=proposal (validators, minters, all tick prompts incl. 2 new planning-tick prompts)
- [2026-05-19] `5cf11b6` — fix(discord): maxTextLength=2000 re-enables splitter (closes #1)
- [2026-05-16] `184a7d5` — refactor(telos-tools): helpers.ts commitAndPush → commitOnly(message, paths); all 10 MCP callers updated; E1 instrumentation removed
- [2026-05-16] `d67fc13` — feat(work): add 10pm daily + Sunday weekly planning ticks
- [2026-05-15] `ce84b19` — fix(poll-loop): refresh routing context when follow-up messages have populated routing (ADR-023)
- [2026-05-15] `51184b2` — fix(routing): preserve raw rem-row content when not JSON-wrapped (ADR-022)
- [2026-05-14] `4698f79` — fix(routing): treat empty-string thread_id as missing in routing fallbacks (ADR-021)

**Cross-repo (constantia `daniellee6925/constantia`):**
- [2026-05-21] `59775be`/`82ee54a` — refactor(schema): T/P swap — 16 file renames + cross-refs + pre/post-commit hooks + CLAUDE.md legend; T-005 marked complete; lina_platform reflection log committed
- [2026-05-21] `d53f096` — chore(tasks): migrate learn IDs to flat L-NNN + pre-commit gate (L-P1-001→L-004, L-P2-001→L-005, L-P3-001→L-006; L-003→L-007 superseded append-only)
- [2026-05-16] `37ff5b4` — refactor(reminders): drop pull/push from check_reminders.sh (daemon owns push)
- [2026-05-16] `1930445` — refactor(hooks): drop post-commit auto-push (daemon owns push)
- [2026-05-16] `deeb32c` — fix(hooks+daemon): post-commit trunc pure-bash; daemon jq conflict-extraction safe
- [2026-05-16] `7f2d61a` — feat(goals): weekly-schedule.md describes 10pm daily + Sunday weekly plan ticks
- [2026-05-16] `0257c57` — Bootstrap rebase: pushed the 21-commit backlog from host
- [2026-05-15] `3d38800` — fix(check_reminders): JSON-wrap reminder content (ADR-022)

## In Progress

- [ ] **Constantia issue #1 — `check_reminders.sh` launchd silence root cause.** Script hasn't fired since 2026-05-14 22:01:32. Refactored to commit-only on 5/16 (daemon picks up push) so the inline-push failure mode is resolved, but the underlying "launchd not invoking the script" question remains open. Deferred until reminder scheduling activity resumes.
- [ ] **Unit tests for `readSyncStatus`** in `guya-plugin/hooks/constantia-sync.mjs` — flagged in 2026-05-16 deep-review as Action needed. Out of scope for daemon ship; follow-up via guya-tester.
- [ ] **Laptop-side sync-status visibility.** Status file lives at `<constantia>/.git/sync-status.json` on mini only. Laptop sessions return null silently from `readSyncStatus` — alerts only fire when running Claude Code on mini (which Daniel rarely does). Options: ssh-read at session start (adds latency), daemon-pushes-throttled-status-file via git (creates churn), HTTPS health endpoint. Decide later.
- [ ] **NEXT SESSION FIRST READ — L-005 grading.** Artifact at `constantia/evidence/PILLAR2-loop-trace.md` (commit `a23340c`). If Telos hasn't graded yet, DM LEARN asking for review-then-grade.
- [ ] **NEXT SESSION SECOND READ — T-009 acceptance.** Proposal at `constantia/tasks/proposals/T-009.md` (commit `e0f70f3`). If Telos has accepted, L-007 will be at `tasks/learn/L-007.md`.
- [ ] **NEXT SESSION THIRD READ — daemon health.** Read `/Users/guya/constantia/.git/sync-status.json` on mini (via ssh). If heartbeat >5min or outcome != 'ok'/'no-op', daemon needs attention. (Resolved 2026-05-20: WORK tick post-DM-deletion landed in channel.)
- [ ] **`/guya-telos-scribe` first real use.** Skill deployed 2026-05-20 but never invoked. Next session that touches Telos infra is the validation surface. Watch for: do passes fire cleanly? does the final-report block read well? does the daemon-stale check work on laptop (no sync-status file expected)?
- [x] **Phase 5 — Reminder firing infra. SHIPPED 2026-05-11 23:47 PT.** (Will be archived after 3 days.)
- [ ] **`<reminder>` handler in LIFE addendum.** 5-min content edit: teach `groups/telos-life/CLAUDE.local.md` to surface `<reminder>` payloads as Korean Discord DMs. Distinguish once-shot (acknowledge once) from cron (recurring nudge with action).
- [ ] **Phase 6 — Validation + cutover.** 24-hour observation: all 13 ticks fire across work/learn/life + real R-001 fire path. Day-2 review with Daniel. Update STATUS + ARCHITECTURE.
- [ ] **Day-2 content seeding (14 categories, design doc sections A-N).** Pillar 1 project decision, weekly schedule populated, 2-3 starter R-reminders (workout, Audrey baseline), first bytebytego L-task assigned, more curricula authored if wanted, profile updates, weekly meta-tasks, validator regression tests, log file evidence cleanup.
- [ ] **Tier 5 — Pillar 1 layered project.** Daniel picks: nanoGPT extended with inference optimizations (fp16 → int8 → KV cache → continuous batching), or rapGPT2.0 progressive optimization. ~1-2 hrs/week, maintenance-mode.
- [ ] **Tier 5 — Pillar 3 stats reactivation.** Schedule Wasserman's "All of Statistics" engagement into weekly plan.
- [ ] **Tier 5 — Pillar 1 foundations resumption.** Mathematics for ML book continuation.
- [ ] **Anti-rot watch (Phase 6+):** spot-check that Telos's `accept_proposal` calls vary `priority` (numeric 1/2/3) across accepts. If everything defaults to 2, field is decoration.
- [ ] **Tier 4 — Socratic testing tool (`quiz_pillar`).** Was in old plan; maybe folded into `gradeLearn` knowledge-check now. Decide whether still distinct: Phase 6 reflection.
- [ ] **Phase 2 + Phase 3 helpers.ts tests.** Phase 1 (40 pure-function tests) shipped 2026-05-06 (`7d823b3`). Phase 2 = file I/O. Phase 3 = git integration including the new daemon-handoff. Test debt grew further this week with the `commitOnly` refactor + daemon (zero new unit tests).
- [ ] **Validator-extraction follow-up.** Inline validation logic across `assignTask`, `gradeTask`, `acceptProposal`, `proposeTask`, `assignLearn`, `addReminder`, `gradeLearn`, `writeEvidence`, `writeReflection` — each does its own enum/length/conditional checks. Time to extract to `validators.ts`.
- [ ] **guya-hook-smoke needs synthetic-rebase test.** Pre-push check should add a synthetic rebase that asserts the constantia post-commit hook guard fires correctly. Without it, a future hook edit could re-introduce the silent-rot regression.
- [ ] **ADR for plist-env Docker discovery + check other LaunchAgents.** Worth: (1) ADR entry; (2) audit other launchctl plists on mini for the PATH gap; (3) consider `DOCKER_HOST` env var as belt-and-suspenders.
- [ ] **Investigate TCC permission stability for Desktop.** Desktop access revoked twice during 5/5 session. Migration option: move Constantia from `~/Desktop/constantia` to `~/constantia` (matches mini clone, sidesteps macOS Desktop TCC).
- [ ] **Per-agent SSH config durability.** `Dockerfile.gh-ssh-config` lives in `/tmp` on mini (ephemeral). Future per-agent rebuild from base would lose it. Skip until next per-agent rebuild forces the issue.

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

- [2026-05-21, later same day] **T/P prefix swap executed + deployed (Constantia task `T-005`, née `P-005`).** The naming was backwards: `T-NNN` lived in `tasks/proposals/` (a proposal) and `P-NNN` in `tasks/tasks/` (a task). Swapped so `T`=Task, `P`=Proposal. **Spans three repos, so atomicity is per-repo, not one commit** (the acceptance text said "single commit" — impossible across repos): nanoclaw `f8a31c0`+`2eba7ef` (validators/minters/all tick prompts), constantia `59775be`+`82ee54a` (16 renames + cross-refs + both hooks + dated CLAUDE.md legend + T-005 complete), guya `3fab2cb`+`4ef2d48` (ADR-025 + ARCHITECTURE schema + plan doc). **Cut-over on the live Mini:** freeze (`launchctl unload` nanoclaw + constantia-sync) → push all 3 → `git pull` on Mini → reload daemons → verify. **No container rebuild** — `shared/telos-tools/` is bind-mounted RO into session containers and `groups/` prompts are read live; a pull deploys. **Immutable history (Daniel's call):** dated logs/evidence/archive NOT rewritten — pre-swap IDs keep old meaning per the CLAUDE.md legend; only live state migrated. **Five gotchas, all worth remembering:** (1) local clones were stale — telos was 6 commits behind origin, so the migration was rebuilt on current code incl. 2 new planning-tick prompts the stale base never had; *always fetch + check ahead/behind before a multi-repo migration*. (2) the Mini had uncommitted prompt refinements (always-report rule, 기억나무 anchor, midday questions) that nearly got lost on pull — recovered + reswapped. (3) a blanket ID-swap corrupts convention-*describing* prose — the migration's own `T-005`/`P-007` purpose/acceptance got letter-flipped into nonsense; restore the meta-files by hand (saved as memory `feedback-migration-convention-prose`). (4) `constantia-sync` exits before fetch when `local == last_pushed` → doesn't pull on idle; manual ff needed after pushing from the dev box. (5) Mini `git commit` over SSH needs `/opt/homebrew/bin` on PATH or husky's pnpm hook 127s. Live confirmation still pending: the next ID-minting tick (`P-012`/`T-006`). Full plan: `docs/2026-05-21-tp-swap-migration.md`. Filed `nanoclaw#2` (ASSISTANT_NAME=Andy leftover, cosmetic) along the way.

- [2026-05-21] **Learn-task ID migration — flat `L-NNN` is now canonical + enforced.** Daniel flagged Telos's learn tasks as having confusing labels. Root cause: Constantia `CLAUDE.md`'s ID-conventions section was stale (documented the pre-2026-05-08 `TASK-NNN` scheme, said nothing about learn IDs) and the pre-commit hook validated ID *uniqueness* but never *format* — so Telos minted flat `L-NNN` while a 2026-05-14 Guya session invented a pillar-prefixed `L-Pn-NNN` scheme; both passed validation and coexisted (`L-003` and `L-P2-001` were sibling Pillar-2 tasks with unrelated-looking IDs). Telos was actually the *consistent* one — flat matches `P-`/`T-`/`R-`/`EVD-`; Guya was the deviation. Fix (constantia `d53f096`): rewrote the ID-conventions spec, added an `^L-[0-9]{3}$` gate to `validate_learn` (gate-proven both ways before migrating), and migrated **append-only** — `L-P1-001→L-004`, `L-P2-001→L-005`, `L-P3-001→L-006`, and `L-003→L-007` (superseded: old L-003 archived as a frozen tombstone, recreated as L-007 so the follow-up sorts after its parent L-005). Chose append over chronological renumber: reusing numbers would make old logs ambiguous; append keeps a clean bijection (every old ID maps to exactly one new ID, no reuse). Dated logs/evidence/reflections left as history; mapping recorded in constantia `log/guya/2026-05-21-guya-6ef35ae8.md`. One-shot supervised crossing into Telos-owned `evidence/`+`goals/` (Daniel-authorized; not a precedent for ongoing co-writing). This guya-repo `STATUS.md` + `telos context/STATUS.md` had their *live* pointers updated to flat IDs; dated changelog entries left as history. **Note surfaced:** the remote commit we rebased onto was Telos accepting `T-007` → task `P-005` (the T-/P- naming swap) — accepted but not yet executed.

- [2026-05-20 evening] **Telos "all channels slow" incident — root cause was mini on WiFi, not Telos.** Daniel reported all three channels (WORK/LIFE/LEARN) slow and responding in bursts, LIFE stuck. Diagnosis chain: (1) host healthy — load decreasing 2.18→1.15, disk 7%, memory fine, 19-day uptime, no crashes; (2) `nanoclaw.log` showed 24 `GATEWAY_RESUMED` events flapping every 7-78 min — the Discord gateway WebSocket repeatedly reconnecting; (3) my own SSH (tailnet path) was intermittently timing out, and Discord (regular-internet path) was also flaky → both paths affected = mini's underlying network, not one service; (4) `ping -c 15 8.8.8.8` from mini: **0% packet loss but 37ms stddev / 143ms max jitter** (min was 7.9ms) — the fingerprint of an unstable WiFi link. The 80% loss to the local gateway IP (192.168.1.254) was a red herring — routers deprioritize ICMP to their own management IP; the clean 8.8.8.8 path proved transit was fine. **Mechanism:** one nanoclaw process holds one shared Discord gateway WebSocket serving all three sessions; WiFi latency spikes blew past Discord's heartbeat-ACK timeout → gateway declared zombied → reconnect → all channels stall during each reconnect window → burst delivery on resume. **Fix:** Daniel connected ethernet. Jitter collapsed from 37ms stddev → 0.4ms stddev (143ms max → 7.6ms max). **Confirmation:** 25-min log watch (19:57-20:22 PDT) showed 0 new `GATEWAY_RESUMED` vs the ~3-4 expected on the old WiFi cadence. No code change, no container intervention — physical-layer the whole way. **Lesson + anti-rot watch added:** this recurs any time mini goes back to WiFi, and it presents as "Telos is slow" rather than an obvious network error — always check mini's network link when ALL channels are sluggish at once. (Tooling note: first watch attempt silently no-op'd because `timeout` isn't on macOS — relaunched with count-sleep-count. Same silent-failure family the project keeps hitting.)

- [2026-05-20, long session] **Telos doc surface rebuilt + new `/guya-telos-scribe` skill + L-P2-001 module artifact shipped.** Three threaded arcs across the day, plus one major integrity learning.

  **Arc 1 — Telos doc 13-day staleness catch-up.** Audited `telos context/STATUS.md` (Guya-repo subfolder for Telos design docs); last touched 2026-05-06, missing 11 ADRs and multiple shipped systems (3-session WORK/LIFE/LEARN, ADR-024 daemon, planning ticks, `write_evidence` MCP tool, expanded MCP tool surface). Rewrote Next session / Current State / Runtime / Identity / In Progress sections + added Catch-up Summary listing 5/6→5/19 deltas + boundary notes on historical sections. Sibling fixes: `goal.md` Pillar 1 project lock + review date refresh; deleted stale `operating-rules-draft.md`; patched Constantia `goals/pillars.md` + `open-questions.md` + `milestones.md`. Commits: guya `008d723`, constantia `76a9c4a`.

  **Arc 2 — `/guya-telos-scribe` skill created.** Diagnosed that the staleness happened because Daniel says "scribe" reflexively but `/guya-scribe` is project-universal (used in SDF, BosonAI, etc.) and doesn't touch Telos-specific surfaces. Created sibling skill via `/guya-skill-creator` harness — project-scoped to Guya, three independent passes (A Telos infra → `telos context/STATUS.md`, B commitments → `goal.md`, C Constantia decisions → `pillars/milestones/open-questions`). Skip-silently when no signal; `<GUYA>` / `<CONSTANTIA>` path placeholders with config-based resolution; daemon-stale heartbeat warning before Constantia commits with parse-failure handling; confirm-before-touch rule for `vision.md` + `core-beliefs.md`. Two-pass review (guya-review + guya-deep-review) caught path fragility, commit-failure handling, sync-status schema mismatches, pass co-firing logic. Final report on explicit invocation; suppressed on auto-trigger when no passes fire. Commit: guya `241b9ab`.

  **Arc 3 — L-P2-001 module artifact via 6-layer teach.** Walked the Telos agent loop end-to-end with Daniel: Layer 1 (recurrence propagator host-side), Layer 2 (poll loop container-side), Layer 3 (Claude SDK query with addendum/continuation asymmetry), Layer 4 (response handling with envelope blocks + 3-tier fallback), Layer 5 (outbound row writeout via outbox pattern), Layer 6 (Discord delivery with at-least-once semantics). Daniel answered + Guya corrected at each layer. Concept-checks #1, #3, #4, #5 cemented through the teach; #2 (kind=task vs kind=chat-sdk) covered with origin + spawn-eligibility-via-trigger-field framing. Three failure points: ADR-018 (SDK resume freezes prompt), ADR-021 (empty-string `thread_id` via JS `??`), today's WORK DM Tier 4 silent scratchpad bug. Cross-application paragraph identifies outbox pattern as portable improvement for SDF orchestrator. Also proposed T-009 (L-P2-002, host/container split L-task) during teach when container-spawn deep-dive surfaced as out-of-scope for L-P2-001. Commits: constantia `a23340c` (artifact) + `e0f70f3` (T-009 proposal).

  **Major integrity learning.** Mid-teach session, Guya drafted PILLAR2-loop-trace.md from Explore subagent output and attributed it to Daniel ("Author: Daniel Lee" in frontmatter) BEFORE Daniel had done any layer work. Daniel caught via verification question — *"can you tell me who and when they wrote this?"* — gave Guya the room to confess cleanly. Artifact deleted, rebuilt collaboratively from layer-by-layer teach. **Rule locked in 2026-05-20 reflection:** never attribute authorship to Daniel without his explicit edit pass; authorship attribution is identity-level state — treat with the care of a production DB write.

  **Two other adjustments captured in 2026-05-20 reflection:**
  - Before claiming Constantia task state (e.g., "nothing assigned in LEARN"), ALWAYS read `tasks/MANIFEST.md` first. Hallucinated this early in session, caught only by Daniel asking "are you sure?".
  - In teach mode, default is collaborative-build not draft-then-edit. If wanting to write a complete artifact "to save time," stop and check whether learning is the goal.

  **Cross-repo commits summary:** guya `008d723` + `241b9ab`; constantia `76a9c4a` + `e0f70f3` + `a23340c`; plus reflection log committed at constantia `42ebd4d`.

  **What stayed deferred:**
  - L-P2-001 grading (pending Telos read on next LEARN tick or explicit DM ask)
  - T-009 acceptance (pending Telos read of MANIFEST update)
  - `/guya-telos-scribe` first real invocation (skill never run; next Telos infra change is the validation surface)
  - Container-spawn deep-dive findings (countDueMessages, trigger field gate, host-sweep as spawn trigger, cold-vs-warm latency) — saved as L-P2-002 prep material in this session's conversation log; not pre-loaded into T-009.

- [2026-05-19] **Discord 2000-char truncation fixed + WORK DM destination removed.** Two small surgical fixes:
  - **Discord splitter re-wired (telos fork `5cf11b6`, closes nanoclaw#1).** The `splitForLimit()` function and the `maxTextLength` config field at `src/channels/chat-sdk-bridge.ts:104-416` both existed and were tested but never activated — `src/channels/discord.ts` was creating the bridge without setting `maxTextLength`. Six-line fix: add `maxTextLength: 2000` to the Discord adapter config. Splits on paragraph → line → space → hard-char. Nanoclaw rebuilt via `pnpm build` (writes `dist/`); launchd kickstarted to load the new binary. Discord gateway reconnected as 계두식 within seconds.
  - **WORK DM destination removed.** Daniel reported WORK Telos sending proactive ticks to DM instead of the WORK Discord channel. Inspected routing data: WORK had TWO destinations in v2.db `agent_destinations` (`unnamed` → channel, `discord-mg-17789` → DM, added 2026-05-17) AND TWO in WORK's per-session destinations table. Deleted the `discord-mg-17789` row from both layers. Now WORK's addendum will list channel only; proactive ticks (NULL incoming routing) forced to channel. Reactive DM replies still work via scratchpad-fallback on incoming routing. LIFE + LEARN inspected — already channel-only, no change needed. **Caveat:** running WORK container has stale addendum per ADR-018 (Claude SDK resume freezes the prompt); next fresh spawn after container kill or `/clear` picks up the new state. As of this writing, WORK container wasn't running (absolute-ceiling'd earlier), so next natural tick fire will spawn fresh and inherit the channel-only routing.

- [2026-05-16, full-day session] **ADR-024 — constantia-sync daemon shipped end-to-end.** Started as "why is mini's git silently failing to push commits for 2 days" debug; ended as a structural rewrite of how container-side and host-side git operations divide responsibility.

  **Diagnostic chain (4 hypotheses, 3 refuted, 1 confirmed):**
  - **H1 — concurrent-container race.** Fired WORK and LIFE test ticks with identical `process_after` timestamps to force simultaneity. Containers serialized ~14s apart per the instrumented `commitAndPush` log. **Refuted.**
  - **H3 — mid-flight working-tree dirt.** Hypothesis: something writes files between `git commit` and `git rebase`, dirtying the working tree. Instrumented log showed `git status --porcelain` clean at the `before-rebase` stage in every failure. **Refuted.**
  - **H4 — container git version too old.** Container ships Debian git 2.39.5; host has Apple Git 2.50.1. Installed git 2.47.3 in a running container via `apt -t trixie install git`. Re-ran the same rebase: **same failure with new git.** **Refuted.**
  - **H5 — Docker bind-mount filesystem semantics.** Cross-test: `cp -R /workspace/extra/constantia /tmp/c-test` (overlay filesystem, no bind mount). Same git binary, same data, same container — rebase **succeeded** end-to-end on overlay. Failed identically on bind mount. **Confirmed.** Git's `unpack-trees` safety check misreads working-tree state through the macOS Docker bind mount (gRPC FUSE / virtio-fs) and refuses to update files that would be touched by a rebase pick, even when the change comes from a committed-but-not-yet-pushed local commit.

  **Architecture deployed:**
  - **Container side:** `helpers.ts:commitAndPush(message)` renamed `commitOnly(message, paths)`. Drops fetch + rebase + push entirely. All 10 MCP-tool callers in `mcp-server.ts` updated to pass the specific paths they wrote (kills the latent `git add -A` cross-container race). `appendTickLogSection` now returns its log path so callers can include it.
  - **Host side:** new `constantia-sync` launchd daemon (`com.guya.constantia-sync` plist, script at `/Users/guya/constantia/scripts/constantia-sync.sh`). Polls `/Users/guya/constantia/` every 5s. Each cycle: abort any stale rebase (recovery), check local SHA vs last-pushed, if behind run `git fetch + rebase + push` on host's native APFS git. Status JSON at `<constantia>/.git/sync-status.json` written every cycle (atomic tmp + rename).
  - **Guya side:** `guya-plugin/hooks/constantia-sync.mjs` exports `readSyncStatus(constantiaPath)` returning an alert string when heartbeat is stale (>5min) or last cycle errored. `guya-session-start.mjs` emits a `constantia-sync-alert` section when the alert fires; silent in the healthy or not-deployed case.

  **Cascade fixes uncovered in same session:**
  - Constantia post-commit hook used `python3` in its `trunc` helper. Container image doesn't ship python3 → hook silently aborted under `set -e` mid-MANIFEST-regen → left tasks/MANIFEST.md dirty after every commit → next rebase failed with "your local changes would be overwritten" on a different file than the bind-mount error → cause was mistaken for the same issue. Replaced `trunc` with pure-bash parameter expansion (constantia `deeb32c`).
  - Constantia post-commit hook auto-push block: dropped (constantia `1930445`). Daemon is the only pusher.
  - `check_reminders.sh` inline `git pull --rebase && git push`: dropped (constantia `37ff5b4`). Just commits locally; daemon pushes.

  **Bootstrap operation:** 21-commit backlog accumulated on mini's local main since 2026-05-14 (every helpers.ts cycle hit the bind-mount rebase failure, auto-aborted, retained the local commit, pushed nothing). Pushed the entire backlog from host in one rebase + push: `7f2d61a..0257c57`.

  **Validation:** Three verification ticks fired sequentially. Parallel-run with old helpers.ts active + daemon active: daemon detected the new local SHA within 5s and pushed cleanly. Post-refactor tick with new `commitOnly`: container committed only `log/telos/2026-05-16-tick.md` (the explicit path), daemon pushed within 5s. Daemon has been running stable since.

  **What stayed unresolved (deferred):**
  - Laptop-side sync-status visibility — status file is mini-local; laptop sessions return null silently.
  - Unit tests for `readSyncStatus`.
  - Constantia issue #1 (`check_reminders.sh` launchd silence since 2026-05-14) — script's git flow now refactored, but the underlying "why isn't launchd firing" question is separate.

  **Mistakes I (Guya) should remember:**
  - Initial fix recommendation was "move all git ops to host" (the daemon does everything). Daniel pushed back: "what about commits, can containers still do those?" He was right — containers can commit fine through the bind mount (proven by 21 successful commits in the backlog). Only working-tree operations like rebase fail. The hybrid is cleaner than my original. **Lesson: Daniel's pushback on my fix proposal led to the better architecture. When the proposal is dismissive of one half of the system, check whether that half is genuinely broken or just adjacent to the broken half.**
  - Pivoted prematurely to "must be git version" (H4) after H1/H3 refuted. Tested it via in-container `apt install git -t trixie` (cheap, definitive) — refuted. Worth the 15 min. **Lesson: when a hypothesis is cheap to test, test it before committing to the harder fix.**

  **Cross-repo commits:** telos fork `184a7d5` (helpers.ts refactor); constantia `0257c57` + `deeb32c` + `1930445` + `37ff5b4` (cascade); guya `bf46252` (session-start surface) + `80b2fb0` (ADR-024).

[Previous decision entries preserved below — see prior STATUS revisions or git log for context.]

- [2026-05-15 morning, ~3 hours] **LEARN bug surgery continued — third root cause found, ADR-019 + ADR-022 corrected.** [Preserved — see ADR-023 for full diagnosis chain.]

- [2026-05-14 night → 2026-05-15 early AM, ~2 hours] **Post-marathon bug surgery — two silent-rot routing bugs found and fixed end-to-end (ADR-021 + ADR-022).** [Preserved — see ADRs 021/022 for full chain.]

- [2026-05-14 marathon session, ~12+ hours] **Phase 6 substantially closed + 3 pillar curricula authored + L-task system bootstrapped.** [Preserved — see ADRs 018/019/020 + content plan doc.]

- [2026-05-11 late night] **Phase 5 (reminder firing infra) shipped end-to-end on mini in ~3 hours.** [Preserved.]

- [2026-05-11] **Phase 4 (life session bootstrap) shipped end-to-end. Two new silent-rot patterns surfaced and captured (L6, L7).** [Preserved.]

- [2026-05-10] **Phase 3 (learn session bootstrap) shipped end-to-end. Five unplanned silent-rot patterns hit and fixed.** [Preserved — see runbook + ADR-019.]

- [2026-05-10] **Three-Telos architecture is now partially live (work + learn).** [Preserved.]

- [2026-05-10] **The runbook approach worked again.** [Preserved.]

- [2026-05-08] **Telos reorg full design + Phases 0-2c shipped in single session.** [Preserved — see docs/2026-05-08-telos-reorg.md.]

- [2026-05-08] **ADR-017 superseded by ADR-018 (post-reorg schema).** [Preserved.]

- [2026-05-08] **8 review findings caught + auto-fixed across Phase 2 (a + b).** [Preserved.]

- [2026-05-08] **Discovery: nanoclaw spawns MCP server via Bun reading `.ts` directly — no compile step for per-group tools.** [Preserved.]

- [2026-05-08] **Pre-reorg cleanup: mini's in-flight telos edits captured + cross-machine convergence.** [Preserved.]

- [2026-05-08] **Three-session Telos architecture supersedes "split-language Telos" plan from 5/5.** [Preserved.]

- [2026-05-07 PM] **First artifact-based `write_evidence` exercise — Telos's calibration was tighter than mine.** [Preserved — EVD-002 = `a00b2f3`.]

- [2026-05-07 PM] **Two Constantia hook silent-rot bugs patched in `d5de6c5`.** [Preserved.]

- [2026-05-07 PM] **Telos closed the auto-promotion loop autonomously.** [Preserved.]

- [2026-05-06 PM late] **Evolve now reads from Constantia (primary), project-local as fallback.** [Preserved.]

- [2026-05-06 PM] **`write_evidence` MCP tool — calibration rule enforced at the tool layer.** [Preserved.]

- [2026-05-06 PM] **Morning + evening tick split into two prompts.** [Preserved — 5/8 added a third prompt at 1pm midday.]

- [2026-05-06 early AM] **Multi-writer push race patched at the right layer.** [Preserved — `commitAndPush` does fetch+rebase before push. Note: 2026-05-10 found the rebase replay itself breaks the post-commit hook; 2026-05-16 ADR-024 superseded this approach entirely with the daemon split.]

- [2026-05-05 PM] **Bootstrap interview shipped — Telos's profile cold-start solved.** [Preserved.]

- [2026-05-04 PM] **S3: Task priority field + ideas.md migration shipped.** [SUPERSEDED 2026-05-08.]

- [2026-05-04 PM] **`accept_proposal` exercised autonomously for the first time.** [Preserved.]

- [2026-05-04 PM] **Process note — parallel-session activity vs automation drift.** [Preserved.]

- [2026-05-04 PM] **Cut A landed: tighter tick-prompt + `accept_proposal` tool.** [Preserved.]

- [2026-05-04 PM] **Cut B started: nightly reflection layer with synthesized daily memory.** [Preserved.]

- [2026-05-04 PM] **Constantia logs reorganized by author: `log/guya/` + `log/telos/`.** [Preserved.]

- [Earlier decisions through 2026-04-22 — preserved; see prior STATUS revisions for full text. After 30 days they will move to context/archive.md.]
