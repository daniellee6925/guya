---
name: guya-telos-scribe
description: Update Telos design docs and Constantia static decision docs (pillars, milestones, open questions) based on what changed this session. Use when Daniel says "telos scribe", "update telos docs", "scribe telos", "/guya-telos-scribe". Trigger proactively after a session that visibly changed Telos infra (new ADR, new MCP tool, container reshape, addendum edit, daemon behavior, routing fix), a session that locked a commitment or shifted a review date, or a session that resolved a pillar/project/milestone/open-question decision. /guya-scribe is universal and updates project STATUS/ARCH/CLAUDE; this skill is Guya-project-only and covers the Telos surface that /guya-scribe deliberately doesn't touch.
---

# Telos Scribe — Telos & Constantia Decision Doc Updater

Sibling of `/guya-scribe`. Same reflexive verb, different surface. `/guya-scribe` covers the project meta (STATUS / ARCHITECTURE / CLAUDE). This skill covers the Telos-side surface that scribe deliberately leaves alone: Telos design docs in this repo, and the static decision-anchored docs in the Constantia repo.

## Why this exists separately

`/guya-scribe` runs in every project (SDF, Guya, BosonAI, others). Telos docs only exist here. Folding Telos-specific logic into scribe would pollute the universal skill. Two skills, two verbs, clear scope per skill.

## Path resolution

This skill works against two repos. Resolve their roots before any file operation:

- **`<GUYA>`** — the Guya repo root. This skill is project-scoped to Guya, so `<GUYA>` is the current repo. Use `git rev-parse --show-toplevel` if unsure.
- **`<CONSTANTIA>`** — the Constantia repo root. Resolve by reading `~/.claude/guya/constantia.json` (JSON object with a `path` field). If the config file is missing or malformed, fall back to `~/Desktop/constantia`. Surface a one-line warning if the fallback is used.

All paths below use these placeholders. Substitute the resolved values at runtime.

## What this skill touches

**In scope:**
- `<GUYA>/telos context/STATUS.md` (Next session, Current State, Runtime, Identity, In Progress sections)
- `<GUYA>/telos context/goal.md` (commitment state, review dates, project locks)
- `<GUYA>/telos context/vision.md` (**confirm before any edit**)
- `<GUYA>/telos context/core-beliefs.md` (**confirm before any edit**)
- `<CONSTANTIA>/goals/pillars.md`
- `<CONSTANTIA>/goals/milestones.md`
- `<CONSTANTIA>/goals/open-questions.md`

