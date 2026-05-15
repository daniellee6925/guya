# ADR-020: Per-agent docker image tags can silently drift from `:latest` + bulk SQL cleanup pitfall

**Status:** Accepted
**Date:** 2026-05-14

## Decision

Keep per-agent and `:latest` tags pointing to the same image SHA; verify required binaries via container-startup smoke; **never use `docker commit` from a running container** to retag (metadata + runtime FS state issues — use `docker tag` instead).

Also: any bulk SQL cleanup against `messages_in` MUST filter `process_after < datetime('now')` to avoid prematurely completing future-scheduled tick rows.

## Why

Discovered 2026-05-14 13:00-13:30 PT during LEARN 1pm tick regression investigation.

WORK uses per-agent tag `nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40` (built when WORK first deployed in Phase 2 era, with `openssh-client` baked in per Dockerfile line 52). LIFE and LEARN spawn from `nanoclaw-agent-v2-53edea47:latest`, which was rebuilt at some unknown later point WITHOUT `openssh-client`. Result: WORK could push to Constantia via deploy key + SSH; LIFE and LEARN containers wrote commits locally but `git push` failed with `error: cannot run ssh: No such file or directory`.

Bug was silent for ~4 days because nanoclaw's session-memory inheritance + chat-sdk auto-routing meant Discord deliveries kept working — only the Constantia push path was broken, and commits-without-push doesn't surface a user-facing error. Surfaced via container log line `Push failing due to missing ssh in container but commits are going through locally` once /clear stripped the session memory.

## Fix attempts and lessons

(a) `docker build` from mini's Dockerfile blocked by macOS keychain lookup in non-interactive SSH session — Docker Desktop's credsStore queries the keychain on every pull regardless of `DOCKER_CONFIG` override.

(b) Pivot to HTTPS+PAT leaked the PAT twice in git's error output before the redaction pipe could process it (rotated twice; same risk for any future PAT-in-URL flow).

(c) `docker commit` of running WORK container into `:latest` produced an image with subtle metadata issues that prevented `docker run --rm` invocation.

(d) **What worked:** `docker tag nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40 nanoclaw-agent-v2-53edea47:latest` — aliases `:latest` to the working per-agent image SHA. After kickstart, LIFE and LEARN containers respawned from the new `:latest` with `/usr/bin/ssh` present; `git ls-remote` over SSH verified for all three sessions.

## Secondary lesson — bulk UPDATE pitfall

During the same incident I ran `UPDATE messages_in SET status='completed' WHERE kind='task' AND status='pending'` to clean stale ticks. The UPDATE didn't filter by `process_after`, so it marked future-scheduled recurring tasks completed — including today's LEARN 1pm recall task. Nanoclaw inserted a replacement but that replacement was also marked completed without producing Discord outbound. Effect: lost one tick fire.

Future cleanups MUST add `AND process_after < datetime('now')` (or equivalent) to avoid premature-complete of recurring rows.

## Meta-pattern

Same as ADR-011/012/013/016/018/019: silent rot of trusted enforcement — this time at the image-tag tier + the bulk-DB-cleanup tier.

## Anti-rot watches

- Phase 3/4/5+ deploy runbooks add explicit "verify `which ssh && which git` succeed inside the spawned container" step
- Keep per-agent and `:latest` tags re-pointed to same SHA after every image build via `docker tag`
- Avoid `docker commit` from running container for retag operations — always use `docker tag` (or rebuild from Dockerfile) so image metadata stays clean
- Bulk SQL cleanups on `messages_in` must filter on `process_after` to preserve recurring future-scheduled rows
- Daniel-specific: SSH-only mini access blocks docker build (keychain non-interactive prompt); workaround is interactive build at mini terminal or `docker tag` from known-good per-agent image
