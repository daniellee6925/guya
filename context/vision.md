# Guya — Vision

> The north star: what we're building, why it matters, and how we'll know it's done.

---

## One-Liner

Daniel opens Claude Code and Guya already knows who he is, what he cares about, and gets better every session without him telling it to.

---

## 1. Zero-Ramp-Up Session Start

Every session starts with Guya already knowing Daniel. No re-explaining context, no re-stating preferences, no "as I mentioned last time." The session-start hook assembles identity, guidelines, and project context automatically — before the first message.

### 1.1 Context Assembly

`guya-session-start.mjs` reads and assembles into a `<guya-context>` system-reminder block:
- Global identity (`soul.md`, `user.md`, `growth-tracker.md`) from `~/.claude/guya/`
- Active tasks from Constantia `tasks/MANIFEST.md` (via `constantia-sync.mjs`)
- Strategic guidelines from `~/.claude/guya/guidelines/strategic/`
- Project-local core memory from `.guya/memory/core/`
- Project-local tactical guidelines from `.guya/evolution/guidelines/tactical/`
- Reflection backlog nudge (if `/guya-evolve` hasn't run recently)

The block has a 3000-token budget (~12000 chars). Constantia tasks are priority 0 (same as soul/user) so they're never truncated. If Constantia is unavailable, session-start shows an alert — never silently degrades.

### 1.2 Acceptance Criteria

- [ ] A cold session (no prior context in Claude Code's window) behaves indistinguishably from a warm one with respect to tone, awareness of Daniel's preferences, and project continuity
- [ ] The assembled context fits in 3000 tokens without truncation of critical identity content
- [ ] A session in any project (SDF, Guya, BosonAI, new project) gets the correct global identity + project-local context + Constantia tasks without manual setup
- [ ] The backlog nudge surfaces accumulated reflections when `/guya-evolve` hasn't run recently
- [ ] If Constantia is unavailable (config missing, path invalid), an alert appears in session context

---

## 2. Autonomous Self-Evolution

Guya improves every session as a natural outcome of working together. Reflections accumulate, synthesis proposes changes, Daniel reviews and applies. The loop is low-friction enough that it actually happens.

### 2.1 The Evolution Pipeline

```
/guya-reflect (after session)
        │
        ├─► .guya/memory/reflections/ — dated reflection entries
        └─► Constantia log/ — structured log with full reflection content
        │
        ▼ /guya-evolve — guya-reflection-synthesizer (Sonnet)
        │     + reads Telos profile from Constantia (if available)
        │
        ├─ guidelineEdits       → auto-apply to ~/.claude/guya/guidelines/strategic/
        ├─ userProfileAdditions → auto-append to ~/.claude/guya/user.md
        └─ identityProposals    → per-item review (soul.md, growth-tracker.md)
                │
                ▼ guya-consolidator (Opus) — merge, prune, re-rank (if stale >7d)
                │
                ▼ commit-identity.mjs → git commit to ~/.claude/guya/
```

### 2.2 Anti-Rot Guardrails

- Manual invocation by design — auto-fire invited silent rot when the API key died for 6 days unnoticed
- Identity proposals require ≥2 source reflections — prevents mood-of-the-day oscillation
- `~/.claude/guya/` is a git repo — every evolution is a versioned commit, fully reversible
- SessionStart nudge surfaces backlog count when evolution hasn't run recently

### 2.3 Acceptance Criteria

- [ ] A reflection written via `/guya-reflect` is synthesized into actionable guideline proposals by `/guya-evolve` without additional input
- [ ] Applied guidelines are visible in the next session's context without manual steps
- [ ] Identity proposals that come from a single reflection are blocked until a second reflection corroborates
- [ ] Every evolution run creates a git commit in `~/.claude/guya/` with a meaningful message
- [ ] The full cycle (reflect → evolve → apply → next session) takes under 5 minutes of Daniel's active time

---

## 3. Cross-Agent Shared Memory — Constantia

Guya is one of two agents that know Daniel. Telos (a standalone mentor agent) is the other. Constantia is the git repo they share — the single source of truth about Daniel's growth, tasks, and trajectory. Without it, the two agents would accumulate separate, diverging pictures of Daniel.

### 3.1 Architecture

Constantia (`~/Desktop/constantia`, discovered via `~/.claude/guya/constantia.json`) holds: `log/` (session chronicles from both agents), `tasks/` (assigned work with lifecycle tracking), `evidence/` (Telos's interpreted assessments), `profile/` (synthesized view of Daniel), `goals/` (pillars, rubrics, plans).

Write ownership is absolute — no file is written by both agents:
- **Guya writes:** `log/` (via /guya-reflect), task status updates, task proposals (`status: proposed`)
- **Telos writes:** `evidence/`, `profile/`, `goals/`, task assignments + grades

### 3.2 How Guya Uses Constantia

- **Session-start:** reads `tasks/MANIFEST.md` for active tasks (priority 0 in context assembly)
- **Reflect:** writes structured log entries (YAML frontmatter + session metadata, reflection content, growth observations, open threads). Filename: `YYYY-MM-DD-guya-{project}-{session_id}.md`
- **Evolve:** reads `profile/` so Telos's longitudinal assessments inform guideline synthesis

### 3.3 Acceptance Criteria

- [ ] Every /guya-reflect writes a log entry to Constantia that passes pre-commit validation
- [ ] Log entries from different projects on the same day produce separate files (no overwrites)
- [ ] A second /guya-reflect in the same session appends to the existing log (no data loss)
- [ ] Telos can read any Guya log entry and extract growth observations without additional context
- [ ] If Constantia is unavailable, Guya still functions — reflection saves locally, alert shows in context
- [ ] No file in Constantia is written by both Guya and Telos

---

## 4. Universal Scope — Coding, Life, Everything

Guya is not a coding assistant with extras. It is Daniel's primary thinking partner across all domains: engineering decisions, personal goals, communication, learning, and anything else he brings to it.

### 4.1 What Universal Means

The skill set covers: code review, feature decisions, bugfix harnesses, refactor discipline, PR prep, optimization analysis, learning (Socratic), project direction (distinguished engineer), reflection, obsidian sync, self-evolution.

Domain-specific knowledge (Daniel's ML background, SDF architecture, BosonAI context) lives in archival memory and gets surfaced when relevant — not manually retrieved.

### 4.2 Acceptance Criteria

- [ ] A non-coding request (life decision, communication draft, learning session) gets the same quality of engagement as a coding request
- [ ] Domain context from a previous project surfaces in a new project's session when relevant, without Daniel re-explaining
- [ ] The skill catalog covers the full range of Daniel's recurring work patterns without gaps that require falling back to a plain Claude session

---

## 5. Genuine Mentorship — Growth Over Comfort

Guya tracks Daniel's growth across sessions and actively pushes it. It names bad decisions, challenges vague thinking, and holds him accountable to his own stated goals. This is the hardest thing to get right because it requires Guya to be willing to be uncomfortable.

### 5.1 Growth Tracking

`growth-tracker.md` holds: current grades by domain, trajectory, milestones, and the Karpathy target (reading and critiquing code at a high level). Growth data feeds into how Guya engages — pushing harder in areas of stagnation, acknowledging genuine progress.

### 5.2 Acceptance Criteria

- [ ] Guya surfaces a growth observation at least once per session (not just task completion)
- [ ] A vague plan gets pushed back on before implementation begins
- [ ] Growth tracker is updated after sessions where a milestone is crossed or a significant pattern is observed
- [ ] Guya can name Daniel's current top 1-2 growth areas without being asked

---

## 6. Identity as a First-Class System

Guya has a soul, not just instructions. `soul.md`, `identity.md`, `user.md`, `growth-tracker.md` are versioned, maintained, and treated as the source of truth for who Guya is and who Daniel is. Identity is not configured once and forgotten — it evolves.

### 6.1 Identity Files

| File | Purpose |
|------|---------|
| `soul.md` | Identity anchor — the bear, the commitments, session behaviors |
| `identity.md` | Presentation — name, origin, vibe |
| `user.md` | Daniel's profile: patterns, preferences, growth areas |
| `growth-tracker.md` | Grades, trajectory, milestones |

### 6.2 Acceptance Criteria

- [ ] `user.md` reflects observations from the last 30 days of sessions — not just the bootstrap interview
- [ ] `soul.md` commitments are observable in actual session behavior, not just stated in the file
- [ ] Identity changes are traceable — every edit to `~/.claude/guya/` is a git commit with a reason
- [ ] A new session in a project Guya has never seen before still feels like Guya, not a generic assistant

---

## 7. Engineering Quality Standards

### 7.1 Token Efficiency

Every byte of context injected at session start displaces something else. Context assembly must be selective — highest-signal content within the token budget, not a full dump.

- Session-start hook target: 3000 tokens / ~12000 chars
- Identity files combined: under 500 tokens
- Constantia tasks at priority 0 (never truncated)
- Guidelines: top N by relevance, not all of them

### 7.2 Hook Reliability

Hooks are the delivery mechanism. If a hook silently fails, Guya degrades without Daniel knowing.

- All hooks write to a log file on error — silent failures are not acceptable
- Pre-commit gate must block reliably — a bypassed review is worse than no review
- Post-commit scribe must not miss commits — the last-scribe-head marker is the integrity signal

### 7.3 Evolution Pipeline Integrity

- Reflection synthesis must be idempotent — running `/guya-evolve` twice on the same reflections produces the same result
- Applied guidelines must be visible in the immediately following session — no lag
- Identity repo must never be in a dirty state after `/guya-evolve` completes

### 7.4 Constantia Integrity

- Log entries must pass Constantia pre-commit validation (required fields, filename convention, author/status enums)
- No file in Constantia is written by both agents — ownership violations are architectural bugs
- If Constantia is unreachable, Guya degrades gracefully (local reflection still saves, alert shows) — never blocks the session
- Log filenames include project + session ID — no cross-repo overwrites, no data loss on same-day multi-session

### 7.5 Cross-Project Portability

- `guya-setup` installs the post-commit hook into any repo in one command
- No hardcoded project paths in `~/.claude/guya/` or global hooks
- Global hooks resolve project root via `git rev-parse --show-toplevel` — never assume CWD
- Constantia path resolved via `~/.claude/guya/constantia.json` — not hardcoded
