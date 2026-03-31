# Guya — Self-Evolving Personal Agent System

> A universal, fully autonomous, self-evolving personal AI agent that grows and personalizes to its user across every domain of life.

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

## Architecture Decision Record

### ADR-001: Platform Choice — Hybrid (2026-03-30)
**Decision**: Core identity/evolution engine lives standalone. Claude Code is the primary interaction interface.
**Why**: Standalone core owns identity and evolution (survives tool changes). Claude Code provides the best current agent execution environment (OMC, hooks, skills).
**Rejected**: Pure Claude Code plugin (too coupled), Pure standalone (loses OMC orchestration power).

### ADR-002: Evolution Mode — Fully Autonomous (2026-03-30)
**Decision**: Guya observes, learns, classifies, and injects behavioral guidelines without human approval.
**Why**: Daniel wants a system that evolves as fast as possible without friction.
**Rejected**: Observe + suggest (slower evolution), Manual + assisted (too much user overhead).

### ADR-003: Scope — Universal (2026-03-30)
**Decision**: Guya handles everything — not just coding. Life management, decisions, communication, research, learning, all domains.
**Why**: Daniel plans to use this agent for literally everything.

## Research Foundations

### Systems Studied (2026-03-30)

**oh-my-claudecode (OMC) v4.9.1** — Installed, deeply explored.
- 19 specialized agents with model tiering (haiku/sonnet/opus)
- 30+ composable skills with layered composition (Execution + Enhancement + Guarantee)
- 31 hooks for lifecycle event interception
- Team pipeline: plan → prd → exec → verify → fix loop
- PRD-driven execution (Ralph) with story-by-story verification
- State: `.omc/state/`, notepad, project memory
- Source: `~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.1/`

**claude-mem v10.6.3** — Installed, deeply explored.
- Cross-session persistent memory via SQLite + MCP server
- Tree-sitter AST parsing (Go, Python, Java, Rust, TS, JS, C, C++, Ruby)
- Timeline tracking with timestamped observations
- Background worker for async processing
- Context injection via hooks at session start
- Source: `~/.claude/plugins/cache/thedotmack/claude-mem/10.6.3/`

**OpenClaw** — Cloned to `/tmp/openclaw/`, deeply explored.
- Identity system: SOUL.md (persona/tone/boundaries), IDENTITY.md (name/vibe/emoji), USER.md (human profile), AGENTS.md, TOOLS.md, HEARTBEAT.md, BOOT.md, BOOTSTRAP.md
- Memory: `MEMORY.md` (long-term) + `memory/YYYY-MM-DD.md` (daily notes)
- SQLite backend with BM25 keyword + vector hybrid search
- Automatic memory flush before context compaction
- Skills: Directory-based with SKILL.md, ClawHub marketplace
- Workspace = agent's home, git-backed, private
- "You're not a chatbot. You're becoming someone."

**EvolveClaw** — Researched via web.
- SCOPE pipeline: Observe → Classify → Synthesize → Inject → Forget
- Confidence-gated persistence: ≥ 0.85 confidence → strategic (permanent), else tactical (ephemeral)
- Eight domains: tool_usage, code_quality, error_handling, communication, user_preferences, context_awareness, workflow, general
- Async synthesis (never blocks user interaction)
- Consolidation: merge similar rules, prune subsumed, resolve conflicts via LLM
- Tactical clears on reset; strategic persists to `./scope_data/*.json`
- Source: github.com/JarvisPei/EvolveClaw

**Letta (MemGPT)** — Researched via web.
- OS-inspired: context window = RAM, external storage = disk
- Three-tier memory: Core (in-context, self-editable), Recall (conversation history), Archival (vector/graph DB)
- Agent manages its own memory via tool calls: memory_replace, memory_insert, memory_rethink
- Sleep-time agents consolidate memory between sessions
- Persona block = identity anchor, editable by agent
- Source: github.com/letta-ai/letta

**Reflexion** — Researched via papers.
- Verbal reinforcement learning: fail → reflect → append to episodic memory → retry
- Triadic: Actor → Evaluator → Self-Reflector
- Sliding window eviction for forgetting
- NeurIPS 2023, arXiv 2303.11366

