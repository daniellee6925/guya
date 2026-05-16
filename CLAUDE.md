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
| 014 | Telos identity injected into nanoclaw system-prompt addendum (not project memory) ([details](docs/adrs/adr-014-telos-identity-addendum.md)) | Salience: system-prompt > project-memory for behavioral overrides |
| 015 | Nightly reflection layer with read-only session-DB mount ([details](docs/adrs/adr-015-nightly-reflection-layer.md)) | Synthesized daily memory tier above raw tick log; transcript stays ephemeral |
| 016 | Constantia log layout split by author: `log/guya/` + `log/telos/` ([details](docs/adrs/adr-016-constantia-log-by-author.md)) | Mirrors architecture's ownership boundary; flat log/ was unscannable |
| 017 | Task `priority` field — split T1-T3/P1-P3 namespaces + `pillar: none` ([details](docs/adrs/adr-017-task-priority-namespaces.md)) | Forces re-grade at acceptance; admits cross-cutting work explicitly |
| 018 | Claude SDK `resume` freezes the system prompt; addendum edits require `/clear` ([details](docs/adrs/adr-018-sdk-resume-freezes-prompt.md)) | SDK ignores `systemPrompt.append` on resume — addendum-via-MCP-tool is long-term direction |
| 019 | Per-session `destinations` table requires explicit seeding at deploy time ([details](docs/adrs/adr-019-destinations-explicit-seeding.md)) | Empty table → "no destinations" addendum → scratchpad-only output for cron ticks |
| 020 | Per-agent docker image tags can drift from `:latest`; bulk SQL cleanup pitfall ([details](docs/adrs/adr-020-image-tag-drift.md)) | Use `docker tag` not `docker commit`; filter `process_after` in bulk UPDATEs |
| 021 | Empty-string `thread_id` in `messages_in` breaks Discord delivery via `??` semantics ([details](docs/adrs/adr-021-empty-string-thread-id.md)) | JS `??` only catches null/undefined; use `||` or write NULL not `''` |
| 022 | Raw-XML `messages_in.content` silently rendered as empty Instructions by formatTaskMessage ([details](docs/adrs/adr-022-raw-xml-content-stripped.md)) | Fallback through `content.prompt → content.text`; JSON-wrap at source |
| 023 | Tick-wake routing inheritance + central `agent_destinations` is the durable seed layer ([details](docs/adrs/adr-023-learn-routing-and-central-destinations.md)) | Routing context must refresh on follow-ups; per-session destinations is a projection cache, not source of truth |
| 024 | Docker bind-mount breaks container-side `git rebase`; host-side `constantia-sync` daemon owns push ([details](docs/adrs/adr-024-constantia-sync-daemon.md)) | Container commits via `commitOnly(message, paths)` on bind mount; host daemon polls every 5s and pushes via native APFS git. Heartbeat in `.git/sync-status.json` surfaces silent-rot risk |

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
