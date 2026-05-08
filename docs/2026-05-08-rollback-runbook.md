# Telos Reorg — Rollback Runbook

**Companion to**: `docs/2026-05-08-telos-reorg.md`

**Purpose**: explicit per-phase rollback if any implementation phase fails its smoke test or causes unexpected behavior. Run end-to-end if needed.

---

## Pre-conditions captured at Phase 0

### Snapshot tags

| Repo | Path | Tag | Commit |
|------|------|-----|--------|
| constantia | `/Users/daniel/Desktop/constantia` (laptop) + `/Users/guya/constantia` (mini) + origin | `pre-reorg-2026-05-08` | `b5b6873b503fccbf68eab5b4bc1371e2f5261f68` |
| telos (nanoclaw fork) | `/Users/daniel/Desktop/telos` (laptop) + `/Users/guya/telos` (mini) + origin | `pre-reorg-2026-05-08` | `2270de8b8a955658cdc2dfbe8c1aded41ced2f06` |
| nanoclaw upstream (reference only) | `/Users/daniel/Desktop/projects/learning-agentic-flow/resource/nanoclaw` | (untagged — clean upstream clone, not modified) | `934f063` |

Tags converged at the same SHA across laptop, mini, and origin via:
- Constantia: rebased laptop's local commit (`9b87a77`) onto origin's main (was 6 commits ahead), pushed; MANIFEST resync commit added (`b5b6873`); mini fast-forwarded.
- Telos fork: committed mini's in-flight edits (`+23 lines` to `groups/telos/CLAUDE.local.md` + `tick-morning-prompt.md`) as `2270de8`, pushed; laptop fast-forwarded.

See `docs/2026-05-08-pre-reorg-state.md` for full pre-reorg Telos state (session IDs, cron entries, runtime config).

### File hashes (verify byte-identical migration)

| File | Source | SHA-256 |
|------|--------|---------|
| bytebytego curriculum | `guya/data/bytebytego_course_plan.md` | `227a8ea6a79477922b4c5c27866756d5ef4b44057f2451056e6e80b509708745` |

After Phase 1 migration, verify: `shasum -a 256 /Users/daniel/Desktop/constantia/learn/curricula/bytebytego-systems.md` matches the hash above.

---

## How to use this runbook

1. Identify the highest-numbered phase that landed cleanly (smoke test passed).
2. Roll back from the failed phase down to that gate.
3. Each phase below has: **what changed** → **revert commands** → **post-rollback smoke**.
4. If multiple phases need reverting, work in REVERSE order (highest phase first).

---

## Phase 1 — Constantia schema

**What changed**:
- New dirs: `constantia/tasks/{proposals,tasks,learn,learn/curricula,reminders,archive/2026-05-07}`
- Moved files: existing `T-*.md` + `P-*.md` → `archive/2026-05-07/` with `status: archived`
- Moved file: `guya/data/bytebytego_course_plan.md` → `constantia/learn/curricula/bytebytego-systems.md`
- New file: `constantia/goals/weekly-schedule.md` (template)
- Rewritten file: `constantia/tasks/MANIFEST.md` (4-section format)
- Updated hooks: `constantia/.git/hooks/pre-commit` (per-dir validator) + `post-commit` (4-section walker)
- Symlinked hooks on mini (per ADR-016)

**Revert commands**:
```bash
cd /Users/daniel/Desktop/constantia
git reset --hard pre-reorg-2026-05-08
git push --force-with-lease origin main  # only if Phase 1 was already auto-pushed
# pre-commit/post-commit hooks are tracked in repo → reset restores them
ssh mini 'cd /Users/guya/constantia && git reset --hard pre-reorg-2026-05-08'

# Restore bytebytego file in guya repo
# NOTE: bytebytego_course_plan.md was UNTRACKED in guya repo. Phase 1 deleted
# the working-copy. To restore, fetch from constantia at Phase 1's commit:
cp /Users/daniel/Desktop/constantia/.git/objects-or-restore-from-origin /tmp/bb.md
# OR: git show cd6651a:tasks/learn/curricula/bytebytego-systems.md > /Users/daniel/Desktop/guya/data/bytebytego_course_plan.md
mkdir -p /Users/daniel/Desktop/guya/data
git -C /Users/daniel/Desktop/constantia show cd6651a:tasks/learn/curricula/bytebytego-systems.md \
    > /Users/daniel/Desktop/guya/data/bytebytego_course_plan.md
```

**Post-rollback smoke**:
- `cd /Users/daniel/Desktop/constantia && ls tasks/` shows old T-*.md and P-*.md (no subdirs).
- Existing `T-*.md` validates on commit (old format).
- `shasum -a 256 /Users/daniel/Desktop/guya/data/bytebytego_course_plan.md` matches `227a8ea6...`.

---

## Phase 2 — Telos MCP tools + work session update

**What changed**:
- Telos MCP tools updated to new schema (propose_task / accept_proposal / assign_task signatures changed; new tools added)
- Work session's `CLAUDE.local.md` rewritten
- Work session's nanoclaw cron entries swapped (old morning + evening removed; 9am + 1pm + 9pm added)
- Fork commit deployed to mini, work session container restarted

**Revert commands**:
```bash
cd /Users/daniel/Desktop/telos
git reset --hard pre-reorg-2026-05-08
ssh mini 'cd ~/Desktop/telos && git reset --hard pre-reorg-2026-05-08'

# Restore old cron entries — back up new entries first if you want them
ssh mini 'sqlite3 /workspace/extra/telos-session/inbound.db "DELETE FROM messages_in WHERE id LIKE \"tick-work-%\""'
# Re-insert old morning + evening crons (capture from Phase 0 state snapshot)

# Restart work session container
ssh mini 'launchctl kickstart -k gui/501/com.guya.telos.work'  # or equivalent
```

