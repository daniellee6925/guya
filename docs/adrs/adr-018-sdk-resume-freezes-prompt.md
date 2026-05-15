# ADR-018: Claude SDK `resume` freezes the system prompt; addendum edits require `/clear` to deploy

**Status:** Accepted
**Date:** 2026-05-14

## Decision

Addendum edits to `groups/<session>/CLAUDE.local.md` do NOT propagate to live Telos sessions automatically. `/clear` is the only deploy mechanism for addendum changes.

Pre-`/clear` protocol: ask the agent to synthesize its observations into profile files BEFORE clearing, so anything that lived only in Claude session memory gets promoted to the durable layer.

Long-term direction: move evolving guidance out of the system prompt into an MCP-tool-readable surface (e.g., `read_addendum()` called at the top of every turn) so iteration doesn't require memory wipes.

## Why

Empirically discovered 2026-05-14 after the LIFE addendum scope-clarify fix (commit `6a731d9`, 2026-05-12) failed to change behavior on the live LIFE session despite kickstarting nanoclaw and verifying the addendum on disk on mini.

Daniel observed continued tick-no-response behavior: 6 inbound Discord messages around noon 5/13 all marked `status=completed` with zero outbound DMs, and the 6:01pm transition tick → 6:03pm Daniel reply → silence pattern from earlier (Phase 5 close week) reproduced.

Reading `container/agent-runner/src/providers/claude.ts:273-275` revealed nanoclaw passes BOTH `resume: <continuation>` AND `systemPrompt.append: <addendum>` to Claude Agent SDK on every query. The SDK's `--resume` semantics appear to use the original session's system prompt and ignore subsequent `append` arguments — so addendum edits never reach the running agent.

Confirmed empirically via WORK `/clear` test 2026-05-14 ~12:42 AM PT: same scope-clarify fix shipped to WORK (commit `d1ad1de`), live session continued silent on Daniel's replies, then `/clear` in `#telos-work` returned `Session cleared.`, Daniel sent a casual *"hi telos. whats up"*, and 두식 responded within 60 seconds with substantive Karpathy-engineer engagement — proving (a) the addendum-level fix is correct, (b) /clear is what makes it take effect, (c) durable memory in Constantia survives /clear.

Validated on WORK: work-Telos wrote 4 patterns into `profile/*.md` (constantia commit `227f6a8`) before /clear; fresh session post-clear engaged from the new profile state.

Cost of /clear: loses Claude's conversation continuity but NOT `profile/`, `evidence/`, `log/`, `tasks/`, `goals/` — those live in Constantia.

## Long-term direction

Addendum-via-MCP-tool. Define `read_addendum()` (or similar) that the agent calls at the top of every turn, returning current addendum content from disk. Addendum edits then propagate immediately without /clear. Tradeoff: ~50 tokens/turn re-read cost vs zero deploy friction.

## Meta-pattern

Same as ADR-011/012/013/016: silent rot of trusted enforcement — this time at the SDK-behavior tier. The abstraction we trusted (`systemPrompt.append` on `resume`) silently did something different than expected.

## Anti-rot watch

Every addendum edit requires /clear before claiming deploy is live; verify via fresh-session response test, not by `grep`-ing the file on disk.

## Commits

Three commits land the validated fix across sessions: LIFE `6a731d9`, WORK `d1ad1de`, LEARN `4dbafcf`.
