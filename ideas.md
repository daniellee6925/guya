# Ideas Backlog

> Captured 2026-05-04. Ranked by leverage × effort × alignment with core beliefs (memory, evolution, three-identity system). Convergence note: three carry-forwards from yesterday (nanoclaw fork commit, mcp-server.ts split <800 LOC, /guya-reflect log path) should close before pulling new work. Pick one tier-S item after that.

---

## Tier S — Do next (high leverage, low-to-medium effort)

### S1. Remove unused skills (was #2)

**What:** Audit `~/.claude/guya/skills/` and `.claude/plugins/guya/skills/` for skills that haven't fired or that duplicate other skills. Likely candidates: obsidian-sync (manual flow already works), possibly others. Delete or archive.

**Why this first:** Cruft is a symptom of drift. Every unused skill is description-tokens loaded into every session that could trigger spuriously. Aligns with Belief 1 (memory fidelity) — fewer, sharper skills > more, ambiguous skills.

**Effort:** ~1-2h. Read each skill's frontmatter, grep usage in transcripts, decide keep/kill.

**Done when:** Skill list trimmed, deletions committed to `~/.claude/guya/`, session-start context measurably smaller.

---

### S2. GitHub issue creator skill for tangential bugs (was #8)

**What:** Skill `guya-issue` that captures a bug found mid-feature-work into a GitHub issue without context-switching. Auto-detects repo from cwd, prefills title/body from current conversation context, opens the issue via `gh issue create`.

**Why:** Solves a real recurring problem — finding a bug while implementing X, then either fixing it (scope creep) or losing it. This is the canonical "tangential context" failure mode. High frequency use case.

**Effort:** ~2-3h. Skill markdown + Bash to call `gh`. Needs a small protocol: skill collects "what's the bug, where, severity" then commits to an issue.

**Done when:** `/guya-issue "auth middleware leaks tokens on 500"` opens an issue in the current repo and continues the original task.

**Open question:** Should it also write to Constantia tasks/proposed? Probably no — GitHub for code bugs, Constantia for growth tasks. Don't blur ownership (Belief 4).

---

### S3. `second-opinion` skill — replaces deleted `guya-pr`

**What:** Skill `second-opinion` that just shells out to Codex (`codex` CLI) and asks for its opinion on the current diff / file / question. No PR-readiness checks, no summary generation, no orchestration — just "ask the other model what it thinks."

**Why:** The killed `guya-pr` skill (0 invocations) tried to do too much — Codex pass + readiness checks + summary. The only piece of that with real value is the independent fresh-eyes review. Strip it down to that one thing. Different name signals it's general-purpose, not PR-only.

**Effort:** ~30min. Single SKILL.md that calls `codex` via Bash with the current file or diff piped in. Argument-hint accepts a path or defaults to staged diff.

**Done when:** `/second-opinion` returns Codex's read on whatever's in scope, no other ceremony.

**Open question:** Should it also accept a free-form question ("second-opinion: is this race condition real?"), or strictly file/diff-scoped? Lean toward both — it's the same Codex call, just different input framing.

---

### S4. Task priority field (was #5)

**What:** Add `priority: P0|P1|P2` to Constantia task frontmatter. Tick protocol (mem 4110) already has priority-based decision logic but tasks themselves don't carry an explicit priority — Telos infers from text. Make it explicit.

**Why:** Closes the loop on Cut A. Without explicit priority, Telos's triage logic operates on inferred signal and can misorder when multiple tasks compete.

**Effort:** ~1-2h. Schema update in Constantia pre-commit validator + tick-prompt update + manifest builder includes priority + retrofill existing tasks.

**Done when:** New tasks require priority, manifest sorts by priority, tick protocol picks P0 over P1 deterministically.

**Verify first:** Does Telos already do this implicitly via tick-prompt? If yes, lower priority — it's just making implicit explicit.

---

## Tier A — Next, fills real gaps

### A1. Task lifecycle states: proposed → assigned → in-progress → completed (was #4)

**What:** Formalize task states in Constantia. Today: `proposed` and `accepted` exist. Add `assigned` (Telos accepted but not started), `in_progress` (Guya started work), `completed` (Guya marked done, awaiting Telos grade), `graded` (Telos closed).

**Why:** Daniel asked for this; the system already partially has it. Making the state machine explicit lets the manifest show "what's actively being worked on" vs "what's queued."

