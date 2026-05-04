# Constantia — Vision

> The north star: what we're building, why it matters, and how we'll know it's done.

---

## One-Liner

Constantia is the living, evidence-backed model of Daniel that both Guya and Telos read and write — the single source of truth that makes two independent agents into one coherent system.

---

## 1. Three-Identity System

Guya, Telos, and Constantia form a trio. Each has a distinct role:

- **Telos** (Mac Mini, standalone agent) — the mentor. Assigns tasks, verifies completion, grades work, maintains the profile, manages long-term goals. Runs on a schedule (morning/evening ticks). Owns the big picture. Has a personal dimension beyond work.
- **Guya** (Claude Code, plugin) — the executor. Helps Daniel complete tasks, write code, study, debug. Reads task assignments, reports progress, proposes new tasks. Owns the session.
- **Constantia** (git repo, shared memory) — the truth. Stores everything both agents need to know. Neither agent's local state is authoritative — Constantia is.

### 1.1 Information Flow

```
Telos reads Constantia → decides what Daniel should work on → writes tasks
Daniel brings task context to Guya session
Guya executes → writes session log + task status updates to Constantia
Telos reads updated Constantia → grades work → updates evidence + profile
```

Daniel is the bridge between agents at the interaction layer. Constantia is the bridge at the data layer.

### 1.2 Acceptance Criteria

- [ ] Telos can grade Daniel's work without ever communicating directly with Guya — Constantia has all the evidence
- [ ] Guya can execute a task without knowing Telos exists — the task file has all needed context
- [ ] Removing either agent doesn't corrupt Constantia — it's a standalone data repo
- [ ] Adding a third agent requires zero changes to Constantia's structure

---

## 2. Repo Structure

```
constantia/
├── MANIFEST.md              # root index — overview of all sections
├── log/
│   ├── MANIFEST.md          # date | author | project | tasks referenced
│   ├── 2026-04-20.md
│   └── ...
├── tasks/
│   ├── MANIFEST.md          # ID | status | pillar | assigned | assigned_by
│   ├── TASK-001.md
│   └── ...
├── evidence/
│   ├── MANIFEST.md          # ID | category | date | source log entry
│   ├── EVD-001.md
│   └── ...
├── profile/
│   ├── strengths.md
│   ├── weaknesses.md
│   ├── habits.md
│   ├── cognitive.md
│   └── trajectory.md
├── goals/
│   ├── pillars.md           # the three locked pillars
│   ├── milestones.md        # near-term targets with acceptance criteria
│   ├── open-questions.md    # things neither agent has enough signal on
│   ├── rubrics/
│   │   ├── pillar-1.md      # LLM serving + inference — A/B/C definitions
│   │   ├── pillar-2.md      # production agentic systems
│   │   └── pillar-3.md      # eval methodology
│   └── plans/
│       ├── weekly.md
│       └── quarterly.md
└── hooks/
    ├── pre-commit            # validates frontmatter schema
    └── post-commit           # rebuilds manifests, auto-pushes to remote
```

### 2.1 Acceptance Criteria

- [ ] Every file with frontmatter passes schema validation on commit
- [ ] Manifests are always in sync with directory contents (rebuilt by hook)
- [ ] `git log` provides full audit trail of every change by every agent
- [ ] The repo can be cloned and read cold by a human with zero tooling

---

## 3. File Formats

### 3.1 Entity Files (tasks, evidence, log entries)

YAML frontmatter for queryable fields. Markdown body for narrative. One entity per file.

**Task:**
```markdown
---
id: TASK-NNN
status: proposed | assigned | in-progress | complete | graded | rejected
pillar: 1 | 2 | 3
assigned: YYYY-MM-DD
assigned_by: telos | daniel
proposed_by: guya | daniel | telos
purpose: "Why this task matters for Daniel's growth — specific, not generic"
acceptance: "Binary completion criteria — verifiable by artifact"
grade:
grade_evidence:
rejection_reason:
---

## Context

[Details, background, relevant links]
```

