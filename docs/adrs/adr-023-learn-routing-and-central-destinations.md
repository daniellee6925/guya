# ADR-023: Tick-wake routing context doesn't refresh + central agent_destinations is the durable seed layer

**Status:** Accepted
**Date:** 2026-05-15

## Decision

Two fixes layered together to unblock LEARN tick output:

1. **`poll-loop.ts` pollHandle now refreshes the routing context** when follow-up messages arrive with populated `platform_id`/`channel_type`. The initial `extractRouting()` may have captured a task row's NULL routing; subsequent chat-sdk follow-ups must override so `dispatchResultText`'s scratchpad-fallback can actually deliver.

2. **`agent_destinations` (central, `v2.db`) is the durable seed layer** for per-session destinations — corrects the per-session-INSERT mistake made in ADR-019 and ADR-022 step 3. The host's `writeDestinations()` projection (`src/modules/agent-to-agent/write-destinations.ts:54`) runs on every container wake and `DELETE`s + reinserts the per-session destinations table from central. Manual writes into per-session `destinations` get wiped on next wake.

Also documented: **synthetic `/clear` injection technique** for unblocking stale Claude sessions when the user can't issue `/clear` via the UI. Insert a `chat-sdk` row with `content` `{"text":"/clear"}` + populated routing fields, then `docker kill` the running container so the respawn picks it up in its initial batch (the active-query pollHandle filters out `/clear` from follow-ups per `poll-loop.ts:275`).

## Why — Bug #1: routing context inheritance

Discovered 2026-05-15 mid-morning after LEARN's 10am tick fired but produced no Discord output despite ADR-022's fixes being live (formatter + JSON-wrap). Container logs showed the agent generating substantive responses to Daniel's chat-sdk messages at 10:05 / 10:07:

```
[poll-loop] Result: Here. Did the brief come through?
[poll-loop] [scratchpad] Here. Did the brief come through?
[poll-loop] WARNING: agent output had no <message to="..."> blocks — nothing was sent
```

The agent was producing good output. `dispatchResultText` was supposed to fall back to the inbound message's routing fields when no `<message to=...>` block exists. That fallback at `poll-loop.ts:388-400`:

```typescript
if (sent === 0 && scratchpad) {
  if (routing.channelType && routing.platformId) {
    writeMessageOut({...with routing fields...});
    return;
  }
  ...
}
```

The `routing` object is captured once at `extractRouting(messages)` line 96, from the FIRST message of the wake batch. For LEARN's 10am wake, that was the task row — `platform_id`, `channel_type`, `thread_id` all NULL. So `routing.channelType && routing.platformId` is falsy. The fallback never fires.

When Daniel's chat-sdk messages arrived 5-7 minutes later as follow-ups via the active-query pollHandle (line 263-288), they had real routing fields, but those weren't propagated into the shared `routing` object. The `query.push(prompt)` mechanism feeds new content into the agent, but routing-for-output stays frozen.

There's even a comment at line 270-272 explaining that follow-ups *intentionally* aren't filtered on routing match — but the symmetric problem of "NULL initial + populated follow-up should refresh" wasn't addressed.

## Why — Bug #2: destinations re-seed at wrong layer

The central → per-session projection in `src/modules/agent-to-agent/write-destinations.ts:54`:

```typescript
const db = openInboundDb(agentGroupId, sessionId);
try {
  replaceDestinations(db, resolved);
} finally {
  db.close();
}
```

`replaceDestinations` is `DELETE FROM destinations` + INSERT from central. Called on every container wake from `container-runner.ts`. So per-session destinations is *never* the source of truth — it's a cache projection.

WORK has had a row in central `agent_destinations` (`ag-1777143186174-ykqd40 | unnamed | channel | mg-1777143186175-y1fe2x | ...`) since Phase 2 deploy. That's why WORK's per-session destinations was always populated. LIFE and LEARN never had central rows.

ADR-019's "fix" (INSERT into per-session destinations) at noon 5/14 worked until the next container wake, when projection wiped it. ADR-022 step 3 (re-seed) made the same mistake. LEARN tick output failure 2026-05-15 morning was the third surfacing of this wipe cycle.

## Why — synthetic /clear

Daniel reported he couldn't issue `/clear` via Discord (UI issue). Without `/clear`, the running LEARN Claude session would keep its stale "no destinations configured" addendum and continue believing it can't send messages — even though the destinations table was now populated.

Injecting `/clear` as a `chat-sdk` inbound row works because `poll-loop.ts:105` recognizes the command:

```typescript
if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isClearCommand(msg)) {
  log('Clearing session (resetting continuation)');
  continuation = undefined;
  clearContinuation(config.providerName);
  writeMessageOut({...'Session cleared.' outbound...});
  commandIds.push(msg.id);
  continue;
}
```

`isClearCommand` (`formatter.ts:63`) just checks `content.text.toLowerCase().startsWith('/clear')`.

Gotcha: the active-query pollHandle at line 275 filters /clear OUT of follow-ups (`if (isClearCommand(m)) return false`). Only the INITIAL batch of a fresh wake processes /clear. If the container is already running with an active query, the injected /clear stays pending until the active query ends OR the container is killed and respawned. `docker kill` of the running container forces the daemon to respawn it; the respawn's initial wake picks up the pending /clear in its batch.

Per ADR-019 L7: synthetic test messages without `platform_id`/`channel_type` contaminate session state. Include populated routing fields in the injected row.

## Fix

**Bug #1 patch** in `container/agent-runner/src/poll-loop.ts` pollHandle:

```typescript
if (newMessages.length > 0) {
  const newIds = newMessages.map((m) => m.id);
  markProcessing(newIds);

  // Update routing context from the latest follow-up with populated routing.
  for (const msg of newMessages) {
    if (msg.platform_id && msg.channel_type) {
      routing.platformId = msg.platform_id;
      routing.channelType = msg.channel_type;
      routing.threadId = msg.thread_id || null;
      routing.inReplyTo = msg.id;
    }
  }

  const prompt = formatMessages(newMessages);
  query.push(prompt);
  markCompleted(newIds);
}
```

Mutates the routing object's fields. Same reference flows through `handleEvent` → `dispatchResultText`, so subsequent agent output uses the refreshed routing. Last-write-wins (typically all follow-ups come from the same channel anyway).

Telos fork commit `ce84b19`. Container-side patch deploys via host bind mount; activates on next container respawn.

**Bug #2 fix:** central `agent_destinations` INSERTs for LIFE + LEARN (see ADR-019 correction).

**Synthetic /clear:** documented as operational recipe; not a code change.

## Validation

- LIFE 10am tick fired clean today (was already working via MCP `send_message` + `session_routing` path — doesn't exercise this bug)
- LEARN 10am tick output landed in scratchpad initially (pre-fix)
- After central `agent_destinations` seed + `docker kill` + routing-refresh patch deploy + `/clear` via synthetic injection: LEARN replied to Daniel's test message end-to-end

Five LEARN outbound rows between 11:25 and 11:34 PT 2026-05-15 confirmed delivered to Discord via the `delivered` table.

## Meta-pattern

Same family as ADR-011/012/013/016/018/019/020/021/022 — silent rot of trusted enforcement. This ADR captures THREE simultaneous instances:

- **Bug #1: in-flight routing context tier.** The abstraction we trusted (`routing extracted from initial batch covers all subsequent output`) silently failed when the initial batch had no routing.
- **Bug #2: data layer / source-of-truth tier.** ADR-019 and ADR-022 step 3 trusted the per-session `destinations` table as the seed layer; it's actually a projection cache. Writes to it survive only until the next projection.
- **Operational tier:** the synthetic /clear technique is a workaround for the UI side of the same SDK-resume-freezes-system-prompt problem ADR-018 named. /clear-via-Discord and /clear-via-synthetic-injection are equivalent at the data tier; only the active-query filter (line 275) gates the latter.

## Anti-rot watches

- Any new Telos session bootstrap must INSERT into central `agent_destinations`, never per-session `destinations`. Phase 3 + 4 deploy runbooks need updating.
- The daemon log line `WARNING: agent output had no <message to="..."> blocks — nothing was sent` is now even more load-bearing as a canonical fingerprint — it surfaces both ADR-019-era destinations issues AND ADR-023's routing-refresh issue. Worth wiring into a daily smoke.
- The `routing` object mutation pattern in pollHandle is a defensible but fiddly construct. If `processQuery`'s signature changes (e.g., routing becomes immutable or per-event), the patch needs re-verification.
- Synthetic /clear injection technique should be documented in the operational runbook so future operators know the recipe (insert chat-sdk row with `/clear` + routing + docker kill).

## Commits

- Telos fork `ce84b19` — `poll-loop.ts` routing-refresh patch
- Central DB INSERTs (not in any git repo — mini-local state in `v2.db`). Operational debt: consider migrating to a versioned config / setup-time auto-seed from `groups/<session>/destinations.json`.
