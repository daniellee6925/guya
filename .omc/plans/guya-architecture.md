# Guya Architecture Plan — Self-Evolving Personal Agent System

**Created**: 2026-03-30
**Status**: REVISED (R2) — Architect R1 + Critic R1 feedback incorporated
**Complexity**: HIGH
**Scope**: ~45 files across 9 directories

---

## Context

Daniel wants a personal agent ("Guya") that runs inside Claude Code, recognizes him instantly, learns from every interaction without being told to, and gets better every session autonomously. The system integrates with existing OMC v4.9.1 (agent orchestration, hooks, skills) and claude-mem v10.6.3 (SQLite persistence, observations, session summaries). Architecture draws from Letta (three-tier memory), EvolveClaw SCOPE (observe-classify-synthesize-inject-forget), Reflexion (verbal reinforcement), and OpenClaw (identity files).

---

## 1. System Components

### 1.1 Component Map

```
+------------------------------------------------------------------+
|                     Claude Code Session                           |
|                                                                   |
|  +------------------+    +------------------+   +--------------+  |
|  | Identity Layer   |    | Memory Layer     |   | Evolution    |  |
|  | soul.md          |    | Core (in-ctx)    |   | Engine       |  |
|  | creed.md         |<-->| Recall (SQLite)  |<--| SCOPE pipe   |  |
|  | identity.md      |    | Archival (md)    |   | Guidelines   |  |
|  | user.md          |    +------------------+   | Reflections  |  |
|  +------------------+            |              +--------------+  |
|          |                       |                     |          |
|  +-------v-----------------------v---------------------v-------+  |
|  |                    Integration Layer                         |  |
|  |  SessionStart hook -> context assembler -> system-reminder   |  |
|  |  PostToolUse hook -> trace capture + heuristic fast-lane     |  |
|  |  SessionEnd hook -> LLM classify + synthesize + reflect      |  |
|  |  PreCompact hook -> memory flush to archival                 |  |
|  +-------------------------------------------------------------+  |
|          |                       |                     |          |
|  +-------v-----------+  +-------v---------+  +--------v-------+  |
|  | OMC v4.9.1        |  | claude-mem      |  | Guya Tools     |  |
|  | Agents/Skills     |  | v10.6.3         |  | (MCP server)   |  |
|  | Hooks engine      |  | SQLite          |  | memory_*       |  |
|  +-------------------+  +-----------------+  | evolve_*       |  |
|                                              +----------------+  |
+------------------------------------------------------------------+
```

### 1.2 Storage Split (Cross-Project Portability)

Guya uses **two storage locations** to enable instant recognition in any project:

| Location | Contents | Scope |
|----------|----------|-------|
| `~/.claude/guya/` (user-scoped) | `soul.md`, `creed.md`, `identity.md`, `user.md`, `guidelines/strategic/`, `config/` | Global — works in every project |
| `.guya/` (project-local) | `memory/core/`, `memory/archival/`, `memory/daily/`, `memory/reflections/`, `evolution/traces/`, `evolution/guidelines/tactical/` | Project-specific context |

The SessionStart hook reads from both locations. Global identity + guidelines are always present. Project-local memory provides context for the current project.

### 1.3 Component Responsibilities

| Component | Responsibility | Storage |
|-----------|---------------|---------|
| Identity Layer | Guya's personality, values, voice, commitments | `~/.claude/guya/` (soul.md, creed.md, identity.md, user.md) |
| Core Memory | Always-loaded context: Daniel's profile, active projects, current priorities | `.guya/memory/core/*.md` (assembled into system-reminder) |
| Recall Memory | Conversation history, session summaries, temporal search | claude-mem SQLite (read-only from Guya) |
| Archival Memory | Long-term knowledge, domain expertise, project histories | `.guya/memory/archival/*.md` (semantic search via keyword matching) |
| Evolution Engine | SCOPE pipeline: observe traces, classify, synthesize guidelines, inject, consolidate | `.guya/evolution/` + `~/.claude/guya/guidelines/strategic/` |
| Integration Layer | Hooks that wire everything together at session lifecycle points | Guya hooks registered in `.claude/settings.local.json` |
| Guya Tools | MCP tools for agent to self-edit memory, trigger evolution, manage identity | MCP server process |

---

## 2. Memory Architecture

### 2.1 Three-Tier Design (Letta-inspired)

**Tier 1 — Core Memory (In-Context, Always Loaded)**

Purpose: The subset of knowledge that must be present in every single prompt. Guya's "working memory."

Format: Markdown blocks assembled into a system-reminder at session start.