**Evidence:**
```markdown
---
id: EVD-NNN
category: strength | weakness | habit | growth | decision
date: YYYY-MM-DD
source: log/YYYY-MM-DD.md | commit SHA | artifact path
confidence: high | medium | low
---

## Observation

[What was observed, with specific artifact reference]

## Assessment

[What this means for Daniel's profile — ties to a profile claim]
```

**Log entry:**
```markdown
---
date: YYYY-MM-DD
author: guya | telos | daniel
session_project: project-name
tasks_progressed: [TASK-NNN, ...]
tasks_proposed: [TASK-NNN, ...]
---

## Summary

[What happened in this session — concise]

## Key decisions

[Decisions made, with reasoning]

## Artifacts produced

[Commits, files, PRs — the evidence surface]
```

### 3.2 Profile Files

No frontmatter. Structured markdown with evidence-pointed claims.

```markdown
# Strengths

## Systems thinking
- **Claim:** Naturally decomposes problems into architectural components
- **Confidence:** high
- **Evidence:** EVD-003, EVD-017, EVD-042
- **First observed:** 2026-04-01
- **Last confirmed:** 2026-04-20
```

Every claim has: confidence, evidence pointers, dates. No claim without evidence. Telos maintains. Daniel can edit.

### 3.3 Acceptance Criteria

- [ ] A task file missing required frontmatter fields is rejected by pre-commit hook
- [ ] Every evidence entry `source:` field points to an existing log entry or valid commit SHA
- [ ] Profile claims with no evidence pointers are flagged by weekly integrity check
- [ ] An agent that has never seen this repo can read MANIFEST.md and navigate to any piece of information within two file reads

---

## 4. Write Ownership

| Surface | Write owner | Read by |
|---------|-------------|---------|
| `log/` | Guya (session logs), Telos (tick logs), Daniel (manual) | Both |
| `tasks/` — creation & assignment | Telos, Daniel | Both |
| `tasks/` — status updates | Guya | Both |
| `tasks/` — proposed status | Guya, Daniel | Telos |
| `tasks/` — grading | Telos | Both |
| `evidence/` | Telos | Both |
| `profile/` | Telos (maintains), Daniel (can edit) | Both |
| `goals/` | Telos (owns), Daniel (can edit) | Both |
| `MANIFEST.md` files | Pre-commit hook (auto-generated) | Both |

### 4.1 Acceptance Criteria

- [ ] No file is ever written by both Guya and Telos — ownership is enforced by convention and auditable by git blame
- [ ] Pre-commit hook can verify the author matches the ownership table (stretch goal)
- [ ] Manifests show no agent in `git blame` — only the hook script

---

## 5. Task Lifecycle

```
proposed (Guya/Daniel) → assigned (Telos) → in-progress (Guya) → complete (Guya) → graded (Telos)
                                                                                  → rejected (Telos, with reason)
```

### 5.1 Grading

Two-tier:
- **Acceptance** — binary. Did Daniel do the thing? Verified by artifact.
- **Quality grade** — A/B/C against standing pillar rubric in `goals/rubrics/pillar-N.md`.

Telos grades and cites:
- The artifact being graded (commit, file, test output)
- The rubric criterion applied
- The log entry where the work was done

### 5.2 Acceptance Criteria

- [ ] No task reaches `graded` without `grade_evidence:` pointing to a log entry and artifact
- [ ] Rejected tasks include `rejection_reason:` — rejections are evidence too
- [ ] A task's full lifecycle is reconstructable from its file alone (all state changes via frontmatter)
- [ ] Telos can answer "why did you grade this a B?" by pointing to a rubric line and an artifact

---

## 6. Sync Protocol

### 6.1 Guya → Constantia

- Guya writes to Constantia at **session end** (log entry + task status updates)
- Implemented via session-end hook or manual `/guya-reflect`
- Commit + push to remote after writes