**LATS** — Researched via papers.
- Reflexion inside Monte Carlo Tree Search
- UCT selection: V(s) + w * sqrt(ln N(parent) / N(s))
- Hybrid value: λ * LM(s) + (1-λ) * SC(s)
- Explores multiple trajectories simultaneously
- ICML 2024, arXiv 2310.04406

**AutoClaw** — Researched via web.
- Token economy as evolutionary selection pressure
- Execute → Analyze → Generate Skill → Test → Deploy
- External AI generates improvements (avoids self-referential limits)
- 70% creator / 20% agent / 10% network revenue split

**Claude Agent SDK** — Researched via web.
- Orchestrator-subagent hierarchy with isolated context windows
- No built-in self-improvement — application responsibility
- Programmatic tool orchestration moves control flow from NL to code
- Multi-agent Opus lead + Sonnet subagents outperformed single Opus by 90.2%

### Architectural Synthesis (2026-03-30)

The recommended architecture layers:
1. **Letta-style memory management** (core/archival/recall with self-editing tools) as the memory foundation
2. **EvolveClaw's SCOPE classification** (tactical vs strategic, confidence-gated persistence) as the learning engine
3. **Reflexion's verbal reinforcement** as a post-task reflection hook
4. **OpenClaw's identity system** (SOUL.md, IDENTITY.md, USER.md) as the identity scaffold
5. **OMC's agent orchestration** (tiered agents, composable skills, hooks) as the execution engine
6. **claude-mem's cross-session persistence** as the storage backbone

## File Structure

```
guya/
├── CLAUDE.md                    # This file — project context and decisions
├── soul.md                      # Guya's personality, values, voice (OpenClaw-inspired)
├── creed.md                     # Guya's core principles and commitments
├── identity.md                  # Guya's name, vibe, avatar
├── user.md                      # Daniel's profile (built over time)
├── agents/                      # Agent definitions
├── skills/                      # Skill definitions
├── memory/                      # Memory system
│   ├── core/                    # In-context core memory blocks
│   ├── archival/                # Long-term knowledge store
│   ├── daily/                   # Daily observation logs (YYYY-MM-DD.md)
│   └── reflections/             # Post-task verbal reflections
├── evolution/                   # Self-evolution engine
│   ├── scope/                   # SCOPE pipeline (observe/classify/inject)
│   ├── guidelines/              # Learned behavioral guidelines
│   │   ├── strategic/           # Permanent cross-session guidelines
│   │   └── tactical/            # Ephemeral per-session guidelines
│   └── traces/                  # Interaction traces for analysis
├── config/                      # Configuration
├── hooks/                       # Lifecycle hooks
├── tools/                       # Custom tools
└── docs/                        # Extended documentation
    ├── architecture.md          # Full architecture document
    ├── decisions/               # Detailed ADRs
    └── research/                # Research notes and references
```

## Current Status

- [x] Project created (2026-03-30)
- [x] Deep research: OMC, claude-mem, OpenClaw, EvolveClaw, Letta, Reflexion, LATS, AutoClaw, Claude SDK
- [x] Key decisions: Hybrid platform, fully autonomous evolution, universal scope
- [x] Architectural synthesis complete
- [x] CLAUDE.md created
- [ ] Architecture design (detailed)
- [ ] soul.md, creed.md, identity.md, user.md
- [ ] Core memory system implementation
- [ ] Evolution engine (SCOPE pipeline)
- [ ] Agent definitions
- [ ] Skill definitions
- [ ] Hook system
- [ ] Integration with Claude Code
- [ ] Bootstrap ritual (first-run experience)

## Development Guidelines

- Follow LLM-Oriented Design Patterns from global CLAUDE.md (max 800 LOC, one file one responsibility, calling specs, etc.)
- TypeScript for standalone components, markdown for identity/memory/skills
- Every architectural decision gets an ADR entry in this file
- Every session should update the "Current Status" section before ending
- Use `.omc/` for OMC integration state, `guya/` for Guya's own state