**Explicitly out of scope** — Telos owns these via tick prompts + pre-/clear synthesis. Competing writes corrupt ownership boundaries (ADR-009 / core-belief #4 — three-layer memory with clear ownership):
- `profile/*.md`, `evidence/EVD-*.md`
- `goals/today-plan.md`, `goals/weekly-schedule.md`
- `tasks/*` including `tasks/learn/curricula/*` (Telos-authored, Daniel-curated — refer to but do not edit)

If a Telos-owned file looks stale, raise it with Daniel — don't fix it from this skill.

## Pre-flight checks

Before running any pass, verify the targets exist:

1. **`<GUYA>/telos context/`** — if missing, Telos isn't bootstrapped in this repo. Skip Pass A and B silently with a one-line note (`telos context/ not present — skipping Telos doc passes`).
2. **`<CONSTANTIA>`** — if the resolved path doesn't exist or isn't a git repo, skip Pass C silently with a one-line note (`constantia not present locally — skipping pass C`).
3. **Individual target files** — if a specific file (e.g., `goals/milestones.md`) doesn't exist when a pass wants to write to it, create it from a minimal template before editing rather than failing. Surface a one-line note that the file was created fresh.

## The three passes

The skill runs three decision-detection passes. Each pass scans the conversation for its specific signal. **If a pass has no signal, skip it silently** — do not ask a question with nothing to ground it in. On auto-trigger, the skill should produce zero output for a session that touched nothing Telos-related. On explicit invocation (Daniel typed `/guya-telos-scribe`), end with a final report (see Output discipline) so Daniel knows the skill ran.

**Passes can co-fire on the same fact.** A single decision often lands in multiple surfaces. The canonical example: "Pillar 1 project = Production Serving Cookbook" requires both Pass B (`goal.md` commitment state) AND Pass C (`pillars.md` project assignment). Always run all relevant passes for a given decision — splitting recreates the exact rot pattern this skill exists to prevent. Use the consistency check at the end to catch single-surface updates that should have been multi-surface.

When a pass detects signal, ask one targeted question grounded in the actual conversation content. Don't enumerate every possible change — propose specific deltas you observed.

### Pass A — Telos infra/runtime changes

**Targets:** `telos context/STATUS.md`. Sections likely to need updates: Current State, Runtime, Identity, In Progress, Next session — start here.

**Signal:** this session changed any of:
- Telos container shape (new session, container kill, image rebuild)
- MCP tool surface (new tool, signature change, validator extraction)
- Addendum / CLAUDE.local.md / soul.md content for any of WORK/LIFE/LEARN
- Identity, voice register, or persona changes
- Cron schedules, scheduled inbound rows, reminder firing
- Mounts, bind-mount strategy, container.json, mount allowlist
- Daemon behavior (`constantia-sync`, `check_reminders.sh`), launchd plist changes
- Routing, destinations table, agent_destinations rows, Discord channel/DM changes
- Any new ADR in `guya/CLAUDE.md` ADR table that touches Telos
- Bugs surfaced or fixed in Telos runtime (silent-rot finds)

**Action:** rewrite the affected sections of `telos context/STATUS.md`. Preserve the Operations Runbook, Tests & Observations, and Decisions & Notes sections — those are historical record. New observations from this session go at the top of Tests & Observations (with date heading). New decisions go at the top of Decisions & Notes (with date heading).

The **Catch-up Summary** section is for *catch-up* only — when STATUS was stale for ≥7 days and a multi-day delta needs filling. Single-session updates do NOT go here; route them to Tests & Observations or Decisions & Notes. This keeps Catch-up Summary as a sparse, well-scoped section rather than a dumping ground.

If the session shipped a new ADR that's already in `guya/CLAUDE.md`, do NOT re-chronicle it in detail here — point to the ADR ID and summarize the Telos-side impact in one paragraph. Avoid duplicate authoritative content across the two STATUS files.

### Pass B — Telos commitment changes

**Targets:** `telos context/goal.md`.

**Signal:** this session changed any of:
- A pillar's locked project (e.g., "Pillar 1 project = Production Serving Cookbook")
- The review date / cadence
- Pillar weighting or allocation rule (e.g., "work-criticality first, non-work gets maintenance")
- The 3-year stretch target or staff-level horizon
- The identity / north-star framing

**Action:** edit `goal.md` to reflect the new commitment state. Update the `Last updated:` line.

### Pass C — Constantia static decision docs

**Targets:** `constantia/goals/pillars.md`, `constantia/goals/milestones.md`, `constantia/goals/open-questions.md`.

**Signal:** this session changed any of:
- A pillar's definition, served-by, or project assignment → `pillars.md`
- A milestone was hit, added, removed, or its acceptance criterion shifted → `milestones.md`
- An open question was raised, refined, or resolved → `open-questions.md` (move resolved entries to a Resolved subsection rather than deleting)

**Action:** edit the appropriate file(s). Keep entries grounded in actual decisions Daniel made or confirmed in conversation — never invent.

## Confirm-before-touch: vision.md and core-beliefs.md

These two files are slow-moving by design. Vision-level intent and core architectural beliefs do not shift session-to-session. Auto-editing them is the wrong default.

If a pass appears to want to edit either: stop and ask Daniel explicitly. Present the proposed change verbatim. Require explicit `y` before writing. If Daniel says no or hesitates, leave the file alone — the question itself is valuable signal (means we have drift to discuss, not necessarily edit).

Examples that warrant confirmation:
- Daniel says "actually I think vision item 4 doesn't apply anymore"
- A new core belief surfaces from sustained pattern (e.g., a sixth principle observed across many sessions)
- A vision acceptance criterion is structurally wrong post-architectural-change

Examples that do NOT warrant editing:
- Daniel mentions a vision-level concept in passing
- A session reinforces an existing belief — no edit needed
- A new ADR — that's a runtime fact (Pass A's surface), not a vision shift

## Commit handling

Each pass commits independently in the appropriate repo. No cross-repo atomicity needed — failure of one doesn't corrupt the others.

**Pass A and B (guya repo):**
- Stage only the files this pass touched: `git -C <GUYA> add "telos context/STATUS.md"` (and/or `goal.md`)
- Commit: `git -C <GUYA> commit -m "chore(telos-scribe): <pass-letter> — <summary>"`
- Examples:
  - `chore(telos-scribe): A — daemon health surface + WORK channel-only routing`
  - `chore(telos-scribe): B — Pillar 1 project lock + review date refresh`