### 6.2 Telos → Constantia

- Telos pulls from remote **before every tick**
- Writes evidence, grades, task assignments, profile updates
- Commit + push after writes

### 6.3 Constantia → Guya identity

- Manual sync via `/guya-evolve` (reads profile → updates `~/.claude/guya/` identity files)
- Session-start hook reads `tasks/MANIFEST.md` for current assignments (light read)

### 6.4 Latency Contract

Minutes, not seconds. If Telos ticks while Guya is mid-session, Telos sees the previous session's state. This is acceptable — Telos ticks twice daily, not in real time.

### 6.5 Acceptance Criteria

- [ ] Guya's session-end write is visible to Telos on the next tick (no missed writes)
- [ ] Telos's task assignment is visible to Guya on the next session start
- [ ] A failed push does not leave Constantia in a dirty local state — retry or alert
- [ ] Sync latency between write and remote availability is under 60 seconds

---

## 7. Data Integrity

### 7.1 Schema Validation

Pre-commit hook validates:
- Required frontmatter fields present per file type (task, evidence, log)
- `source:` fields point to existing files or valid commit SHAs
- Status values are from the allowed set
- Dates are valid ISO format

### 7.2 Weekly Integrity Check

Telos runs on schedule:
- Every profile claim has valid evidence pointers
- Every evidence entry has a valid source
- No orphaned tasks (assigned but no activity for >7 days without explicit pause)
- Manifest matches directory contents

### 7.3 Backup

- Constantia is a git repo with GitHub remote (private)
- Auto-push on every commit
- Full history preserved — any state recoverable via `git log`

### 7.4 Acceptance Criteria

- [ ] A malformed frontmatter write is rejected before it enters the repo
- [ ] Weekly integrity check surfaces all orphaned claims and stale tasks
- [ ] Any historical state of Constantia is recoverable via `git checkout <sha>`
- [ ] The repo has never had a force-push (branch protection on main)

---

## 8. Scope Constraint — Three Projects Only

All tasks, evidence, and growth tracking converge to three projects:

1. **Synthetic Data Factory (SDF)** — production ML pipeline, serves Pillar 1 + 3
2. **Guya + Telos** — the agent system itself, serves Pillar 2
3. **TBD — LLM inference project** — serves Pillar 1, to be decided with Telos's help

Every task must map to a pillar. Every pillar must map to a project. Work that doesn't serve a pillar doesn't get a task. This is the focusing constraint that prevents thin spreading.

### 8.1 Acceptance Criteria

- [ ] Every task has a `pillar:` field — no orphan tasks
- [ ] Telos rejects proposed tasks that don't clearly serve a pillar
- [ ] Quarterly review assesses whether the three projects still cover the three pillars — if gaps appear, the project list is revised, not expanded

---

## 9. Engineering Quality Standards

### 9.1 Token Efficiency

Guya's session-start read from Constantia must be light:
- Read `tasks/MANIFEST.md` — current assignments at a glance
- Read specific task files only when executing that task
- Never load full `log/` or `evidence/` at session start

### 9.2 Format Consistency

Agents write frontmatter with strict field ordering. Pre-commit hook rejects drift. This prevents the slow format corruption that happens when two different LLMs write "approximately YAML" over months.

### 9.3 Growth Bounds

- Log entries: one per day per agent (not per session — consolidate if multiple sessions)
- Evidence entries: no bound, but weekly consolidation merges redundant observations
- Profile claims: bounded by evidence — a claim without recent evidence ages out
- Tasks: proposed tasks not activated within 14 days are auto-closed by Telos with a reason

### 9.4 Acceptance Criteria

- [ ] Guya session-start reads ≤2 files from Constantia
- [ ] Pre-commit hook catches frontmatter field ordering violations
- [ ] No profile claim is older than 90 days without re-confirmation evidence
- [ ] Task backlog never exceeds 20 active items — Telos prioritizes, not accumulates
