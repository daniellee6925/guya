# Guya — Self-Evolving Personal Agent System

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
| 001 | Hybrid platform (standalone core + Claude Code interface) | Core owns identity; Claude Code provides OMC/hooks/skills |
| 002 | Fully autonomous evolution (no approval gates) | Fastest evolution without friction |
| 003 | Universal scope (all domains, not just coding) | Daniel uses this for everything |
| 004 | Hook-native v1 (plugin + MCP + markdown, no daemon) | Minimal infra; daemon deferred to v2 |
| 005 | Global identity (`~/.claude/guya/`) + project-local memory (`.guya/`) | Recognition in any project + project-specific context |
| 006 | Two-track learning (fast regex heuristics + slow LLM classification) | Immediate corrections + async pattern learning |
| 007 | Challenge first, support second (soul = unconditional care + hard truth) | Named after Daniel's teddy bear — genuine care + growth |
| 008 | Daniel-specific amendments (convergence tracking, custom SCOPE domains, teaching, emotional awareness) | Generic agent behavior doesn't serve Daniel's growth needs |

Full plan: `.omc/plans/guya-architecture.md`

## Research Foundations

Architecture synthesizes ideas from: Letta/MemGPT (three-tier memory), EvolveClaw (SCOPE classification), Reflexion (verbal reinforcement), OpenClaw (identity system), OMC (agent orchestration), claude-mem (cross-session persistence). Full research notes in `.guya/memory/archival/guya.md`.

## Current Status

- [x] Project created (2026-03-30)
- [x] Deep research: OMC, claude-mem, OpenClaw, EvolveClaw, Letta, Reflexion, LATS, AutoClaw, Claude SDK
- [x] Key decisions: Hybrid platform, fully autonomous evolution, universal scope
- [x] Architectural synthesis complete
- [x] CLAUDE.md created
- [x] Architecture design — ralplan consensus (Planner → Architect R1 ITERATE → Critic R1 REVISE → R2 revisions → Architect R2 APPROVE → Critic R2 ACCEPT). Full plan: `.omc/plans/guya-architecture.md`
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
- Use `.omc/` for OMC integration state, `guya/` for Guya's own state
