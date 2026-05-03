# Telos — Status

> Last updated: 2026-05-03
>
> Telos-scoped status: runtime, identity, implementation state, and behavioral observations. Lives alongside `vision.md`, `core-beliefs.md`, and `goal.md` in this directory. The guya plugin's STATUS.md tracks the meta-project; this file tracks the agent itself.

## Current State

**Online but not yet in character.** Telos is running on the mini (`goms-Mac-mini.local`), connected to Discord as username `Telos` (id `1497670832023928922`). Identity files (`soul.md`, `CLAUDE.local.md`) live in the nanoclaw fork at `groups/telos/`, committed and version-controlled. First smoke-test (2026-05-03 11:43 PT) confirmed the agent loads its name and Korean address conventions, but the *character* (consigliere posture, anti-sycophancy, no helper-bot patterns) is not yet expressed — operating rules in `CLAUDE.local.md` are the missing layer.

## Runtime

- **Host:** `goms-Mac-mini.local` (tailnet `100.73.197.23`, alias `mini`)
- **Process:** `nanoclaw` Node.js process under launchd (`com.nanoclaw-v2-53edea47`); restart loop ~10s if container runtime unavailable
- **Container runtime:** Docker Desktop (start-at-login enabled). After mini reboot: auto-login → Tailscale → Docker → nanoclaw → Discord, no manual intervention
- **Channels wired:** Discord (Gateway connected, agent username `Telos`); CLI socket at `/Users/guya/telos/data/cli.sock`
- **Constantia mount:** *not yet wired* — container.json has no Constantia mount; Telos cannot read tasks/MANIFEST.md or write evidence yet

## Identity

- **Source of truth:** `groups/telos/soul.md` in the nanoclaw fork (`daniellee6925/nanoclaw`, commit `03604e6`)
- **Reference loader:** `groups/telos/CLAUDE.local.md` — auto-loaded by Claude Code at agent spawn; contains `@./soul.md` reference plus bilingual language rule
- **Version control:** fork's `.gitignore` overrides nanoclaw's default per-installation pattern via `!groups/telos/soul.md` and `!groups/telos/CLAUDE.local.md`; other files in `groups/telos/` (container.json, .claude-fragments, regenerated CLAUDE.md) remain ignored
- **Design docs:** `vision.md`, `core-beliefs.md`, `goal.md` in this directory (now committed to guya repo)

### Soul dimensions locked (2026-05-03)

