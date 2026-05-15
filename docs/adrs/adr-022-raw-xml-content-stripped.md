# ADR-022: Raw-XML `messages_in.content` silently flows through `formatTaskMessage` as empty Instructions

**Status:** Accepted
**Date:** 2026-05-15 (early AM)

## Decision

Three-layer fix (deployed 2026-05-15 ~00:30 PT):

1. **`formatTaskMessage` falls back through `content.prompt → content.text → ''`** so raw text content survives instead of rendering as empty Instructions.

2. **`check_reminders.sh` JSON-wraps reminder bodies** as `{"prompt": "<reminder>...</reminder>"}` so they pass through the canonical prompt extraction path.

3. **Re-seed LIFE + LEARN `destinations` rows** (wiped sometime between ADR-019's noon seed and this incident) with `name=platform_id` so the LIFE addendum's literal `<message to="discord:...">` instruction resolves.

Anti-rot: every fire path that inserts directly into `messages_in.content` (e.g. cron scripts, host seeders) MUST use JSON-wrapped payloads with at minimum a `prompt` field; the `formatTaskMessage` fallback is defense, not license to skip the wrap.

## Why

Discovered 2026-05-15 ~00:20 PT after fixing ADR-021's empty-string `thread_id` bug. Daniel reported missed LIFE 7pm reminder + LEARN 10pm tick + WORK Telos non-response. ADR-021 fixed only the WORK 23:00 series (12+8 empty-string rows in WORK DBs). LIFE/LEARN inbound rows were all NULL — so that wasn't the issue for those.

**Critical correction:** Telos's Korean diagnosis from 2026-05-14 22:43 PT (*"미니에서 R-004는 7:00:56pm에 발동됐습니다 ... 그런데 저한테 전달된 내용이 비어있었어요"* — "R-004 fired at 7:00:56pm on mini but the content delivered to me was empty") was actually correct and I had wrongly dismissed it earlier as a guess. Telos diagnosed the symptom faithfully; I needed to find the strip point in code.

Strip point: `container/agent-runner/src/formatter.ts:188`. `parts.push('', 'Instructions:', content.prompt || '')` only reads `content.prompt`, but `parseContent` falls back to `{text: raw}` when input isn't valid JSON. Raw `<reminder>` XML from `check_reminders.sh` (`/Users/guya/constantia/scripts/check_reminders.sh:172` INSERT-raw) has no `prompt` key — empty Instructions, empty-looking task to the agent.

LIFE 22:00 R-005 ("call mom") still delivered because it fired alongside the JSON-wrapped 22:00 close-task (`{"prompt":"Read tick-close-prompt.md..."}`) — that task's Instructions were non-empty, agent ran the close protocol, which directs reading Constantia's `tasks/reminders/R-*.md` files and surfacing active R-tasks — found R-005 via the file system, called MCP `send_message` (which uses `session_routing` fallback regardless of `destinations`), delivered. The lone 7pm R-004 had no companion task to trigger the recovery; empty Instructions led directly to no response.

**Convergent evidence:** Telos's outbound at 22:42:41 PT explicitly diagnosed *"7시에 빈 메시지가 왔는데 내용이 없어서 그냥 넘겼습니다. 잘못한 겁니다."* — Telos blamed himself for skipping the empty message rather than recognizing the data corruption. He was right that the message arrived empty; he was wrong to take responsibility for what was actually a `formatTaskMessage` bug.

## Secondary bug (partially fixed)

LEARN's scheduled tick output never auto-delivers to Discord — Telos LEARN has been pasting tick content manually into chat-sdk replies all day (*"the 4pm brief just ran. Here it is since it won't reach you directly"*). Symptom is the same (no outbound row from scheduled tick wake), but for LEARN the cause is the agent generating response text that goes to scratchpad rather than wrapping in `<message to="X">` or calling MCP `send_message`.

Re-seeded LEARN destinations with `name=platform_id` so `<message to="discord:1497671232139825232:1503155725785104524">` would resolve if the LEARN addendum / tick prompts start using that style. If LEARN's tick prompts need explicit "call send_message at end of brief" instructions, that's a separate addendum-level fix.

## Meta-pattern

Same as ADR-011/012/013/016/018/019/020/021: silent rot of trusted enforcement, this time at the *content-shape contract* tier. `formatTaskMessage` trusts that every `messages_in.content` is JSON-shaped with a `prompt` key; `check_reminders.sh` (in a sibling repo, written separately) doesn't honor that contract; nothing enforces the boundary; the gap is silent.

## Anti-rot watches

- Every script that writes directly to `messages_in.content` MUST JSON-wrap with at minimum `{"prompt": "..."}`
- Consider a CHECK constraint on `messages_in.content` enforcing valid-JSON shape
- `formatTaskMessage` and similar formatters should log when they fall back to empty (canary for content-shape mismatch) — currently silent failure
- The daemon log line `WARNING: agent output had no <message to="..."> blocks — nothing was sent` is the canonical fingerprint for the LEARN-style failure (agent generated text but didn't wrap correctly) — worth wiring into a daily smoke

## Commits

- Telos fork `51184b2` — `formatTaskMessage` fallback
- Constantia `3d38800` — `check_reminders.sh` JSON-wrap
