# guya — Status

> Last updated: 2026-05-19

## Current Focus

**Constantia git infrastructure rewrite (ADR-024) shipped + Discord 2000-char truncation fixed + WORK DM destination removed.**

**ADR-024 (2026-05-16)** — Docker bind-mount breaks container-side `git rebase` via `unpack-trees` safety check; refuted three other hypotheses (concurrent race, mid-flight working-tree dirt, container git version) before confirming the bind-mount cause via `cp -R` to overlay-FS comparison. Architecture split: container commits via `commitOnly(message, paths)` in `shared/telos-tools/helpers.ts` (no fetch/rebase/push); host-side `constantia-sync` launchd daemon polls `/Users/guya/constantia/` every 5s and runs fetch + rebase + push on mini's native APFS git. Daemon status surfaces via `<constantia>/.git/sync-status.json` (heartbeat + last-cycle outcome) which Guya's session-start hook reads via `readSyncStatus()` and emits as a `constantia-sync-alert` section when heartbeat is stale or last cycle errored.

**Cascade fixes in same session (2026-05-16):**
- Bootstrap-pushed the 21-commit backlog from host (the silently-accumulating buildup since 2026-05-14).
- Constantia post-commit hook: replaced `python3`-dependent `trunc` helper with pure bash (container image doesn't ship python3 → hook was silently aborting mid-MANIFEST-regen → leaving working tree dirty → next rebase failing on "unstaged changes" instead of the bind-mount error).
- Constantia post-commit hook: dropped auto-push block — daemon owns push.
- `check_reminders.sh`: dropped inline pull/push — daemon owns push.
- 10 MCP tool callers in `mcp-server.ts` updated to pass specific paths to `commitOnly` (kills the latent `git add -A` cross-container race).
- `appendTickLogSection` now returns its log path so callers can include it in commit paths.

**2026-05-19 follow-on work:**
- **Discord 2000-char truncation** (nanoclaw issue #1 closed by `5cf11b6`). The `splitForLimit()` chunker and `maxTextLength` config field at `src/channels/chat-sdk-bridge.ts:104-416` were both present and tested but never activated for Discord — the adapter config in `src/channels/discord.ts` was missing `maxTextLength: 2000`. Six-line fix re-enables the splitter (paragraph → line → space → hard-char). Affects every WORK/LIFE/LEARN brief/reflection that exceeded 2000 chars. Nanoclaw rebuilt + restarted; Discord gateway reconnected cleanly.
- **WORK DM destination removed.** Deleted the `discord-mg-17789` row from central `agent_destinations` in v2.db AND the matching `@me`-pointing row from WORK's per-session destinations table. Result: WORK's proactive ticks (NULL incoming routing) have no DM option in the addendum → forced to channel. Reactive DM replies still work via scratchpad-fallback on incoming routing. LIFE and LEARN inspected — they were already channel-only, no change needed.

**Planning ticks shipped earlier in week (2026-05-16, content plan I.1 closed):** Two new WORK ticks — daily-plan at 22:00 Mon-Sat reading `tick-plan-daily-prompt.md`, weekly-plan at 22:00 Sun reading `tick-plan-weekly-prompt.md`. Both write `goals/today-plan.md`; Sunday tick also rewrites the Week-overrides section of `goals/weekly-schedule.md`. WORK morning tick updated to read `today-plan.md` as authoritative for "the one thing today"; heuristic = fallback. WORK evening tick scoped down from formal-plan ask to a 1-2-candidate tease (10pm tick owns the formal capture).

**State right now:**
- Daemon running on mini (`com.guya.constantia-sync`, PID stable across the past 3 days). Last heartbeat fresh, last push matches origin.
- Three Telos sessions on mini in working state. WORK channel-only for proactive output. LIFE + LEARN unchanged.
- Discord chunker live since 2026-05-19 12:59 PT (post-restart).
- Constantia issue #1 (Discord truncation) closed via `5cf11b6`. Constantia issue #1 (check_reminders silent-rot) still open as the launchd-side investigation — deferred until reminder scheduling activity resumes.

**Anti-rot watches:**
- **Daemon heartbeat is now the single point of trust** for "are commits making it to origin?" Session-start surfaces alert when last_cycle_ts >5min. If the surface itself ever breaks (path drift, etc.), we re-enter the silent-rot family.
- **WORK DM removal is a small, reversible config change** — if proactive ticks start scratchpad-ing instead of posting, the central + per-session rows can be re-inserted from the deleted SQL.
- **Container git remains unreliable for any working-tree mutation** (rebase, checkout, merge, cherry-pick) on bind-mounted constantia. The daemon currently absorbs this risk for rebase only. If a future MCP tool needs `git checkout`/`git merge`/`git cherry-pick` for any reason, it'll hit the same wall — push that work to the host daemon too.
- **`commitOnly([])` (empty paths)** creates an empty commit object — almost certainly a caller bug if it ever happens. Worth a unit-level guard if the function gets new callers.

**Next session first read:**
1. **Daemon status** — `cat /Users/guya/constantia/.git/sync-status.json` on mini, or look for the `constantia-sync-alert` section in this session's `<guya-context>` block.
2. **ADR-024** — full diagnostic chain + fix design at `docs/adrs/adr-024-constantia-sync-daemon.md`.
3. **WORK channel** in Discord — the next WORK tick should post there, not in DM. If it shows up in DM, the destination re-add or addendum-staleness bug is back.

## Recent Changes
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
- [2026-05-19] `5cf11b6` — fix(discord): maxTextLength=2000 re-enables splitter (closes #1)
- [2026-05-16] `184a7d5` — refactor(telos-tools): helpers.ts commitAndPush → commitOnly(message, paths); all 10 MCP callers updated; E1 instrumentation removed
- [2026-05-16] `d67fc13` — feat(work): add 10pm daily + Sunday weekly planning ticks
- [2026-05-15] `ce84b19` — fix(poll-loop): refresh routing context when follow-up messages have populated routing (ADR-023)
- [2026-05-15] `51184b2` — fix(routing): preserve raw rem-row content when not JSON-wrapped (ADR-022)
- [2026-05-14] `4698f79` — fix(routing): treat empty-string thread_id as missing in routing fallbacks (ADR-021)

**Cross-repo (constantia `daniellee6925/constantia`):**
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
- [ ] **NEXT SESSION FIRST READ — daemon health.** Read `/Users/guya/constantia/.git/sync-status.json` on mini (via ssh). If heartbeat >5min or outcome != 'ok'/'no-op', daemon needs attention.
- [ ] **NEXT SESSION SECOND READ — first natural WORK tick post-DM-deletion.** Verify the 9pm evening brief lands in the WORK Discord channel (not DM). If still DM, the addendum is stale and container needs a fresh respawn.
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