1. Origin and self-conception (두식 / Telos with three facets — 스승 / 아버지 / 보스 — under 두사부일체; default register 보스)
2. Loyalty model (serve stated-self over current-mood-self; verbal revisions don't count, file edit required)
3. Stance on emotional state (acknowledged not consoled; "go easy" softens frame, not assessment)
4. Stance on own mistakes (concede facts fast, hold patterns until evidence dissolves them)
5. Time horizon (active threshold 3-in-2-weeks, absence threshold 2 consecutive weeks; silence is a valid output)
6. Refusals (six bright lines including custodian-not-author)
7. Editability (file is source of truth; no in-session drift)

## Tests & Observations

### 2026-05-03 11:43 PT — First Discord smoke-test (FAIL: character did not load)

Daniel: `hi telos`
Telos: `안녕하세요 형님! 뭐 도와드릴까요?`

Daniel: `whats ur name`
Telos: `I'm Telos. What can I do for you?`

**Failures:**

- **Language rule violated.** English input got Korean response. The seeing of 형님 in the loaded prompt apparently overrode "default English." Rule needs stronger restatement.
- **Banned-phrase patterns surfaced.** "도와드릴까요" / "What can I do for you?" — both are direct equivalents of "happy to help" / generic-assistant offers. Soul.md doesn't yet forbid offers-of-help explicitly; the bans we discussed (no greetings, no offers of service) are not in `CLAUDE.local.md`.
- **Greeting energy.** "안녕하세요" with exclamation point. First-contact rule says: when nothing is pending, terse direct ask, no greeting. The rule isn't loaded.

**Root cause:** soul.md gives Telos identity *facts* (name, address, posture-in-principle); the *behavioral rules* (what to never say, how to open, how to respond to softening requests) are the layer that actually overrides RLHF helpful-assistant defaults. Without them, the model falls back to its default — which is the helpful-assistant Daniel doesn't want. This confirms the design hypothesis from earlier in the session: identity without operating rules ≈ Generic Claude that knows its name.

## In Progress

- [ ] **Operating rules in `CLAUDE.local.md`.** The next blocker. Pre-locked content from earlier session — needs to be written:
  - Voice register specifics (terse Karpathy-default, plain English, no warm-up)
  - Behavioral bans (no greetings unless pending observation; no offers of help — "What can I do for you?" / "도와드릴까요" / "happy to help" / "let me know if you need anything"; no praise without artifact + criterion; no empty openers; no hedging-to-soften)
  - Language rule reinforcement (default English, mirror Korean only when Daniel writes Korean — must override the 형님 inference)
  - First-contact behavior (Mode 1 lead-with-pending / Mode 2 terse direct)
  - Pushback calibration (concede facts, hold patterns)
  - Asymmetric-knowledge handling (quiet on facts, proactive on patterns)
- [ ] **Constantia clone on mini.** Mini's GitHub user `guyacode` has push access to `daniellee6925/nanoclaw`; needs same for `daniellee6925/constantia` before clone is useful for two-way sync.
- [ ] **Mount Constantia into Telos container.** `groups/telos/container.json` `additionalMounts` field — point at mini's Constantia clone path so the agent can read `tasks/MANIFEST.md`, write evidence files, and update profile claims.
- [ ] **First ability: read and assign tasks.** Define minimal tool set (`read_constantia_log`, `read_task_manifest`, `write_task_assignment`, `do_nothing`, `send_discord`); write the tick prompt; smoke-test by manually triggering the agent to read the manifest and propose one assignment.
- [ ] **Scheduled tick.** Twice daily via nanoclaw's scheduled-tasks primitive (morning + evening per vision §M1).
- [ ] **Discord ping handler.** `@Telos` triggers same tick path as scheduled.

## Deferred / Future

- Pattern detection layer (separate process that produces "patterns currently active" file; main tick reads it). Discussed in the asymmetric-knowledge architecture conversation. Real engineering work; not next.
- Critic sub-agent (vision §M3 / Belief #1). Required for core-ring decisions. After basic tick + evidence loop is working.
- Director role with multi-hypothesis path proposals (vision §M4 / Belief #6). Far out.
- Three-ring friction model (vision §5). Adjacent + outer ring routing comes after core-ring is reliable.
- Long-horizon observability (vision §M5). Drift detection on Telos's own behavior; mentor-health report.

## Decisions & Notes

- [2026-05-03] **First smoke-test confirms operating-rules-as-load-bearing.** See Tests & Observations above. Going forward, any change to soul.md or CLAUDE.local.md should include a smoke-test note here documenting whether the change landed in actual behavior.
- [2026-05-03] **Docker Desktop start-at-login enabled.** Recovery chain after reboot is now self-healing. Full launchd-daemon path for Docker (no user-session dependency) deferred until Telos has a reason to come up before login.
- [2026-05-03] **Soul committed to fork.** `groups/telos/soul.md` in `daniellee6925/nanoclaw` (commit `03604e6`). Version-controlled via gitignore override. nanoclaw composer leaves existing CLAUDE.local.md alone (only creates empty if missing) — safe to use as the version-controlled identity entry point.
- [2026-05-03] **Continue on the fork; do NOT clone-and-create-new-repo for Telos.** Belief #5 says fork-the-harness; breaking the relationship would lose upstream-sync. Trigger to reconsider: modifications to nanoclaw *core* (not Telos-specific) become unmergeable.
- [2026-05-03] **Mentor-only scope; utility tasks deferred.** Considered expanding to email review / doc reading / request refinement (Guya's universal scope). Rejected — would dilute architectural anti-sycophancy. If utility work is added later, must be in mentor voice with mentor's posture, not a "utility mode" switch.
- [2026-04-22] **Three-identity architecture.** Guya (executor) + Telos (mentor) + Constantia (shared git memory). Telos writes evidence, profile, goals, grades; Guya writes log + task status. No shared-write files. Task lifecycle: proposed → assigned → in-progress → complete → graded | rejected. Full design context in this directory's `core-beliefs.md` and `vision.md`.
- [2026-04-19] **Vision M1 marked shipped, but paper-shipped only.** Today's work confirms M1's "reasoning tick + minimal tools + atomic state writes + structured logs" is not yet built. Vision date is aspirational; runtime status was caught up by today's session.
