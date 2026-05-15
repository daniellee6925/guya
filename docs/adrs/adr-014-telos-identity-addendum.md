# ADR-014: Telos identity injected into nanoclaw system-prompt addendum (not project memory)

**Status:** Accepted
**Date:** 2026-05-03

## Decision

Patched `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` to read `/workspace/agent/CLAUDE.local.md` and use it as the identity block in the system prompt — replacing the auto "Your name is X" when CLAUDE.local.md is non-empty.

## Why

Project-memory-loaded CLAUDE.local.md was treated as background context by the model; the helper-bot defaults in Claude Code preset + `/app/CLAUDE.md`'s "this file is your memory" framing + the addendum's bold "Your name is X" all won attention. Moving content to system-prompt salience put behavioral rules at the same level as the defaults they need to override.

Marker test confirmed CLAUDE.local.md was loaded in the prompt before the fix — the issue was salience, not absence. Three smoke-tests across two failure modes converged on this diagnosis.

Empty CLAUDE.local.md (composer's default) preserves the auto block — non-breaking for other groups.

Lives in the `daniellee6925/nanoclaw` fork (commit `ae13524`); merge-attention point if upstream `qwibitai/nanoclaw` changes the addendum function. Full operations runbook in `telos context/STATUS.md`.