**Post-rollback smoke**:
- Old morning tick fires at next scheduled time with old prompt.
- Old MCP tools work (use plain T/P prefixes per ADR-017).

---

## Phase 3 — Learn session bootstrap

**What changed**:
- New dir: `/workspace/extra/telos-session/learn/` (DBs, addendum, mounts)
- New nanoclaw container config for learn session
- 5 new cron entries in learn session DB
- WebSearch + WebFetch tools added to learn session config

**Revert commands**:
```bash
ssh mini 'launchctl unload ~/Library/LaunchAgents/com.guya.telos.learn.plist 2>/dev/null'
ssh mini 'rm -rf /workspace/extra/telos-session/learn'
ssh mini 'rm -f ~/Library/LaunchAgents/com.guya.telos.learn.plist'
# Remove learn-related lines from nanoclaw config
ssh mini 'cd ~/Desktop/telos && git checkout -- container/agent-runner/config'  # adjust path
```

**Post-rollback smoke**:
- `ssh mini 'ls /workspace/extra/telos-session/'` shows only `work/` (no `learn/`).
- Work session unaffected (still ticks at 9am/1pm/9pm).

---

## Phase 4 — Life session bootstrap

**What changed**: same shape as Phase 3 but for `life/` (Korean addendum, 두식 persona).

**Revert commands**:
```bash
ssh mini 'launchctl unload ~/Library/LaunchAgents/com.guya.telos.life.plist 2>/dev/null'
ssh mini 'rm -rf /workspace/extra/telos-session/life'
ssh mini 'rm -f ~/Library/LaunchAgents/com.guya.telos.life.plist'
ssh mini 'cd ~/Desktop/telos && git checkout -- container/agent-runner/config'
```

**Post-rollback smoke**:
- `ssh mini 'ls /workspace/extra/telos-session/'` shows only `work/` and `learn/` (no `life/`).
- Learn + work sessions unaffected.

---

## Phase 5 — Reminder firing infra

**What changed**:
- New script: `constantia/scripts/check_reminders.sh`
- New launchd plist: `~/Library/LaunchAgents/com.guya.reminder-fire.plist` on mini
- Test R-tasks created and (if not already) archived

**Revert commands**:
```bash
ssh mini 'launchctl unload ~/Library/LaunchAgents/com.guya.reminder-fire.plist'
ssh mini 'rm -f ~/Library/LaunchAgents/com.guya.reminder-fire.plist'
# script in constantia repo: revert via git
cd /Users/daniel/Desktop/constantia
git checkout pre-reorg-2026-05-08 -- scripts/  # or rm if no scripts/ existed before
ssh mini 'cd ~/Desktop/constantia && git checkout pre-reorg-2026-05-08 -- scripts/'

# Retire test R-tasks
cd /Users/daniel/Desktop/constantia
rm -f tasks/reminders/R-test-*.md
git add tasks/reminders/ && git commit -m "rollback: retire Phase 5 test reminders"
```

**Post-rollback smoke**:
- `ssh mini 'launchctl list | grep reminder'` returns no rows.
- `ssh mini 'tail -20 ~/Library/Logs/guya-reminder-fire.log'` does not show new entries.
- No new messages in `life/inbound.db` from `R-test-*` IDs.

---

## Phase 6 — Validation + cutover

**What changed**: ADR-018 entry added to CLAUDE.md; ADR-017 marked superseded; STATUS.md updated.

**Revert commands**:
```bash
cd /Users/daniel/Desktop/guya
git reset --soft HEAD~1  # if cutover was a single commit
# or:
git revert <cutover-commit-sha>
```

**Post-rollback smoke**:
- ADR-018 not present in CLAUDE.md.
- ADR-017 not marked superseded.
- STATUS.md back to pre-cutover content.

---

## Emergency: full rollback (all phases at once)

If everything goes sideways:

```bash
# Constantia
cd /Users/daniel/Desktop/constantia && git reset --hard pre-reorg-2026-05-08
ssh mini 'cd ~/Desktop/constantia && git reset --hard pre-reorg-2026-05-08'

# Telos fork
cd /Users/daniel/Desktop/telos && git reset --hard pre-reorg-2026-05-08
ssh mini 'cd ~/Desktop/telos && git reset --hard pre-reorg-2026-05-08'

# Mini infra
ssh mini << 'EOF'
launchctl unload ~/Library/LaunchAgents/com.guya.telos.learn.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.guya.telos.life.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.guya.reminder-fire.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.guya.telos.learn.plist
rm -f ~/Library/LaunchAgents/com.guya.telos.life.plist
rm -f ~/Library/LaunchAgents/com.guya.reminder-fire.plist
rm -rf /workspace/extra/telos-session/learn
rm -rf /workspace/extra/telos-session/life
launchctl kickstart -k gui/501/com.guya.telos.work  # restart work session with old config
EOF

# Verify
ssh mini 'ls /workspace/extra/telos-session/'  # should show only work/
shasum -a 256 /Users/daniel/Desktop/guya/data/bytebytego_course_plan.md  # should match 227a8ea6...
```

---

## Open: rollback if mini is down at rollback time

If mini is unreachable when rolling back:
1. Roll back local repos first (constantia + telos).
2. Document mini state at rollback time.
3. When mini comes back, push reset to mini and verify state matches.
4. If mini's local state diverged irrecoverably: re-clone from origin at the snapshot tag, restore session DB from latest backup.
