# guya — Status

> Last updated: 2026-05-08 (PT)

## Current Focus

**5/8: Telos reorg — Phase 0 → Phase 2c shipped end-to-end.** Single working session covered the full design (12 decisions, 13 tick prompts, phased plan, content checklist), then implementation Phases 0/1/2a/2b/2c. Telos's work session on mini is now running the new schema with all 12 MCP tools registered and verified via tools/list smoke. **Phase 3 (learn session bootstrap) is the entry point for the next session.** All context for resuming lives in `docs/2026-05-08-telos-reorg.md` (canonical design doc), `docs/2026-05-08-rollback-runbook.md` (per-phase rollback), and `docs/2026-05-08-pre-reorg-state.md` (pre-reorg state snapshot). Read those three first next session.

**What's live now:**
- Constantia schema: `tasks/{proposals,tasks,learn,learn/curricula,reminders,archive/2026-05-07}/`. Plain numeric priority `1|2|3` (supersedes ADR-017's T/P prefix). Per-dir lifecycle enums. Reminder schedule fields are flat (`schedule_type` + `schedule_at`/`schedule_expr`). 4-section MANIFEST. Pre-commit + post-commit hooks deployed both sides (laptop + mini). 17 legacy TASK files archived. Bytebytego curriculum migrated byte-identical.
- Telos work session: tick prompts updated for new schema (9am morning + NEW 1pm midday + 9pm evening + 11pm reflection). 12 MCP tools registered: existing 7 + 5 new (`propose_task`, `assign_learn`, `add_reminder`, `grade_learn`, `read_curriculum`). `acceptProposal` rewritten for target-field routing (task → P-NNN, learn → L-NNN, curriculum → curricula/<id>.md). CLAUDE.local.md tool inventory + Constantia map updated. New 1pm cron row in mini's `inbound.db`. nanoclaw restarted (PID 93397, Discord Gateway reconnected).
- Smoke verified: spawned MCP server with Bun on laptop, tools/list returned all 12 tools with correct new schemas.

**What's NOT yet built (deferred to next session+):**
- **Phase 3** — Learn session bootstrap (new DB, addendum, mounts, web tools, 5 learn-tick crons at 10am/1pm/4pm/7pm/10pm). Mentor/Socratic addendum encodes /guya-learn methodology.
- **Phase 4** — Life session bootstrap (Korean default, 두식 persona, 5 life-tick crons at 10am/12pm/6pm/8pm/11pm).
- **Phase 5** — Reminder firing infra (launchd cron + `check_reminders.sh` polls R files into life inbound.db).
- **Phase 6** — Validation + cutover + ADR-018 entry in CLAUDE.md.
- **Day-2 content seeding** — 14 categories (sections A-N in design doc): pillar 1 project, weekly schedule, R-reminders, first L-task, profile updates, etc.

**Anti-rot watch (carrying forward):** spot-check that Telos's `accept_proposal` calls actually vary `priority` (now numeric 1/2/3) across tasks. Same failure mode as ADR-017's anti-rot — if everything defaults to 2, the field is decoration.

**Next session first read:** `docs/2026-05-08-telos-reorg.md` end-to-end. Then check that the 5/8 9am morning-tick Step 0 evidence promotion fired (verify by `git log` in Constantia ~9am-9:05am 5/8 for any new `evidence(...)` commit). Then: Phase 3 implementation per the plan.

Full Telos state in `telos context/STATUS.md`.

## Recent Changes
- [2026-05-08] guya: 3 new design docs (`docs/2026-05-08-telos-reorg.md`, `2026-05-08-rollback-runbook.md`, `2026-05-08-pre-reorg-state.md`) — uncommitted in working tree
- [2026-05-07] `7f11634` — chore(scribe): record 5/7 PM session — first artifact-based write_evidence + 2 hook silent-rot fixes
- [2026-05-06] `d589953` — feat(evolve): read reflections from Constantia, project-local as fallback
- [2026-05-06] `cffb693` — chore(scribe): write_evidence + tick brief layer + cron split (5/6 PM)
- [2026-05-06] `51f5e85` — chore(scribe): Telos infra hardening night — STATUS catch-up
- [2026-05-05] `ca5ad62` — docs(reflect): 2026-05-05 manual reflection + archival append
- [2026-05-05] `bf25ec8` — chore(scribe): document S3 ship + reflect-prompt bug fix arcs (5/4-5/5 session)
- [2026-05-04 PM] `492d906` — chore(catch-up): scribe pointer + archival append + S1/S2 reflection + STATUS dedupe
- [2026-05-04 PM] `9b08d96` — feat(constantia): task priority field (T/P split) + ideas.md migration + ADR 017 (SUPERSEDED 2026-05-08 — see below)
- [2026-05-04] `3213f21` — chore(scribe): record skill cleanup ship + next-session handoff
- [2026-05-04] `7d0c786` — docs(ideas): demote second-opinion to Tier C, mark S1/S2 shipped
- [2026-05-04] `7ab908b` — docs(status): capture autonomous accept_proposal milestone + parallel-session lesson

**Cross-repo (telos = nanoclaw fork `daniellee6925/nanoclaw`):**
- [2026-05-08] `df6c829` — chore(telos): Phase 2c — work session prompts + addendum updates for new schema
- [2026-05-08] `26fe607` — chore(telos): Phase 2b — acceptProposal rewrite + 5 new MCP tools (propose_task / assign_learn / add_reminder / grade_learn / read_curriculum)
- [2026-05-08] `c0be63f` — chore(telos): Phase 2a — schema migration for assignTask + gradeTask + helpers
- [2026-05-08] `2270de8` — chore(telos): capture in-flight tick prompt + addendum edits before reorg (mini-only edits committed back: Step 0 evidence promotion, Discord splitting rule, ideas.md notes section)
- [2026-05-06 PM] `f6b27ca` — feat(telos): morning + evening tick prompts — structured DM briefs

**Cross-repo (constantia `daniellee6925/constantia`):**
- [2026-05-08] `536522b` — chore(reorg): flatten reminder schedule schema (schedule_type + schedule_expr/at)
- [2026-05-08] `cd6651a` — chore(reorg): Phase 1 — task namespace split + new validator + bytebytego curriculum
- [2026-05-08] `b5b6873` — chore(manifest): sync MANIFESTs with current dir state after rebase (pre-reorg setup)
- [2026-05-07 PM] `d5de6c5` — fix(hooks): unicode-safe truncation + strict-mode array guard
- [2026-05-07 PM] `a00b2f3` — evidence(strength): EVD-002 — first artifact-based evidence entry (Telos)

## In Progress

- [ ] **NEXT SESSION FIRST ACTION — Phase 3 (learn session bootstrap).** Read `docs/2026-05-08-telos-reorg.md` end-to-end first. Phase 3 work: create `/Users/guya/telos/data/v2-sessions/<new-ag-id>/sess-<learn-id>/` with empty inbound.db + outbound.db (or determine if mini's existing two abandoned sessions `sess-1777872447077-gghtt3` / `sess-1777872452965-ngenkk` can be repurposed); add learn session container config in nanoclaw v2 (study mount-allowlist + container.json patterns); drop in learn `CLAUDE.local.md` (Socratic mentor + /guya-learn methodology — full draft in design doc decision 11); add WebSearch + WebFetch tools to learn session's nanoclaw config; add 5 learn-tick crons (10am/1pm/4pm/7pm/10pm with prompts at design doc tick prompts section); boot learn session container; smoke test (manual message + manual 10am trigger to verify Socratic response + paper rec + knowledge-check). Per-phase rollback in `docs/2026-05-08-rollback-runbook.md`.
- [ ] **NEXT SESSION SECOND ACTION — Verify 5/8 morning-tick Step 0 fired.** First test of the auto-promotion loop. Telos should have read 5/7 reflection's `evidence_candidates` at 9am 5/8, promoted artifact-backed ones via `write_evidence`. Verify by `git log` in Constantia for any new `evidence(...)` commit between 9am-9:05am 5/8. If no commit AND no candidates were artifact-backed, that's correct silent behavior. If candidates existed but no commit, debug Step 0 gating. Note: 5/8 9am tick fired against the OLD prompt (before this session's reorg landed); next 9am tick (5/9) uses the new prompt with new schema refs.
- [ ] **NEXT SESSION — Verify 5/8 9pm + 11pm + 5/9 9am ticks fire clean against new schema.** First production run of the new prompts + new tools. Watch for: paths referencing TASK-NNN should be GONE (only P-NNN/T-NNN/L-NNN/R-NNN), priority refs P1/P2/P3 should be GONE (only 1/2/3), `outcome: rejected` should be GONE for tasks (only `abandoned`). If Telos errors out, capture the error and roll back the offending phase per runbook.
- [ ] **Phase 4 — Life session bootstrap.** Same shape as Phase 3 but with Korean default + 두식 persona addendum + 5 life-tick crons (10am/12pm/6pm/8pm/11pm). Daniel's gf is Audrey — addendum mentions her by name. Full addendum draft in design doc decision 11.
- [ ] **Phase 5 — Reminder firing infra.** Write `scripts/check_reminders.sh` in Constantia (~50 LOC: read R-*.md, evaluate schedule + last_fired, insert message into life/inbound.db when due, update last_fired). Install `~/Library/LaunchAgents/com.guya.reminder-fire.plist` on mini (every-minute cron). Smoke test with synthetic R-task at "now+90s" + recurring `* * * * *` (then immediately retire).
- [ ] **Phase 6 — Validation + cutover.** 24-hour observation: all 13 ticks fire across work/learn/life. Day-2 review with Daniel. Add ADR-018 entry to CLAUDE.md pointing to `docs/2026-05-08-telos-reorg.md`. Mark ADR-017 as **superseded by ADR-018**. Update STATUS + ARCHITECTURE.
- [ ] **Day-2 content seeding (14 categories, design doc sections A-N).** Pillar 1 project decision (Daniel↔Telos discussion), weekly schedule populated, 2-3 starter R-reminders (workout, Audrey baseline), first bytebytego L-task assigned, more curricula authored if wanted (DDIA-deep), profile updates, weekly meta-tasks, validator regression tests, log file evidence cleanup. Full checklist in design doc.
- [ ] **Tier 5 — Pillar 1 layered project.** Daniel picks: nanoGPT extended with inference optimizations (fp16 → int8 → KV cache → continuous batching), or rapGPT2.0 progressive optimization. ~1-2 hrs/week, maintenance-mode. Currently parked in design doc as Phase 4 of decisions.
- [ ] **Tier 5 — Pillar 3 stats reactivation.** Schedule Wasserman's "All of Statistics" engagement into weekly plan. Resource acquired but not started.
- [ ] **Tier 5 — Pillar 1 foundations resumption.** Mathematics for ML book continuation (linear algebra → attention from first principles).
- [ ] **ADR-018 in CLAUDE.md.** New scope: post 2026-05-08 reorg (4-namespace task split + 3-session Telos + numeric priority + flat reminder schedule). Old ADR-018 plan was "split-language Telos" — that's now folded into the 3-session design (Phase 4's life chat is the Korean track). Mark ADR-017 as superseded. Pending Phase 6 cutover.
- [ ] **Anti-rot watch (Phase 6+):** spot-check that Telos's `accept_proposal` calls vary `priority` (numeric 1/2/3) across accepts. Same failure mode as ADR-017's anti-rot. If everything defaults to 2, field is decoration.
- [ ] **Watch for `pushError: "Rebase conflict — manual resolution needed on mini"` in Telos DMs.** Pre-existing failure mode (since 5/6's `commitAndPush` patch). Phase 2's 1pm cron addition increases tick count and so multiplies the race window slightly — keep watching.
- [ ] **Tier 4 — Socratic testing tool (`quiz_pillar`).** Was in old plan; maybe folded into `gradeLearn` knowledge-check now. Decide whether still distinct: Phase 6 reflection.
- [ ] **Phase 2 + Phase 3 helpers.ts tests.** Phase 1 (40 pure-function tests) shipped 2026-05-06 (`7d823b3`). Phase 2 = file I/O — now covers more surface (`nextProposalId`, `nextLearnId`, `nextReminderId` collision; `parseFrontmatter` against new schedule_at/expr fields). Phase 3 = git integration. Test debt grew this session (~600 lines new TS, zero new tests). Action item from Phase 2b deep-review.
- [ ] **Validator-extraction follow-up.** Inline validation logic across `assignTask`, `gradeTask`, `acceptProposal`, `proposeTask`, `assignLearn`, `addReminder`, `gradeLearn`, `writeEvidence`, `writeReflection` — each does its own enum/length/conditional checks. With 4 new handlers in Phase 2b, the inline-validation pattern hit 9 instances. Time to extract to `validators.ts`.
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

- [2026-05-08] **Telos reorg full design + Phases 0-2c shipped in single session.** Daniel surfaced 5 blockers preventing effective Telos use: legacy task accumulation, single conflated namespace, sparse 2x-daily tick cadence, undefined Pillar 1, single Telos chat. Single working session locked all design decisions, captured them in `docs/2026-05-08-telos-reorg.md`, then implemented through Phase 2c (work session fully migrated to new schema). 12 design decisions: (1) 4-namespace task split (proposals/tasks/learn/reminders); (2) curricula as durable artifacts; (3) three Telos sessions (work/learn/life); (4) launchd cron + R-files-as-truth for reminder firing; (5) 13 ticks/day rhythm (work 9/1/9, learn 10/1/4/7/10, life 10/12/6/8/11); (6) per-tick prompts; (7) web tools (WebSearch + WebFetch) for Telos; (8) archive-everything legacy migration; (9) inline append-only L-task writeups; (10) live Q&A knowledge-check grading; (11) per-chat CLAUDE.local.md addenda (work=sharp, learn=Socratic+/guya-learn, life=Korean+두식); (12) `goals/weekly-schedule.md` as Daniel-maintained source. Implementation sequence: Phase 0 snapshots (`b5b6873` constantia, `2270de8` telos, `7f11634` guya all tagged `pre-reorg-2026-05-08`); Phase 1 schema (`cd6651a` constantia: 17 archived TASK files + new validator + bytebytego migrated); Phase 1 amendment (`536522b` constantia: flat reminder schedule); Phase 2a (`c0be63f` telos: helpers + assignTask + gradeTask migrated, acceptProposal stubbed); Phase 2b (`26fe607` telos: acceptProposal rewrite + 5 new tools); Phase 2c (`df6c829` telos: 3 prompt updates + new midday prompt + CLAUDE.local.md tool inventory + .gitignore + 1pm cron inserted on mini + nanoclaw restarted). Smoke verified: tools/list returns all 12 tools with correct schemas. **Architectural lesson reinforced:** the design doc + per-phase rollback + state snapshot trio is what made this safe — not just incremental commits. Ability to revert any phase atomically without re-deriving the design from chat history is a structural property of good infra work.

- [2026-05-08] **ADR-017 superseded by ADR-018 (post-reorg schema).** ADR-017 introduced T1-T3 / P1-P3 priority prefix scheme — explicitly designed to force re-grading at proposal acceptance ("don't auto-carry the T value"). New design replaces this with plain numeric `1|2|3` across proposals/tasks/learn (validator-enforced re-grade rule, prefix-as-convention dropped). Reasoning: the prefix theater added cognitive load without preventing the failure (validator enforces re-grade either way). Plain numeric is cleaner; the validator rule "on accept, priority must be explicitly re-set" is the actual anti-rot mechanism. Reminders skip priority entirely. ADR-018 will land in `CLAUDE.md` ADR table at Phase 6 cutover.

- [2026-05-08] **8 review findings caught + auto-fixed across Phase 2 (a + b).** 4 review passes (2× guya-review + 2× guya-deep-review) on the TS work. Two structural bugs were genuine: (1) curriculum overwrite-of-unreadable-file in acceptProposal target=curriculum — broad fs.access catch would swallow EACCES and silently overwrite an existing curriculum file we couldn't read; fixed with ENOENT-only catch. (2) curriculum proposal body wrapped in `## Context` — proposeTask wrapped all target types in a Context section, producing curriculum files that started with "## Context" then the curriculum's own "# Title"; fixed by skipping the wrapper for target=curriculum. Other 6 findings were instances of the same pattern: `try { ... } catch { ... }` swallowing all errors when only ENOENT was the legitimate "not found" case. **Lesson reinforced:** every fs.readFile/fs.access in tool code needs ENOENT-discrimination. Same pattern as helpers.ts nextId fix from Phase 2a. Worth checking the rest of mcp-server.ts (the existing untouched tools) for the same bug class — likely 2-3 more sites.

- [2026-05-08] **Discovery: nanoclaw spawns MCP server via Bun reading `.ts` directly — no compile step for per-group tools.** Only `src/` (nanoclaw core) compiles to `dist/` via `pnpm build`. The MCP server at `groups/telos/tools/mcp-server.ts` is invoked by `bun /workspace/agent/tools/mcp-server.ts` per `groups/telos/container.json`. **Operational consequence:** future Telos tool changes require only push + pull on mini + nanoclaw restart — no `pnpm build` step needed for the tools themselves (only nanoclaw core). Captured in `groups/telos/CLAUDE.local.md` quick map; should be ADR-tracked at Phase 6 cutover.

- [2026-05-08] **Pre-reorg cleanup: mini's in-flight telos edits captured + cross-machine convergence.** Phase 0 surfaced two divergence issues that would have produced silent rot if ignored. (1) Mini's telos repo had 23 lines of uncommitted edits (Step 0 evidence promotion in tick-morning-prompt.md, Discord 2000-char splitting in CLAUDE.local.md, ideas.md notes section) — Telos's autonomous self-modifications that never made it back to the laptop fork. Committed as `2270de8` before reorg started. (2) Constantia's laptop was 1 commit ahead of origin (5/8 lina_platform reflection); mini was at origin. Rebased + pushed + pulled on mini before Phase 1, ensuring all three sides converged at a single SHA before tagging `pre-reorg-2026-05-08`. **Lesson:** before any cross-machine reorg, audit ALL git states (uncommitted edits + push/pull divergence) and converge first. The runbook would have been worthless if pre-reorg-2026-05-08 pointed at different SHAs on different machines.

- [2026-05-08] **Three-session Telos architecture supersedes "split-language Telos" plan from 5/5.** Old plan (deferred ADR-018): English mentor + Korean life-accountability layer in one session, prompted differently per cron. New plan: three separate nanoclaw sessions (work/learn/life), each with its own DB + cron + CLAUDE.local.md addendum. Reasoning: Daniel chose this over routing-within-one-session because the goal is mental context-switching (each chat IS a context switch in the conversation log, not metadata-tagged messages in one stream). Failure-isolated, privacy-isolated (life chat with Audrey context never travels with work chat), and tone-isolated (sharp/Socratic/warm tones won't bleed via prompt drift). Cost: 3x infra surface. Mitigation: shared Constantia handles cross-chat memory propagation automatically (work-Telos writes evidence → life-Telos reads it). Phase 3+4 implementation pending.

- [2026-05-07 PM] **First artifact-based `write_evidence` exercise — Telos's calibration was tighter than mine.** [Preserved from prior STATUS — see archive for full text.] Ship-cadence evidence over 5/4-5/6. Telos chose `strength, tentative` over my proposed `habit, medium`; reasoning was more rigorous (one cited SHA = one demonstrated capability = tentative). EVD-002 = `a00b2f3`.

- [2026-05-07 PM] **Two Constantia hook silent-rot bugs patched in `d5de6c5`.** [Preserved.] Post-commit `cut -c1-60` byte-truncating multi-byte unicode + pre-commit `seen[@]` strict-mode warning. Both fixed in place.

- [2026-05-07 PM] **Telos closed the auto-promotion loop autonomously.** [Preserved.] Step 0 evidence promotion added to morning-tick prompt. First test on 5/8 9am.

- [2026-05-06 PM late] **Evolve now reads from Constantia (primary), project-local as fallback.** [Preserved.]

- [2026-05-06 PM] **`write_evidence` MCP tool — calibration rule enforced at the tool layer.** [Preserved.]

- [2026-05-06 PM] **Morning + evening tick split into two prompts.** [Preserved — note: Phase 2c added a third prompt at 1pm midday.]

- [2026-05-06 early AM] **Multi-writer push race patched at the right layer.** [Preserved — `commitAndPush` does fetch+rebase before push.]

- [2026-05-05 PM] **Bootstrap interview shipped — Telos's profile cold-start solved.** [Preserved — three architectural decisions: split-language Telos (now superseded by 3-session plan), Telos-as-planner contract, calibration rule.]

- [2026-05-04 PM] **S3: Task priority field + ideas.md migration shipped.** [SUPERSEDED 2026-05-08 — ADR-017 prefix scheme dropped in favor of plain numeric. Ship-cadence record preserved as historical context. Original ADR-017 body still in `CLAUDE.md` until ADR-018 explicitly supersedes it.]

- [2026-05-04 PM] **`accept_proposal` exercised autonomously for the first time.** [Preserved.]

- [2026-05-04 PM] **Process note — parallel-session activity vs automation drift.** [Preserved — when working-tree state appears that I didn't initiate, ASK before reverting.]

- [2026-05-04 PM] **Cut A landed: tighter tick-prompt + `accept_proposal` tool.** [Preserved.]

- [2026-05-04 PM] **Cut B started: nightly reflection layer with synthesized daily memory.** [Preserved.]

- [2026-05-04 PM] **Constantia logs reorganized by author: `log/guya/` + `log/telos/`.** [Preserved.]

- [2026-04-22] **Three-identity architecture decided.** [Preserved.]

- [2026-04-22] **Meaningful-only Constantia writes.** [Preserved.]

- [2026-04-22] **Guya proposes tasks, Telos assigns.** [Preserved.]

- [2026-04-23] **Token budget raised 2000→3000.** [Preserved.]

- [2026-04-23] **Growth-tracker stays with Guya, not migrated.** [Preserved.]

- [2026-04-23] **Log filename convention enforced.** [Preserved — extended by 2026-05-04's author-split.]

- [Earlier decisions through 2026-04-09 — see `context/archive.md` if tipped older than 30 days.]