```
.guya/memory/core/
├── daniel-profile.md      # Name, role, preferences, communication style
├── active-projects.md     # Current projects with status and priorities
├── active-guidelines.md   # Top strategic guidelines (max 20, ranked by relevance)
├── session-context.md     # Auto-generated: last session summary, pending items
└── relationships.md       # Key people, teams, contexts Daniel interacts with
```

Size budget: Core memory total must stay under 3,000 tokens. Combined with identity files (~800 tokens compressed) and guidelines (~800 tokens for top 20), the total `<guya-context>` block stays under ~4,600 tokens. This leaves the majority of context for actual work. The context assembler enforces this by ranking blocks by recency and relevance, truncating if needed.

Read pattern: SessionStart hook reads all core blocks, assembles them, injects as system-reminder.

Write pattern: Guya uses `memory_core_update` MCP tool to modify blocks. Changes persist immediately to disk.

**Tier 2 — Recall Memory (Session History, Temporal Search)**

Purpose: "What happened in previous sessions?" Searchable by time, project, topic.

Storage: claude-mem's existing SQLite database. Guya does not create a separate recall store — it leverages claude-mem's `observations` and `session_summaries` tables directly (read-only).

Read pattern: On session start, the last session summary is pulled from claude-mem. During session, Guya uses claude-mem MCP tools (`smart_search`, `timeline`, `get_observations`) to query history.

Write pattern: claude-mem's observer captures tool calls automatically. Guya supplements with explicit observations via `memory_recall_note` tool for important moments the observer might miss (decisions, corrections, emotional signals).

**Tier 3 — Archival Memory (Long-Term, Semantic Search)**

Purpose: Deep knowledge that doesn't fit in core memory but should be retrievable.

Storage: Structured markdown files with keyword-searchable content. No Chroma dependency for v1 — uses grep-based search on markdown to avoid a hard dependency on a separate vector DB process. Vector search can be layered in v2.

```
.guya/memory/archival/
├── domains/               # Domain-specific knowledge
│   ├── coding.md
│   ├── productivity.md
│   └── {domain}.md
├── projects/              # Detailed project histories
│   ├── {project-name}.md
│   └── ...
└── people/                # Detailed profiles of key people
    └── {person}.md
```

Read pattern: `memory_archival_search` tool uses grep-based keyword search across archival markdown files.

Write pattern: `memory_archival_store` tool writes structured entries to the appropriate archival markdown file.

### 2.2 Memory Self-Editing (Letta-style)

Guya edits its own memory via MCP tool calls:

| Tool | Tier | Operation |
|------|------|-----------|
| `memory_core_update` | Core | Replace a core memory block |
| `memory_core_append` | Core | Append to a core memory block |
| `memory_recall_note` | Recall | Write an observation to claude-mem |
| `memory_archival_store` | Archival | Store knowledge in archival markdown |
| `memory_archival_search` | Archival | Keyword search across archival memory |
| `memory_reflect` | All | Trigger a reflection cycle (Reflexion-style) |

### 2.3 Context Assembly Pipeline

All context injection uses **system-reminder tags** emitted by the SessionStart hook. The actual CLAUDE.md file on disk is never modified by Guya hooks.

```
SessionStart
    |
    v
[1] Read identity files (~/.claude/guya/soul.md, creed.md, identity.md, user.md)
    |
    v
[2] Read core memory blocks (.guya/memory/core/*.md)
    |
    v
[3] Read active strategic guidelines (~/.claude/guya/guidelines/strategic/*.md, top 20 by rank)
    |
    v
[4] Read last session context (.guya/memory/core/session-context.md — written by Guya's own SessionEnd hook, NOT from claude-mem SQLite)
    |
    v
[5] Read active tactical guidelines (.guya/evolution/guidelines/tactical/*.md, if any)
    |
    v
[6] Assemble into <guya-context> block, enforce ~4,600 token budget
    |
    v
[7] Emit as system-reminder tag (same mechanism as OMC hooks)
    |
    v
Session begins with full context — Daniel is instantly recognized
```

---

## 3. Evolution Engine (SCOPE Pipeline)

### 3.1 Pipeline Overview

Based on EvolveClaw's SCOPE, adapted for Claude Code's hook constraints.

```
Observe --> Classify + Synthesize --> Inject --> Forget
   |               |                    |          |
   v               v                    v          v
 Traces       SessionEnd            SessionStart  Periodic
 captured     (batched LLM)         (system-rem)  consolidate
 per tool
```

**Key change from original plan (Architect R1):** All LLM-based processing (classification + synthesis) happens in a single SessionEnd batch. No LLM calls on the hot path (Stop hook removed). A lightweight heuristic fast-lane in PostToolUse handles obvious corrections immediately.

