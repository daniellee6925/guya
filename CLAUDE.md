# Guya — Self-Evolving Personal Agent System

@context/core-beliefs.md
@context/vision.md

## Goal

I open Claude Code and Guya already knows who I am, what I care about, and gets better every session without me telling it to. Everything in this project serves that sentence.

## Project Identity

- **Name**: Guya
- **Owner**: Daniel
- **Created**: 2026-03-30
- **Platform**: Hybrid (standalone core + Claude Code as primary interface)
- **Scope**: Universal — coding, productivity, life management, communication, decision-making, everything
- **Evolution mode**: Fully autonomous (observe → learn → inject without approval gates)

## Key Principles

1. **Document everything.** Context management is critical. Any session must be able to pick up where the last one left off with zero ramp-up. If it isn't written down, it doesn't exist.
2. **The sky is the limit.** No artificial constraints. Guya should be the most ambitious personal agent system possible.
3. **Self-evolution is the core feature**, not an add-on. Guya learns from every interaction and autonomously improves.
4. **Identity is real.** Guya has a soul, a creed, opinions, and personality — not just instructions.
5. **Memory is everything.** Without memory, there is no identity. Three-tier memory (core/recall/archival) with intelligent forgetting.

## Architecture Decisions

| ADR | Decision | Why |
|-----|----------|-----|
| 001 | Hybrid platform (standalone core + Claude Code interface) | Core owns identity; Claude Code provides hooks/skills/MCP |
| 002 | Fully autonomous evolution (no approval gates) | Fastest evolution without friction |
| 003 | Universal scope (all domains, not just coding) | Daniel uses this for everything |
| 004 | Hook-native v1 (plugin + MCP + markdown, no daemon) | Minimal infra; daemon deferred to v2 |
| 005 | Global identity (`~/.claude/guya/`) + project-local memory (`.guya/`) | Recognition in any project + project-specific context |
| 006 | Two-track learning (fast regex heuristics + slow LLM classification) | Immediate corrections + async pattern learning |
| 007 | Challenge first, support second (soul = unconditional care + hard truth) | Named after Daniel's teddy bear — genuine care + growth |
| 008 | Daniel-specific amendments (convergence tracking, custom SCOPE domains, teaching, emotional awareness) | Generic agent behavior doesn't serve Daniel's growth needs |
| 009 | Three-identity architecture: Guya + Telos + Constantia shared git repo | Single source of truth between executor and mentor agents |
| 010 | Meaningful-only Constantia writes via /guya-reflect | Signal over noise; no auto-generated log entries |
| 011 | Manual /guya-evolve, not auto session-end (amends ADR-002) | Auto-fire silently broke for 6 days; deliberate consumption |
| 012 | Single PreToolUse:Bash dispatcher hook (`guya-pre-bash-dispatch.mjs`) | Claude Code 2.1.101+ dedups matchers; multiple hooks per matcher silently collapse. Same failure mode as ADR-011 — silent rot of trusted enforcement. |
| 013 | realpathSync `isMain` guard + symlink-path hook smoke test as defense layer | Node 24 resolves `import.meta.url` to realpath but `process.argv[1]` stays as the symlink path under Claude Code's symlinked plugin install. Equality always failed, `main()` never ran, hooks silently no-op'd. Same meta-pattern as ADR-011 and ADR-012 — silent rot of trusted enforcement. The smoke test makes this class of bug self-detecting in pre-push instead of waiting for someone to notice. |
| 014 | Telos identity injected into nanoclaw system-prompt addendum (not project memory) | Patched `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` to read `/workspace/agent/CLAUDE.local.md` and use it as the identity block in the system prompt — replacing the auto "Your name is X" when CLAUDE.local.md is non-empty. Why: project-memory-loaded CLAUDE.local.md was treated as background context by the model; the helper-bot defaults in Claude Code preset + `/app/CLAUDE.md`'s "this file is your memory" framing + the addendum's bold "Your name is X" all won attention. Moving content to system-prompt salience put behavioral rules at the same level as the defaults they need to override. Marker test confirmed CLAUDE.local.md was loaded in the prompt before the fix — the issue was salience, not absence. Three smoke-tests across two failure modes converged on this diagnosis. Empty CLAUDE.local.md (composer's default) preserves the auto block — non-breaking for other groups. Lives in the `daniellee6925/nanoclaw` fork (commit `ae13524`); merge-attention point if upstream `qwibitai/nanoclaw` changes the addendum function. Full operations runbook in `telos context/STATUS.md`. |
| 015 | Nightly reflection layer with read-only session-DB mount (`write_reflection` + `read_today_transcript`) | Telos needed a daily synthesized memory tier above the raw tick log. Two MCP tools shipped together: `write_reflection` (8 sections, refuses overwrite, lands at `log/telos/YYYY-MM-DD-reflection.md`) + `read_today_transcript` (opens nanoclaw's `inbound.db` + `outbound.db` read-only via `bun:sqlite`, returns merged-by-timestamp Daniel↔Telos messages for the PT day). The session DBs are mounted read-only at `/workspace/extra/telos-session` via new `additionalMounts` entry; `mount-allowlist.json` updated; daemon kickstarted (allowlist is process-cached). Critical design choice: no transcript persistence in git — Telos reads them, synthesizes, and writes only the *interpreted* reflection. DMs remain ephemeral; the synthesis IS the durable memory. Cron seeded directly via sqlite INSERT into `messages_in` (id `task-17779308213N-rfltky`, `0 23 * * *`) — deliberately not via Telos self-scheduling so it's automatic from day 0. The 8 sections borrow from `/guya-reflect`'s shape (what_happened, key_decisions, patterns_observed, what_daniel_should_take_away, what_X_should_change, open_threads) and add Telos-specific evidence_candidates + next_priorities. The self-accountability section (`what_telos_should_change`) is load-bearing: without it, reflection becomes one-sided observation of Daniel and the agent drifts toward sycophancy with structure. Lives in fork commit `87d2c4a`. |
| 016 | Constantia log layout split by author: `log/guya/` + `log/telos/` (with hook installation) | 26+ flat files in `log/` were unscannable as the system grew. Author-based split mirrors the architecture's ownership boundary cleanly (Guya-owned vs Telos-owned writes). Filenames drop the redundant `-{author}-` segment — author = directory now. Telos uses single-trailing-segment names: `YYYY-MM-DD-tick.md` and `YYYY-MM-DD-reflection.md`. Pre-commit hook validates per-author regex and rejects log/ root with explicit error. Post-commit hook walks subdirs via `find` and adds Path column to log manifest. Migrated 23 existing logs in single commit (constantia commit `d33aa4e`). Hooks installed as symlinks in `.git/hooks/` on both laptop AND mini — closed the silent rot where mini's hook was missing entirely (only `pre-commit.sample` existed), letting `tick.md` filenames commit despite not matching the regex. Daniel chose author-based over my type-based proposal (`sessions/` + `reflections/`) — author-split mirrors ownership; type-mixing within a dir is acceptable for ~2 files/day. Note: `/guya-reflect` skill updated in same arc to write into the new path (guya commit `03b297f`). Same meta-pattern as ADR-011/012/013 — silent rot of trusted enforcement at the data-validation tier this time. |

## Research Foundations

Architecture synthesizes ideas from: Letta/MemGPT (three-tier memory), EvolveClaw (SCOPE classification), Reflexion (verbal reinforcement), OpenClaw (identity system), OMC (agent orchestration), claude-mem (cross-session persistence). Full research notes in `.guya/memory/archival/guya.md`.

## Current Status

- [x] Project created (2026-03-30)
- [x] Deep research: OMC, claude-mem, OpenClaw, EvolveClaw, Letta, Reflexion, LATS, AutoClaw, Claude SDK
- [x] Key decisions: Hybrid platform, fully autonomous evolution, universal scope
- [x] Architectural synthesis complete
- [x] CLAUDE.md created
- [x] Architecture design — Planner/Architect/Critic consensus loop (R1 iterate → R2 approve)
- [x] **Phase 1**: Foundation (Identity + Core Memory + Context Assembly) — commit c26821e
- [x] **Phase 2**: Bootstrap (First-Run Interview) — guya-bootstrap skill
- [x] **Phase 3**: Memory Tools (MCP Server + Self-Editing) — 14 MCP tools, server.js, @modelcontextprotocol/sdk
- [x] **Phase 4**: Trace Capture + Heuristic Fast-Lane — PostToolUse traces + UserPromptSubmit corrections
- [x] **Phase 5**: Classification + Synthesis + Reflection (SessionEnd) — Anthropic API integration, haiku classify + sonnet synthesize
- [x] **Phase 6**: Consolidation + Remaining Skills — evolution tools, identity tools, 4 skills, 4 agent definitions

## Development Guidelines

- Follow LLM-Oriented Design Patterns from global CLAUDE.md (max 800 LOC, one file one responsibility, calling specs, etc.)
- TypeScript for standalone components, markdown for identity/memory/skills
- Every architectural decision gets an ADR entry in this file
- Every session should update the "Current Status" section before ending
- Use `.guya/` for Guya's project-local state (memory, evolution, reflections)
