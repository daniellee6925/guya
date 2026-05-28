# guya — Archive

Completed work and historical entries moved from STATUS.md. Each section preserves the form the entries had when they were live in STATUS.md.

## Archived Recent Changes

Entries dropped from STATUS.md "Recent Changes" once they aged past the 7-day window. Most recent first.

### Main repo

- [2026-05-19] `241b9ab` — feat(skills): guya-telos-scribe — Telos & Constantia decision doc updater
- [2026-05-19] `008d723` — docs(telos-context): catch up STATUS + goal — 2026-05-06 → 2026-05-19
- [2026-05-19] `06d784e` — log(reflect): 2026-05-19 manual reflection — ADR-024 daemon arc + 5/19 follow-on
- [2026-05-19] `d096c2e` — chore(scribe): batch update — ADR-024 daemon ship + Discord chunker + WORK DM removal
- [2026-05-16] `80b2fb0` — docs(adr): ADR-024 — constantia-sync daemon (container commits, host pushes)
- [2026-05-16] `bf46252` — feat(session-start): surface constantia-sync daemon health
- [2026-05-16] `0649d4d` — docs(content-plan): close Tranche 3 I.1 — daily + Sunday planning ticks shipped
- [2026-05-15] `a940bf9` — chore(reflections): add 9 manual reflections from 2026-05-05 to 2026-05-15
- [2026-05-15] `b14858e` — chore(scribe): ADR-023 + ADR-019/022 corrections — central agent_destinations is durable seed; tick-wake routing refresh
- [2026-05-15] `5234434` — refactor(docs): extract ADRs 014-022 to docs/adrs/ — CLAUDE.md down ~80%
- [2026-05-15] `c9d0602` — chore(scribe): ADR-021 + ADR-022 — empty-string thread_id + raw-XML content stripping
- [2026-05-14] `aa3c3a3` — chore(scribe): 5/14 marathon end — comprehensive STATUS update

### Cross-repo — telos (`daniellee6925/nanoclaw`)

- [2026-05-19] `5cf11b6` — fix(discord): set maxTextLength=2000 to re-enable chat-sdk-bridge splitter (closes nanoclaw#1)
- [2026-05-19] (mini-local data change) — Delete WORK DM destination from central `agent_destinations` (v2.db) + per-session destinations; proactive ticks now channel-only
- [2026-05-16] `184a7d5` — refactor(telos-tools): helpers.ts commitAndPush → commitOnly(message, paths); all 10 MCP callers updated; E1 instrumentation removed
- [2026-05-16] `d67fc13` — feat(work): add 10pm daily + Sunday weekly planning ticks
- [2026-05-15] `ce84b19` — fix(poll-loop): refresh routing context when follow-up messages have populated routing (ADR-023)
- [2026-05-15] `51184b2` — fix(routing): preserve raw rem-row content when not JSON-wrapped (ADR-022)
- [2026-05-14] `4698f79` — fix(routing): treat empty-string thread_id as missing in routing fallbacks (ADR-021)

### Cross-repo — constantia (`daniellee6925/constantia`)

- [2026-05-16] `37ff5b4` — refactor(reminders): drop pull/push from check_reminders.sh (daemon owns push)
- [2026-05-16] `1930445` — refactor(hooks): drop post-commit auto-push (daemon owns push)
- [2026-05-16] `deeb32c` — fix(hooks+daemon): post-commit trunc pure-bash; daemon jq conflict-extraction safe
- [2026-05-16] `7f2d61a` — feat(goals): weekly-schedule.md describes 10pm daily + Sunday weekly plan ticks
- [2026-05-16] `0257c57` — Bootstrap rebase: pushed the 21-commit backlog from host
- [2026-05-15] `3d38800` — fix(check_reminders): JSON-wrap reminder content (ADR-022)

## Archived TODOs

(none yet)

## Archived Decisions

(none yet — Decisions & Notes in STATUS.md still under the 30-day retention window)