### 3.2 Phase: Observe

**When**: PostToolUse hook (every tool call).

**What is captured**:

```typescript
// evolution/scope/types.ts
interface Trace {
  id: string;                          // UUID
  sessionId: string;                   // Claude Code session ID
  timestamp: number;                   // epoch ms
  type: 'tool_call' | 'correction' | 'preference' | 'outcome' | 'reflection';
  domain: string;                      // One of 8 EvolveClaw domains
  content: string;                     // What happened
  context: string;                     // Surrounding context
  outcome?: 'success' | 'failure' | 'neutral';
  userSentiment?: 'positive' | 'negative' | 'neutral';
}
```

Storage: `.guya/evolution/traces/YYYY-MM-DD.jsonl` (one line per trace, append-only). Traces older than 7 days are eligible for Forget-phase consolidation.

**Capture mechanism**: A lightweight PostToolUse hook script (`hooks/guya-trace-capture.mjs`) that:
1. Receives `toolName`, `toolInput`, `toolOutput`, `sessionId` from hook input (these are the ONLY fields available at PostToolUse — no user prompt text)
2. Writes a trace line to today's `.guya/evolution/traces/YYYY-MM-DD.jsonl`
3. Runs in under 50ms (no LLM calls, no user message access)

**Heuristic fast-lane** (in the `UserPromptSubmit` hook, NOT PostToolUse):

**Critic R1 fix:** The `UserPromptSubmit` hook receives the user's `prompt` text. This is where correction detection happens. The `guya-correction-detect.mjs` hook:
1. Reads the user's prompt text from hook input
2. Applies regex patterns for high-confidence corrections:
   - `"no,? (?:use|do|make|write|prefer) X (?:instead of|not|rather than) Y"` → correction
   - `"(?:wrong|incorrect|that's not right|fix that)"` → potential correction
   - `"(?:always|never) (?:use|do|write|prefer) X"` → preference declaration
3. If a high-confidence correction or preference is detected:
   a. Writes a `type: 'correction'` or `type: 'preference'` trace with high confidence
   b. Writes an immediate tactical guideline to `.guya/evolution/guidelines/tactical/`
   c. This guideline is available to the agent in the current session's context
4. Runs in under 100ms (regex only, no LLM calls)

Ambiguous cases (no regex match) are deferred to the SessionEnd LLM classification batch.

### 3.3 Phase: Classify + Synthesize (Batched at SessionEnd)

**When**: SessionEnd hook (async, after user leaves). Single batch operation.

**Step 1 — Classify**: An LLM call (haiku-tier) classifies all unclassified traces from the session.

Classification dimensions:
- **Persistence**: `tactical` (ephemeral) vs `strategic` (permanent)
- **Confidence**: 0.0 to 1.0. Only traces with confidence >= 0.85 become strategic.
- **Domain**: tool_usage, code_quality, error_handling, communication, user_preferences, context_awareness, workflow, general

**Step 2 — Synthesize**: A second LLM call (sonnet-tier) generates guidelines from classified traces.

```
evolution/scope/classify-and-synthesize.ts

CALLING SPEC:
    classifyAndSynthesize(
      traces: Trace[],
      existingGuidelines: Guideline[]
    ) -> {
      classifiedTraces: ClassifiedTrace[]
      newGuidelines: Guideline[]
      updatedGuidelines: Guideline[]
      conflicts: ConflictReport[]
      userProfileUpdates: ProfileDiff[]
    }

    Side effects: Writes guideline files, updates user.md if new profile info discovered
    Async: Yes (2 LLM calls: haiku classify + sonnet synthesize)
    Timeout: 30s total (within SessionEnd hook budget)

    LLM Invocation (Critic R1 fix):
    - Uses `@anthropic-ai/sdk` directly with ANTHROPIC_API_KEY from environment
    - Model IDs: claude-haiku-4-5-20251001 (classify), claude-sonnet-4-6 (synthesize)
    - The OMC agent definitions (guya-observer.md, guya-synthesizer.md) serve as
      PROMPT TEMPLATES only — they are read by the SessionEnd hook and used as
      system prompts for the direct API calls, NOT invoked as OMC agents
    - If ANTHROPIC_API_KEY is not set, skip classification/synthesis silently
      and leave traces as unclassified (they will be retried next session)

    Error Handling (Critic R1 fix):
    - If classify call fails/times out: traces remain in JSONL as unclassified.
      Next SessionEnd picks up all unclassified traces (not just current session).
    - If synthesize call fails: classified traces are persisted with their
      classifications. Next SessionEnd synthesizes from all unsynthesized
      classified traces.
    - If entire SessionEnd hook times out (30s): partial work is persisted
      (JSONL is append-only, guideline files are written atomically).
      No data loss — next session retries.
```

