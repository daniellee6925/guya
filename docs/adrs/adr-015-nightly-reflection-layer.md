# ADR-015: Nightly reflection layer with read-only session-DB mount

**Status:** Accepted
**Date:** 2026-05-04

## Decision

Two MCP tools shipped together to give Telos a daily synthesized memory tier above the raw tick log:

- `write_reflection` — 8 sections, refuses overwrite, lands at `log/telos/YYYY-MM-DD-reflection.md`
- `read_today_transcript` — opens nanoclaw's `inbound.db` + `outbound.db` read-only via `bun:sqlite`, returns merged-by-timestamp Daniel↔Telos messages for the PT day

The session DBs are mounted read-only at `/workspace/extra/telos-session` via new `additionalMounts` entry; `mount-allowlist.json` updated; daemon kickstarted (allowlist is process-cached).

## Why

Telos needed a daily synthesized memory tier above the raw tick log.

Critical design choice: no transcript persistence in git — Telos reads them, synthesizes, and writes only the *interpreted* reflection. DMs remain ephemeral; the synthesis IS the durable memory.

Cron seeded directly via sqlite INSERT into `messages_in` (id `task-17779308213N-rfltky`, `0 23 * * *`) — deliberately not via Telos self-scheduling so it's automatic from day 0.

The 8 sections borrow from `/guya-reflect`'s shape (what_happened, key_decisions, patterns_observed, what_daniel_should_take_away, what_X_should_change, open_threads) and add Telos-specific evidence_candidates + next_priorities.

The self-accountability section (`what_telos_should_change`) is load-bearing: without it, reflection becomes one-sided observation of Daniel and the agent drifts toward sycophancy with structure.

Lives in fork commit `87d2c4a`.