**Pass C (constantia repo):**
- Stage only the files this pass touched: `git -C <CONSTANTIA> add goals/pillars.md` (etc.)
- Commit: `git -C <CONSTANTIA> commit -m "chore(scribe): telos sync — <summary>"`
- Example: `chore(scribe): telos sync — Pillar 1 project = Production Serving Cookbook; resolve LLM-inference questions`
- **Constantia push is owned by the `constantia-sync` launchd daemon (ADR-024).** Do not push from this skill. The daemon polls every 5s and handles fetch + rebase + push. Just commit locally and walk away.

**Commit-failure handling:** If `git commit` fails for any pass (pre-commit gate fires, rebase needed, etc.), surface the failure to Daniel and stop this pass. Do NOT retry blindly — the gate or conflict typically signals something worth a human look. Other passes can continue independently.

### Daemon-stale check before Constantia commits

Before any Pass C commit, read `<CONSTANTIA>/.git/sync-status.json` if it exists:
- If `last_cycle_ts` is older than 5 minutes OR `last_cycle_outcome` is `conflict` / `push-failed` / `fetch-failed`: surface a one-line warning to Daniel (`constantia-sync daemon heartbeat is stale / last cycle errored — committing anyway, but push will lag`). Commit anyway. File durability is the contract; daemon push lag is the daemon's problem.
- If the file doesn't exist (e.g., running on laptop where daemon isn't deployed): silently commit. Daniel knows the sync model.
- If the file exists but fails to parse (mid-write race against the daemon's atomic rename, unlikely but possible): treat as stale, surface the warning, commit anyway.

## Detection discipline

- **Skip silently if no signal.** A session that didn't touch Telos infra, commitments, or Constantia decisions produces no output from this skill. No "nothing to do here" message — just no output for that pass.
- **Don't enumerate possibilities to fish for changes.** Propose specific deltas grounded in conversation content. If you can't name a concrete change, the signal isn't there.
- **One question per active pass, max two.** The question should reference specific observed change(s), not present a checklist.
- **Confirm scope when ambiguous.** If you're not sure whether a change is Pass A (runtime) or Pass B (commitment), ask Daniel which surface it lands on. He owns the routing call.

## Output discipline

When editing existing sections, preserve unchanged content. The pattern: read the section, identify the specific lines that need to change, edit those lines. Don't rewrite whole sections unless the section is structurally wrong.

When adding new entries to append-only sections (Tests & Observations, Decisions & Notes in `STATUS.md`), insert at the top of the section with a clear date heading. Older entries stay below — they are the historical chronicle.

For `telos context/STATUS.md` specifically, do not duplicate ADR content already in `guya/CLAUDE.md`. Point to the ADR ID and summarize the Telos-side impact briefly.

### Final report (always emit on explicit invocation; suppress on auto-trigger when zero passes fired)

After all passes complete, emit a one-block summary so Daniel can see the skill ran and what it did:

```
Telos-scribe report:
- Pass A: <fired | skipped — no signal>
- Pass B: <fired | skipped — no signal>
- Pass C: <fired | skipped — no signal>
- Files touched: <list, or "none">
- Commits: <SHA + repo, or "none">
- Warnings: <e.g., daemon-stale, file-created-fresh, fallback-constantia-path>
```

### Consistency check

After all passes complete, do one quick scan: does any edit you made imply an edit elsewhere you didn't make? Common cases:
- Pillar/project decision edited in `goal.md` but not in `pillars.md` (or vice versa)
- Resolved open question removed from `open-questions.md` without a corresponding `pillars.md` or `milestones.md` update if the resolution implies one
- A new milestone added in `milestones.md` without acknowledgment in `STATUS.md` In Progress

If you find a gap, run the missing pass before reporting done.

## Rules

- **Don't invent content.** Record what changed in this session — read the conversation, git log, recent commits. Never fabricate decisions, milestones, or runtime claims.
- **Append-only sections stay append-only.** Tests & Observations, Decisions & Notes in `STATUS.md` accumulate; never edit or remove past entries unless Daniel asks.
- **No daemon push from this skill.** Constantia commits land locally; the `constantia-sync` daemon owns push (ADR-024).
- **vision.md and core-beliefs.md require explicit confirmation.** Always present the proposed change and require `y` before writing.
- **Skip silently when no signal.** Don't produce noise on sessions that didn't touch Telos surface.
- **Preserve Telos-owned files.** Never write to `profile/`, `evidence/`, `goals/today-plan.md`, `goals/weekly-schedule.md`, or `tasks/`. These are Telos's surface, not Guya's.
- **Update `Last updated:` lines** when editing files that have them (`STATUS.md`, `goal.md`).