Guideline format:
```markdown
<!-- ~/.claude/guya/guidelines/strategic/code-style-prefer-const.md -->
---
id: guideline-abc123
domain: code_quality
confidence: 0.92
created: 2026-03-30
lastValidated: 2026-03-30
sourceTraces: [trace-xyz, trace-abc]
rank: 15
---

# Prefer const over let in TypeScript

Daniel consistently corrects `let` declarations to `const` when the variable is not reassigned.
Always use `const` by default. Only use `let` when reassignment is proven necessary.
```

### 3.4 Phase: Inject

**When**: SessionStart hook (context assembly).

The context assembler reads guideline files from `~/.claude/guya/guidelines/strategic/` (global, sorted by rank, top 20) and `.guya/evolution/guidelines/tactical/` (project-local, session-scoped). Includes them in the `<guya-context>` system-reminder block.

### 3.5 Phase: Forget (Consolidation)

**When**: Manually via `evolve_consolidate` tool, or when guideline count exceeds 100.

**Operations**:
1. **Merge similar**: LLM identifies guidelines expressing the same insight, merges with combined confidence
2. **Prune low-value**: Guidelines with confidence < 0.5 and not validated in 30 days → archived
3. **Prune subsumed**: If guideline A is a strict subset of B → archive A
4. **Consolidate traces**: Traces older than 7 days that have been synthesized → deleted
5. **Re-rank**: All remaining guidelines re-ranked by (confidence * recency_weight)
6. **Promote tactical**: Tactical guidelines with confidence >= 0.85 → promoted to strategic

---

## 4. Identity System

### 4.1 File Roles

| File | Location | Purpose | Who Edits | Frequency |
|------|----------|---------|-----------|-----------|
| `soul.md` | `~/.claude/guya/` | Guya's personality, values, tone | Daniel initially; Guya proposes changes via `identity_propose_change` tool | Rarely |
| `creed.md` | `~/.claude/guya/` | Non-negotiable commitments | Daniel only | Very rarely |
| `identity.md` | `~/.claude/guya/` | Name, avatar, vibe | Daniel initially; Guya with permission | Rarely |
| `user.md` | `~/.claude/guya/` | Daniel's profile | Guya autonomously (primary), Daniel (corrections) | Every session |

### 4.2 user.md — The Living Profile

The most dynamic file. Guya updates it autonomously at SessionEnd based on observations.

Structure:
```markdown
# Daniel

## Basics
- Name: Daniel
- Role: [discovered]
- Timezone: [discovered]

## Communication Style
- [Observations]

## Technical Preferences
- [Languages, frameworks, patterns]

## Current Projects
- [Active projects with status]

## Life Context
- [Non-coding context: interests, goals]

## Pet Peeves
- [Things Daniel corrects or dislikes]

## Interaction Patterns
- [When Daniel works, how he phrases things]
```

### 4.3 soul.md — Guya's Character

Authored by Daniel during bootstrap. Guya can propose modifications via `identity_propose_change` tool — the one area where full autonomy is gated. Identity changes require Daniel's approval.

---

## 5. Integration Layer

### 5.1 Hook Registration

Guya registers hooks in `.claude/settings.local.json`. These run alongside OMC and claude-mem hooks.

| Hook Point | Guya Hook Script | Purpose | Timeout |
|------------|-----------------|---------|---------|
| SessionStart | `hooks/guya-session-start.mjs` | Context assembly + system-reminder injection + lazy `.guya/` creation | 5s |
| UserPromptSubmit | `hooks/guya-correction-detect.mjs` | Heuristic correction detection (has access to `prompt`) | 100ms |
| PostToolUse | `hooks/guya-trace-capture.mjs` | Lightweight trace capture (tool name, input, output only) | 50ms |
| PreCompact | `hooks/guya-memory-flush.mjs` | Flush core memory updates before compaction | 5s |
| SessionEnd | `hooks/guya-session-end.mjs` | Classify + synthesize + reflect + update user.md | 30s |

**Hook registration (Critic R1):** Guya is packaged as a **Claude Code plugin** with its own `.claude-plugin/plugin.json` manifest and `hooks/hooks.json`. This is the supported registration mechanism — both OMC and claude-mem use this pattern. Guya's plugin structure:

```
guya-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest (name, version, description)
├── hooks/
│   ├── hooks.json            # Hook registration (lifecycle events → scripts)
│   ├── guya-session-start.mjs
│   ├── guya-correction-detect.mjs
│   ├── guya-trace-capture.mjs
│   ├── guya-memory-flush.mjs
│   └── guya-session-end.mjs
├── tools/
│   └── ... (MCP server)
├── agents/
│   └── ... (agent definitions)
├── skills/
│   └── ... (skill definitions)
└── CLAUDE.md
```

