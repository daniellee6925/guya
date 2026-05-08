# Pre-Reorg Telos State Snapshot

Captured 2026-05-08, immediately before Phase 1 of the reorg in `docs/2026-05-08-telos-reorg.md`. This file is read-only reference for rollback verification.

---

## Mini host paths

- nanoclaw fork checkout: `/Users/guya/telos`
- constantia checkout: `/Users/guya/constantia`
- launchd plist: `/Users/guya/Library/LaunchAgents/com.nanoclaw-v2-53edea47.plist`
- nanoclaw runtime: `/opt/homebrew/bin/node /Users/guya/telos/dist/index.js`
- working dir: `/Users/guya/telos`
- logs: `/Users/guya/telos/logs/{nanoclaw.log,nanoclaw.error.log}`
- nanoclaw main DB: `/Users/guya/telos/data/v2.db`
- session DBs root: `/Users/guya/telos/data/v2-sessions/`

Note: `/workspace/extra/...` paths in CLAUDE.local.md and tick prompts are CONTAINER-INTERNAL paths (mounted from host). The host-side equivalents are under `/Users/guya/telos/data/`.

## Pre-tag commit SHAs (`pre-reorg-2026-05-08`)

| Repo | Path | SHA |
|------|------|-----|
| constantia | laptop `~/Desktop/constantia`, mini `/Users/guya/constantia`, origin | `b5b6873b503fccbf68eab5b4bc1371e2f5261f68` |
| telos (nanoclaw fork) | laptop `~/Desktop/telos`, mini `/Users/guya/telos`, origin | `2270de8b8a955658cdc2dfbe8c1aded41ced2f06` |

## File hashes

| File | SHA-256 |
|------|---------|
| `guya/data/bytebytego_course_plan.md` | `227a8ea6a79477922b4c5c27866756d5ef4b44057f2451056e6e80b509708745` |

## Telos agent + session inventory

**Agent group**: `ag-1777143186174-ykqd40` (single group)

**Sessions** (3 total under that group):

| Session ID | Inbound msg count | Role | Status |
|------------|-------------------|------|--------|
| `sess-1777143186178-0bacbi` | 119 | **active "work" session** — preserved as-is into Phase 2 | live |
| `sess-1777872447077-gghtt3` | 1 | abandoned/test | inactive |
| `sess-1777872452965-ngenkk` | 1 | abandoned/test | inactive |

## Active session — recurring crons (work session)

Querying `inbound.db` of `sess-1777143186178-0bacbi`:

| ID (next-fire row) | Recurrence | Series ID | Prompt file (container path) | Next fire (UTC) |
|--------------------|------------|-----------|------------------------------|------------------|
| `task-1778256334628-2fn1kk` | `0 9 * * *` | `task-1778103225001-morn` | `/workspace/agent/tick-morning-prompt.md` | 2026-05-09 16:00 = 9am PT |
| `task-1778213006474-iyh3rh` | `0 21 * * *` | `task-1778103225002-eve` | `/workspace/agent/tick-evening-prompt.md` | 2026-05-09 04:00 = 9pm PT |
| `task-1778220028535-a3pk1o` | `0 23 * * *` | `task-17779308213N-rfltky` | `/workspace/agent/reflect-prompt.md` | 2026-05-09 06:00 = 11pm PT |

**Reorg implications**:
- Existing morning tick (9am) — prompt content changes per Phase 2; cron schedule kept.
- Existing evening tick (9pm) — prompt content changes per Phase 2; cron schedule kept.
- Existing reflect (11pm) — kept unchanged per the design doc decision.
- NEW 1pm midday tick — must be added in Phase 2 with `0 13 * * *` recurrence.

## Container/runtime status at capture

- launchd label: `com.nanoclaw-v2-53edea47`
- PID: 39053 (running)
- Status: `0` (no errors)
- KeepAlive=true, RunAtLoad=true → restarts automatically on failure or boot.

## Files referenced from tick prompts (in-flight edits committed in `2270de8`)

- `groups/telos/tick-morning-prompt.md` — added "Step 0: Evidence promotion" before all other steps (autonomous self-improvement, see scribe memory 5238-5240).
- `groups/telos/CLAUDE.local.md` — added "Notes and open threads" + "Outbound message splitting (Discord 2000-char limit)" sections.

These are now committed in `2270de8` and tagged at `pre-reorg-2026-05-08`. Rollback restores them.

---

## Rollback verification commands

To verify rollback brought everything back to this state:

```bash
# repos at expected SHA
cd /Users/daniel/Desktop/constantia && git rev-parse HEAD  # → b5b6873b503fccbf68eab5b4bc1371e2f5261f68
cd /Users/daniel/Desktop/telos && git rev-parse HEAD       # → 2270de8b8a955658cdc2dfbe8c1aded41ced2f06
ssh mini 'cd /Users/guya/constantia && git rev-parse HEAD' # → b5b6873b503fccbf68eab5b4bc1371e2f5261f68
ssh mini 'cd /Users/guya/telos && git rev-parse HEAD'      # → 2270de8b8a955658cdc2dfbe8c1aded41ced2f06

# bytebytego file present + unchanged
shasum -a 256 /Users/daniel/Desktop/guya/data/bytebytego_course_plan.md
# → 227a8ea6a79477922b4c5c27866756d5ef4b44057f2451056e6e80b509708745

# active work session has only 3 recurring crons
ssh mini 'sqlite3 /Users/guya/telos/data/v2-sessions/ag-1777143186174-ykqd40/sess-1777143186178-0bacbi/inbound.db "SELECT COUNT(*) FROM messages_in WHERE recurrence IS NOT NULL AND recurrence != \"\";"'
# → 3

# launchd nanoclaw service running
ssh mini 'launchctl list | grep nanoclaw'
# → 39053  0  com.nanoclaw-v2-53edea47  (PID may differ)
```
