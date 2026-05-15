# ADR-019: Per-session `destinations` table requires explicit seeding at deploy time

**Status:** Accepted
**Date:** 2026-05-14

## Decision

Phase 3 (LEARN) + Phase 4 (LIFE) deploy runbooks missed this step; bug was masked for ~4 days by session-memory inheritance, surfaced immediately after `/clear`.

Anti-rot: pre-flight verify destinations row count > 0 before declaring any new Telos session deploy complete.

## Why

Discovered 2026-05-14 ~12pm PT during LIFE + LEARN `/clear` validation following ADR-018. Symptom: agents responding normally to Daniel's chat-sdk Discord pings, but cron-fired ticks (kind=`task` inbound) producing scratchpad-only output. Container log explicit: `[poll-loop] WARNING: agent output had no <message to="..."> blocks — nothing was sent`.

Root cause: the per-session `destinations` table in inbound.db was empty for LIFE and LEARN. WORK had it populated from original setup (single row: `unnamed|work|channel|discord|discord:1497671232139825232:1503157287416496242|`).

nanoclaw's `destinations.ts:buildSystemPromptAddendum()` reads this table at container-spawn and injects *"You currently have no configured destinations. You cannot send messages until an admin wires one up."* into the system prompt when empty (line 125, verbatim what Telos diagnosed as the bug back to Daniel).

With that addendum loaded, the agent produces text but never wraps in `<message to="...">` because it doesn't know any destination names; text outside `<message>` blocks is treated as scratchpad per destinations.ts:152 (*"logged but not sent anywhere"*).

For chat-sdk inbound, routing is inherited via `extractRouting()` from the inbound row's `platform_id`/`channel_type`/`thread_id` columns, so outbound delivers without needing a destinations entry. For task inbound (cron-fired ticks), no routing is set on the inbound row, so the agent MUST wrap in `<message to="...">` referencing a destinations entry.

The bug was masked for ~4 days because the agents' Claude session memory inherited successful outbound patterns from prior chat-sdk turns; `/clear` (ADR-018 validation) stripped the session memory and exposed the gap immediately.

## Fix

`INSERT INTO destinations` rows for LIFE + LEARN matching WORK's pattern, then `launchctl kickstart -k` nanoclaw (rebuilds system prompt addendum at container spawn), then `/clear` each session (forces fresh Claude session that reads new addendum). Both sessions confirmed delivering Discord output post-fix.

## Meta-pattern

Same as ADR-011/012/013/016/018: silent-rot of trusted enforcement, this time at the routing-config tier — required setup step missing, system masked the gap via inheritance, `/clear` stripped the mask.

## Operational debt

Destinations table is mini-local (lives in session inbound.db, not in any git repo). If a session DB is recreated, destinations must be re-seeded — this is unmanaged state. Worth migrating to a versioned config or auto-seeding from `groups/<session>/destinations.json` at container spawn.

## Anti-rot watches

- Phase 3 + 4 deploy runbooks now have explicit "verify destinations row count > 0" step
- Consider a daily smoke that grep's nanoclaw's logs for `WARNING: agent output had no <message>` lines — that warning is the canonical fingerprint of this class of bug
- Extend guya-hook-smoke to flag any new session deploy that doesn't include destinations seeding