**Note (Architect R1):** No Stop hook. All LLM processing moved to SessionEnd.
**Note (Critic R1):** Correction detection moved from PostToolUse to UserPromptSubmit where the user's `prompt` text IS available. PostToolUse captures only tool metadata (name/input/output). Uses `.mjs` extension for ESM consistency with OMC ecosystem.

### 5.2 Context Injection

The `guya-session-start.mjs` hook emits a `<guya-context>` **system-reminder** block. It does NOT modify CLAUDE.md on disk. This is the same injection mechanism OMC uses.

Contents:
1. Identity summary (from soul.md, identity.md — compressed)
2. User profile (from user.md — compressed)
3. Core memory blocks (from .guya/memory/core/)
4. Active guidelines (top 20 strategic + any tactical)
5. Last session continuity (from session-context.md, written by Guya's SessionEnd hook)

### 5.3 MCP Tool Server

Guya exposes tools as an MCP server (same pattern as claude-mem).

```
tools/
├── server.ts              # MCP server entry point (~150 LOC)
│                          # Uses @modelcontextprotocol/sdk (stdio transport)
│                          # Started by Claude Code via mcpServers config
├── memory-tools.ts        # memory_core_update, memory_core_append,
│                          # memory_recall_note, memory_archival_store,
│                          # memory_archival_search, memory_reflect
├── evolution-tools.ts     # evolve_consolidate, evolve_status,
│                          # evolve_force_synthesize
├── identity-tools.ts      # identity_propose_change, identity_read
└── introspection-tools.ts # guya_status, guya_guidelines, guya_traces
```

**MCP server startup (Critic R1 fix):**
Registration via the plugin's `.mcp.json` file (same pattern as claude-mem):
```json
{
  "mcpServers": {
    "guya-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/tools/server.js"]
    }
  }
}
```

Dependencies: `@modelcontextprotocol/sdk` for MCP protocol, `gray-matter` for YAML frontmatter parsing in guideline files. No SQLite dependency — Guya reads/writes only markdown and JSONL files.

**Concurrency (Critic R1 fix):** Trace JSONL writes use append mode with atomic write-and-rename for guideline files. If two sessions write to the same trace file, append mode ensures no data loss (lines may interleave but each is a complete JSON object). Guideline writes use write-to-temp-then-rename to prevent corruption. SessionEnd classification includes a `sessionId` filter so parallel sessions only classify their own traces.

### 5.4 Coexistence with OMC and claude-mem

- Guya hooks run **after** OMC and claude-mem hooks (by ordering in settings.local.json)
- Guya reads from claude-mem's SQLite DB via MCP tools (never writes directly)
- Guya's own state lives in `~/.claude/guya/` (global) and `.guya/` (project-local) — never in OMC or claude-mem paths
- OMC agents and skills remain available; Guya adds new ones, doesn't replace existing

---

## 6. Session Lifecycle

### 6.1 Session Start

```
Claude Code launches
    |
    v
[OMC SessionStart hooks]  -- session-start.mjs, project-memory-session.mjs
    |
    v
[claude-mem context hook] -- injects recent observations + last summary
    |
    v
[Guya SessionStart hook]  -- guya-session-start.mjs
    |
    +--> Lazy init: if .guya/ doesn't exist in current project, create directory structure
    |    (memory/core/, memory/archival/, memory/reflections/, evolution/traces/,
    |     evolution/guidelines/tactical/) — ensures Guya works in ANY project
    |
    +--> Read identity files (~/.claude/guya/soul.md, creed.md, identity.md, user.md)
    |    If ~/.claude/guya/ doesn't exist → trigger bootstrap mode (emit bootstrap prompt)
    +--> Read core memory blocks (.guya/memory/core/*.md) — skip missing files gracefully
    +--> Read top 20 strategic guidelines (~/.claude/guya/guidelines/strategic/)
    +--> Read any active tactical guidelines (.guya/evolution/guidelines/tactical/)
    +--> Read last session context (.guya/memory/core/session-context.md)
    +--> Assemble <guya-context> block (enforce ~4,600 token budget)
    |    Token counting: approximate via chars/4 heuristic (no tokenizer dependency)
    +--> Emit as system-reminder
    |
    v
Agent starts with full identity + memory + guidelines in context
Daniel is instantly recognized in ANY project.
```

### 6.2 During Session

```
User sends prompt
    |
    v
[OMC UserPromptSubmit hooks] -- keyword detection, skill injection
    |
    v
[Guya UserPromptSubmit hook: guya-correction-detect.mjs]
    +--> Read user's prompt text (available as `prompt` field in hook input)
    +--> Apply regex heuristics for corrections/preferences
    +--> If high-confidence match: write correction trace + tactical guideline
    +--> Runs in <100ms (regex only, no LLM)
    |
    v
Agent processes, calls tools
    |
    v
[PostToolUse: guya-trace-capture.mjs]
    +--> Write trace to .guya/evolution/traces/YYYY-MM-DD.jsonl (50ms)
    +--> Captures toolName, toolInput, toolOutput only (no user message access)
    |
    v
Agent responds
    |
    v
(Guya may update core memory mid-session via memory_core_update MCP tool
 if it learns something important about Daniel)
```

### 6.3 Session End

```
Session ends (user exits or session times out)
    |
    v
[OMC SessionEnd hooks]
    |
    v
[claude-mem session end] -- writes session summary to SQLite
    |
    v
[Guya SessionEnd hook: guya-session-end.mjs]
    |
    +--> [1] Batch classify all unclassified traces (haiku LLM, ~3s)
    |
    +--> [2] Synthesize guidelines from classified traces (sonnet LLM, ~10s)
    |        Write new/updated guidelines to strategic/ or tactical/
    |
    +--> [3] Reflexion-style reflection:
    |        "What went well? What should I do differently? What did I learn?"
    |        Write to .guya/memory/reflections/YYYY-MM-DD-{sessionId}.md
    |
    +--> [4] Update user.md if new profile information discovered
    |
    +--> [5] Update .guya/memory/core/session-context.md for next session
    |
    v
All state persisted. Next session picks up seamlessly.
```

---

## 7. Agent and Skill Definitions

### 7.1 Custom Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| `guya-observer` | haiku | Lightweight trace classification |
| `guya-synthesizer` | sonnet | Guideline synthesis from classified traces |
| `guya-consolidator` | opus | Deep consolidation: merge, prune, conflict resolution |
| `guya-reflector` | sonnet | Post-session verbal reflection (Reflexion-style) |

Agent definitions in `agents/` as markdown files following OMC format.

### 7.2 Custom Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `guya-bootstrap` | First run detection, "bootstrap guya" | First-run interview to build Daniel's profile |
| `guya-reflect` | "reflect", "what did you learn" | Manual reflection trigger |
| `guya-evolve` | "evolve", "consolidate" | Manual SCOPE consolidation trigger |
| `guya-status` | "guya status" | Show current state: memory, guidelines, traces |
| `guya-forget` | "forget X", "unlearn X" | Remove a specific guideline or memory |

Skills in `skills/` as directories with SKILL.md, following OMC format.

---

## 8. Bootstrap Ritual

### 8.1 First-Run Detection

The SessionStart hook checks for `~/.claude/guya/user.md`. If it doesn't exist (or is a blank template), Guya enters bootstrap mode.

### 8.2 Bootstrap Flow

```
[1] Check if ~/.claude/guya/ directory exists
    If not: create directory structure + seed soul.md, creed.md, identity.md templates

[2] Guya introduces itself using soul.md and identity.md
    "Hey Daniel. I'm Guya — your personal agent. I'm going to learn about you
     so I can be genuinely useful from session one."

[3] Structured interview (5-7 questions, one at a time via AskUserQuestion):
    - What do you do? (role, domain)
    - What are you working on right now? (active projects)
    - How do you like to communicate? (style preferences)
    - What tools/languages/frameworks do you prefer?
    - What frustrates you about AI assistants? (anti-patterns to avoid)
    - Anything else I should know?

[4] Profile assembly:
    - Generate user.md from interview responses
    - Generate initial .guya/memory/core/ blocks
    - Generate initial tactical guidelines

[5] Confirmation:
    "Here's what I understand so far: [summary].
     I'll keep learning from here. Correct me anytime."

[6] Write all files, mark bootstrap complete
```

### 8.3 Pre-authored Identity Files

`soul.md`, `creed.md`, and `identity.md` are seeded as templates during bootstrap. Daniel customizes them afterward. These define who Guya IS, independent of who Daniel is.

---

## 9. Implementation Phases

### Phase 1: Foundation (Identity + Core Memory + Context Assembly)

**Deliverables**:
- `~/.claude/guya/` directory with soul.md, creed.md, identity.md templates
- `.guya/memory/core/` directory with initial block structure
- `hooks/guya-session-start.mjs` — context assembler that reads identity + core memory + guidelines and emits system-reminder
- `user.md` template
- `.claude/settings.local.json` hook registration

**Acceptance Criteria**:
- Starting a Claude Code session in any project shows Guya's identity in context
- Token budget enforcement works (truncation at ~4,600 tokens)
- Identity files are readable from `~/.claude/guya/`

**Dependencies**: None. This is the base layer.

### Phase 2: Bootstrap (First-Run Experience)

**Deliverables**:
- `skills/guya-bootstrap/SKILL.md` — first-run interview skill
- Bootstrap detection logic in SessionStart hook
- Profile assembly logic

**Acceptance Criteria**:
- First run in a fresh environment triggers bootstrap interview
- Bootstrap produces a valid user.md and initial core memory blocks
- Subsequent sessions show Daniel's profile in context

**Dependencies**: Phase 1 (needs context assembly + directory structure).

### Phase 3: Memory Tools (MCP Server + Self-Editing)

**Deliverables**:
- `tools/server.ts` — MCP server entry point
- `tools/memory-tools.ts` — core_update, core_append, recall_note, archival_store, archival_search
- `tools/introspection-tools.ts` — guya_status, guya_guidelines
- MCP server registration in settings

**Acceptance Criteria**:
- Agent can call `memory_core_update` and the change appears in next context assembly
- Agent can call `memory_archival_store` and content is retrievable via `memory_archival_search`
- `memory_recall_note` writes an observation visible in claude-mem's timeline

**Dependencies**: Phase 1 (needs core memory structure).

### Phase 4: Trace Capture + Heuristic Fast-Lane

**Deliverables**:
- `evolution/scope/types.ts` — trace and classification type definitions
- `hooks/guya-trace-capture.mjs` — PostToolUse hook for trace capture + heuristic corrections
- `.guya/evolution/traces/` directory
- `.guya/evolution/guidelines/tactical/` directory
- `agents/guya-observer.md` — observer agent definition

**Acceptance Criteria**:
- Every tool call produces a trace line in `.guya/evolution/traces/YYYY-MM-DD.jsonl`
- High-confidence corrections (regex-matched) immediately produce tactical guidelines
- PostToolUse hook runs in under 50ms
- No LLM calls in the hot path

**Dependencies**: Phase 1 (hooks infrastructure).

### Phase 5: Classification + Synthesis + Reflection (SessionEnd)

**Deliverables**:
- `evolution/scope/classify-and-synthesize.ts` — combined classification + guideline generation
- `hooks/guya-session-end.mjs` — SessionEnd hook
- `~/.claude/guya/guidelines/strategic/` directory
- `agents/guya-synthesizer.md` and `agents/guya-reflector.md`
- `.guya/memory/reflections/` directory
- Update SessionStart hook to include guidelines in context assembly

**Acceptance Criteria**:
- After a session with corrections, new guidelines appear in strategic/ or tactical/
- Next session start includes the new guidelines in context
- Each session end produces a reflection file
- Full SessionEnd pipeline completes within 30s

**Dependencies**: Phase 4 (needs traces to classify).

### Phase 6: Consolidation + Remaining Skills

**Deliverables**:
- `evolution/scope/consolidate.ts` — merge, prune, re-rank logic
- `agents/guya-consolidator.md`
- `tools/evolution-tools.ts` — evolve_consolidate, evolve_status, evolve_force_synthesize
- `tools/identity-tools.ts` — identity_propose_change, identity_read
- `skills/guya-reflect/SKILL.md`, `skills/guya-evolve/SKILL.md`, `skills/guya-status/SKILL.md`, `skills/guya-forget/SKILL.md`

**Acceptance Criteria**:
- Consolidation merges similar guidelines and prunes stale ones
- Guideline count stays manageable (under 100 strategic)
- All skills trigger correctly via keywords
- `evolve_status` shows current state

**Dependencies**: Phase 5 (needs guidelines to consolidate).

### Phase Dependency Graph

```
Phase 1 (Foundation)
    |
    +---> Phase 2 (Bootstrap)
    |
    +---> Phase 3 (Memory Tools)     Phase 4 (Trace Capture)
    |         |                           |
    |         +---------------------------+
    |         |
    |         v
    |    Phase 5 (Classification + Synthesis + Reflection)
    |         |
    |         v
    |    Phase 6 (Consolidation + Skills)
    |
    v
Phases 2, 3, 4 can run in parallel after Phase 1
Phase 5 depends on Phase 4
Phase 6 depends on Phase 5
```

---

## RALPLAN-DR Summary

### Principles (5)

1. **Memory is the product.** Every architectural decision optimizes for memory quality, retrieval speed, and context relevance. Without good memory, nothing else works.

2. **Leverage existing infrastructure.** claude-mem already has SQLite and session tracking. OMC already has agent orchestration, skills, and hooks. Guya builds ON these, never beside them.

3. **Hooks are the integration surface.** All Guya behavior attaches to Claude Code lifecycle hooks. No background daemons, no polling, no separate processes beyond the MCP server.

4. **Evolution never blocks the user.** Trace capture is sub-50ms. No LLM calls on the hot path (PostToolUse, Stop). All LLM processing batched at SessionEnd when the user has already left. The heuristic fast-lane handles only obvious corrections.

5. **Identity files are human-readable and portable.** soul.md, creed.md, user.md are plain markdown in `~/.claude/guya/`. Daniel can read and edit them with any text editor. They work in every project.

### Decision Drivers (Top 3)

1. **Integration friction** — How much work to wire into existing OMC + claude-mem? Lower is better.
2. **Learning latency** — How quickly does a correction become a guideline? Faster is better. (Tradeoff: heuristic fast-lane gives immediate tactical guidelines for obvious corrections; full LLM classification waits until SessionEnd.)
3. **Context budget** — How much context window does Guya consume? Less is better.

### Viable Options

**Option A: Hook-Native Architecture (CHOSEN)**

| Pros | Cons |
|------|------|
| Minimal integration friction | Constrained by hook timeouts (30s max for SessionEnd) |
| Zero new infrastructure beyond MCP server | No proactive between-session behavior |
| All state is human-readable markdown | Learning latency: full classification waits until session end |
| Works in any project via user-scoped identity | Dependent on Claude Code hook API stability |

**Option B: Standalone Daemon Architecture (DEFERRED to v2)**

| Pros | Cons |
|------|------|
| Full control over timing and scheduling | New infrastructure to deploy and monitor |
| Proactive between-session processing | Operational complexity alongside claude-mem worker |
| Not dependent on hook lifecycle | Over-engineered for v1 requirements |

**Why B is deferred**: All v1 "done" criteria are achievable with Hook-Native. Daemon becomes valuable when Guya needs proactive between-session behavior (e.g., "summarize all projects every evening"). The MCP tools and markdown formats are the same in both options — B layers cleanly on top of A.

**Option C: Pure claude-mem Extension (DISMISSED)**

| Why dismissed |
|---------------|
| claude-mem is third-party with its own release cycle; forking creates maintenance burden |
| Mixing identity + evolution into claude-mem's observation domain violates single-responsibility |
| Cannot upstream Guya-specific features |

### ADR: Architecture Decision

- **Decision**: Hook-Native (Option A) for v1, Standalone Daemon (Option B) deferred to v2
- **Drivers**: Integration friction (lowest), learning latency (heuristic fast-lane compromise), context budget (~4,600 tokens)
- **Consequences**: No proactive between-session behavior in v1. Complex consolidation triggered manually or on guideline count threshold. Learning latency for non-obvious patterns is "next session."
- **Follow-ups**: Evaluate daemon for v2. Monitor hook timeout constraints. Measure actual context budget usage after Phase 1.

### Acknowledged Tradeoff (Architect R1, Critic R1 corrected)

**Learning latency vs. never blocking**: There is a fundamental tension between wanting corrections to become guidelines fast and never blocking the user. The synthesis resolves this with a two-track approach:
- **Fast lane (immediate)**: Heuristic regex matching in `UserPromptSubmit` hook (where the user's `prompt` text IS available) catches obvious corrections and writes tactical guidelines immediately. No LLM, <100ms. Note: the fast lane only fires when the user submits a new prompt — it cannot detect corrections within the same turn.
- **Slow lane (SessionEnd)**: Full LLM classification + synthesis via `@anthropic-ai/sdk` direct API calls for ambiguous patterns. Runs after user leaves (30s budget). Guidelines appear in the next session. Uses agent definitions as prompt templates, not as OMC agent invocations.

This means obvious corrections ("no, use const instead") take effect on the next prompt submission. Subtle patterns ("Daniel tends to prefer functional style") take effect next session. Failed LLM calls leave traces as unclassified — they are retried on next SessionEnd with no data loss.

### Error Recovery (Critic R1)

All state is append-only (JSONL traces) or atomic-write (guideline markdown files). No operation can leave the system in a corrupt state:
- **SessionEnd timeout**: Partial work persisted. Unclassified/unsynthesized traces retried next session.
- **API key missing**: Evolution engine degrades gracefully — traces still captured, just never classified. Fast-lane heuristics still work (no API needed).
- **Concurrent sessions**: Each session writes its own traces with `sessionId`. Classification filters by session. Append-mode JSONL handles concurrent writes.
- **Missing `.guya/`**: SessionStart creates it lazily. Missing files are skipped gracefully.