**Effort:** ~2-3h. State enum in pre-commit validator, manifest groups by state, MCP tool to transition states.

**Verify first:** Audit current task statuses. There may already be enough states — confirm the gap before adding.

---

### A2. Optimize in pre-commit hook (was #1)

**What:** Add `guya-optimize` as a third pass after review → deep-review. **Advisory only**, not blocking — optimize involves trade-offs (readability vs speed) and shouldn't gate commits.

**Why:** Catches inefficiency at write time, when it's cheapest to fix. But: hard-gating optimize would create false-positive blocks on judgment calls.

**Effort:** ~1-2h. Update `pre-commit-config.json`, add `optimize` step with `blocking: false`, surface findings in commit log.

**Risk:** Adds noise to every commit. If findings frequency is high, this becomes ignored — same failure mode as ADR-011 silent rot. Sample first: run optimize on last 10 commits manually, count actionable findings.

---

### A3. project-compact skill (was #9)

**What:** Skill that compacts conversation context but preserves project foundations (CLAUDE.md, core-beliefs, vision, current task) so a session can continue with fresh context without reloading the whole codebase.

**Why:** Mid-session context bloat is real. Full `/compact` loses task continuity; restart loses project ramp-up. This is a middle path.

**Effort:** ~2-3h. Skill orchestrates: dump current task state → /compact → reload foundational files via @-imports.

**Open question:** Is this materially different from `/compact` followed by re-reading CLAUDE.md? If `/compact` already preserves system context, this might be redundant. Test before building.

---

## Tier B — Bigger, requires scoping

### B1. Poacher skill — idea harvester (was #3)

**What:** Skill that reads articles, blog posts, or codebases and extracts ideas relevant to Guya or Telos. Output: structured proposals to `ideas.md` or Constantia `proposed` tasks.

**Why useful:** Daniel reads a lot; capture is leaky. Right framing turns reading into agent improvement.

**Why risky:** Loose scope = low signal. Without strong filtering, you get "10 ideas from this article" most of which don't fit Guya's beliefs. Could become idea-generation noise.

**Scope discipline before building:**
- What's the input? URL / file / paste?
- What's the relevance filter? (Run against core-beliefs.md as a check?)
- Where does output go? `ideas.md` (this file) or proposed tasks?
- Max 3 ideas per source — force ranking.

**Effort:** ~3-4h. Worth building but only after scope is tight.

---

### B2. Pillar 1 (serving + inference) project (was #6)

**What:** Create a dedicated project/learning track for serving + inference (Daniel's pillar 1).

**Needs clarification:** "Project" is ambiguous —
- A new repo for serving experiments?
- A Constantia goal pillar with rubric + tasks?
- A learning curriculum tracked via `/guya-learn`?

**Why:** Pillar 1 is named in Daniel's growth pillars but doesn't have a structured home. Without one, learning here is ad-hoc.

**Effort:** Depends on form. Rubric + Constantia goal: ~2h. New repo with starter projects: ~1 day.

**Decide first:** What does "project" mean here? Until that's clear, no estimate.

---

### B3. Local UI for tasks / reflections / todos across Guya / Telos / Constantia (was #7)

**What:** A local web UI that runs persistently (not killed between sessions), reads from Constantia git repo + `.guya/` + Telos state, and renders tasks, reflections, recent activity, growth grades.

**Why:** Visibility is currently CLI-only. A glanceable UI would surface state without needing to ask Guya.

**Why last:**
- Largest scope of all 9 ideas
- Existing CLI tools work
- Risk of becoming a maintained surface that diverges from source-of-truth files
- "Run locally without killing" implies always-on process — borderline violation of Belief 3 (no daemons). Justifiable as a read-only viewer, but nudges toward the daemon pattern.

**Effort:** ~1-2 days for a minimal Next.js or simple HTML+SSE viewer. More if real-time updates.

**Build only when:** CLI introspection is provably the bottleneck. Right now it isn't.

---

## My recommendation

Close the three carry-forwards first (1-2h total). Then S1 (kill unused skills) — it's pure cleanup and shrinks every future session. Then S2 (issue creator) since it solves a daily friction point. S3 (second-opinion) is a 30min replacement for the deleted `guya-pr`. S4 (task priority) only after verifying it isn't already implicit in tick-prompt.

Save tier B until the system has fewer loose ends. Especially B3 — a UI before the underlying data model is settled is a maintenance trap.
