# ADR-021: Empty-string `thread_id` in `messages_in` breaks Discord delivery

**Status:** Accepted
**Date:** 2026-05-14 (night)

## Decision

Hand-written `INSERT INTO messages_in` MUST use `NULL` not `''` for missing thread context.

Defense-in-depth fix: routing fallbacks use `||` not `??` at three layers (extractRouting, writeMessageOut, chat-sdk-bridge.deliver/setTyping).

Anti-rot: any future ad-hoc seed script lints for `thread_id = ''` and rewrites to `NULL`; consider a CHECK constraint on `messages_in.thread_id` rejecting empty strings.

## Why

Discovered 2026-05-14 ~23:30 PT debugging Telos delivery failures (LIFE 7pm reminder missing, LEARN 10pm tick missing, WORK Telos not replying). Telos's own Korean diagnosis claimed `<reminder>` content was being stripped between SQLite and the Claude session; the original "wire a destination" diagnosis Daniel got also looked superficially plausible. Both were wrong.

Real root cause traced through 4 layers:

(a) The cron-seeded WORK 23:00 task series (`task-17779308213N-rfltky`, seeded manually per ADR-019) was inserted via raw SQL that supplied `''` (empty string) for `thread_id` where it should have used `NULL`. SQLite's TEXT typing accepts both happily and they look identical in default `sqlite3` CLI output — the only way to tell them apart is `CASE WHEN thread_id IS NULL THEN ... WHEN thread_id = '' THEN ... END`.

(b) `recurrence.ts`'s `Inserted next recurrence` path reads the current row's `thread_id` and copies it forward verbatim — so every daily 23:00 fire (5/12, 5/13, 5/14) inherits the empty string.

(c) Container `extractRouting()` at `container/agent-runner/src/formatter.ts:100` uses `first?.thread_id ?? null` — JavaScript's `??` only catches `null`/`undefined`, NOT empty string. Empty string propagates as-is. Same problem at `writeMessageOut` (`messages-out.ts:72`: `$thread_id: msg.thread_id ?? null`).

(d) Daemon-side `chat-sdk-bridge.ts:354` in `deliver()`: `const tid = threadId ?? platformId` — the load-bearing fallback that's supposed to send to the channel itself when there's no thread context. With empty string flowing through, `tid = ""`, the Discord adapter calls `decodeThreadId("")` which throws `ValidationError: Invalid Discord thread ID:` (note the trailing blank — that's the empty string being interpolated). Three retries fail permanently; outbound row gets `status=failed` in the `delivered` table; user sees nothing.

Bug was masked for ~4 days because chat-sdk-bridge's session-memory inheritance kept replies working through warm sessions; `/clear` (ADR-018 validation) stripped the masking and the failure surfaced. Telos's misdiagnosis was a guess from the observable symptom (`<reminder> content didn't reach me`) — but the formatter never strips reminder tags, and DB inspection showed the content fully intact.

## Fix (deployed 2026-05-14 23:50 PT)

1. **Data UPDATE:** `UPDATE messages_in SET thread_id = NULL WHERE thread_id = ''` (12 inbound rows + 8 outbound rows in WORK session DBs; LIFE/LEARN clean).

2. **Source patch across all three layers:** `?? null` → `|| null` for `thread_id` propagation, `?? platformId` → `|| platformId` for the bridge fallback. Safe because `thread_id` is `string | null`, so the only `||`-catchable values besides `null`/`undefined` are empty strings — no risk of catching numbers or other falsy values. Single fork commit `4698f79` covers all three files.

3. **Daemon rebuilt** via `pnpm build` and kickstarted; verified Discord gateway reconnect clean.

**Container-side patches activate automatically** — `container-runner.ts:301-303` bind-mounts `container/agent-runner/src/` host directory at `/app/src` in the container as read-only, and `exec bun run /app/src/index.ts` runs the TS directly. ADR-020's `docker build` keychain blocker does NOT apply to source-only changes — the Dockerfile comment explicitly says "Source is never baked in — /app/src is provided by a shared read-only bind mount at runtime. Source-only changes never require an image rebuild." So all three patches take effect on next container respawn (auto every ~30min on absolute-ceiling, or sooner on next tick / chat-sdk wake).

## Separate concerns noted

- **LIFE 7pm reminder** had `thread_id = NULL` correctly but produced zero outbound rows; the 10pm reminder with identical schema delivered fine. Difference is agent behavior, not routing infrastructure — fixed in ADR-022.
- **Empty destinations table for LIFE/LEARN** was a third separate concern: the ADR-019 INSERTs got wiped sometime between noon and night 5/14. Doesn't block delivery because `session_routing` + MCP `send_message` provide a fallback path. Re-seeded as part of ADR-022 fix.

## Meta-pattern

Same as ADR-011/012/013/016/018/019/020: silent rot of trusted enforcement — this time at the SQL-typing tier. The abstraction we trusted (`??` "treats absent values as missing") silently failed for empty strings because JS distinguishes empty-string-as-value from null-as-absent.

## Anti-rot watches

- Any future ad-hoc DB seed script must use explicit `NULL` keyword, not `''`
- Consider adding `CHECK (thread_id IS NULL OR thread_id != '')` constraint to `messages_in` schema migration
- The daemon log line `WARNING: agent output had no <message to="..."> blocks — nothing was sent` AND the daemon error log line `ValidationError: Invalid Discord thread ID:` are both canonical fingerprints of this class of bug and worth a daily smoke
