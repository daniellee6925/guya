# Phase 4 — Life Session Bootstrap, Mini Deployment Runbook

**Date**: 2026-05-11
**Phase**: 4 of 6 (Telos reorg per `docs/2026-05-08-telos-reorg.md`)
**Scope**: Deploy the `telos-life` group skeleton + 두식 LIFE addendum to mini. Spin up the third Telos session.

The fork-side work (`groups/telos-life/` skeleton, CLAUDE.local.md, 5 tick prompts, container.example.json, .gitignore allowlist) shipped in commit `317e4e6` on `daniellee6925/nanoclaw` (already pushed to origin). The Constantia repo is unchanged. This runbook covers everything that has to happen on mini to land Phase 4.

**Phase 4 is structurally simpler than Phase 3** — the shared-tools refactor is already deployed, work + learn sessions are healthy, and LIFE is fully isolated. No need to stop work or learn sessions; only one nanoclaw restart at the end to pick up the new mount-allowlist entry.

---

## Phase 3 lessons baked in (read first)

Five silent-rot patterns from the Phase 3 deploy are pre-empted throughout this runbook. They appear as inline `[L#]` callouts where they're load-bearing. Quick summary:

- **[L1]** Constantia post-commit hook breaks rebase — already fixed in Constantia `7095f49`; nothing to do.
- **[L2]** OneCLI requires lowercase agent identifiers — use `ag-<ts>-life` (lowercase only). No uppercase semantic suffixes.
- **[L3]** Per-agent docker image tag must exist — start with `imageTag: nanoclaw-agent-v2-53edea47:latest`. Don't reference a per-agent tag that hasn't been built.
- **[L4]** nanoclaw plist PATH must include Docker.app — already patched on mini in Phase 3. Just verify it's still there.
- **[L5]** `messaging_group_agents` row is the FOURTH wiring row — easy to miss, breaks the channel silently. Step 4 makes this explicit.

---

## Pre-flight (on mini)

```bash
# SSH into mini, cd to nanoclaw fork checkout
ssh mini
cd ~/path/to/nanoclaw  # confirm with: git remote -v should show daniellee6925/nanoclaw

# Confirm we're at Phase 3 head
git log --oneline -3
# Expect HEAD at ce5b0d5 (Phase 3) or descendant; will pull 317e4e6 (Phase 4) in step 2

# Confirm work + learn sessions are healthy
launchctl list | grep nanoclaw
docker ps | grep -i telos
# Expect: both telos-work and telos-learn containers running (or just nanoclaw if it spawns on-demand)

# Capture current mount-allowlist before editing
cp ~/.config/nanoclaw/mount-allowlist.json ~/.config/nanoclaw/mount-allowlist.json.pre-phase4.bak

# [L4] Verify plist PATH still includes Docker.app
grep -A2 "EnvironmentVariables" ~/Library/LaunchAgents/com.nanoclaw-v2-*.plist | grep -i docker
# Expect: /Applications/Docker.app/Contents/Resources/bin in PATH. If missing, patch before proceeding (see Phase 3 runbook lesson 4).

# Find the central nanoclaw DB
ls -la ~/path/to/v2.db  # adjust per your install
NANOCLAW_DB=~/path/to/v2.db  # confirm path

# Capture work + learn session details for reference (we'll mirror their wiring)
sqlite3 "$NANOCLAW_DB" "SELECT id, name, folder FROM agent_groups WHERE folder LIKE 'telos%'"
sqlite3 "$NANOCLAW_DB" "SELECT id, agent_group_id, messaging_group_id FROM sessions WHERE id LIKE 'sess%'"
sqlite3 "$NANOCLAW_DB" "SELECT id, messaging_group_id, agent_group_id FROM messaging_group_agents"
# [L5] Note that BOTH work and learn have messaging_group_agents rows. LIFE must too.
```

---

## Step 1 — Update mount-allowlist.json

Add ONE new entry for the life session DB dir. The `shared/telos-tools/` path is already allowed (added in Phase 3).

```bash
# Choose the life session DB dir path. Match the pattern used by work and learn:
LIFE_AG_ID="ag-$(date +%s)000-life"  # [L2] lowercase only
LIFE_DB_DIR=/Users/guya/telos/data/v2-sessions/$LIFE_AG_ID/sess-$(date +%s)000-life
echo "Life session DB dir will be: $LIFE_DB_DIR"
# (Don't create the dir yet — that's step 3. Just lock the path for the allowlist.)

# Edit ~/.config/nanoclaw/mount-allowlist.json
# Under allowedRoots, ADD this entry:
#   {
#     "path": "/Users/guya/telos/data/v2-sessions/<LIFE_AG_ID>",
#     "allowReadWrite": false,
#     "description": "LIFE session DB dir (RO mount into telos-life container)"
#   }
# Note: path is the AGENT_GROUP dir, not the session dir — allows future sessions under the same agent_group.

# Validate JSON:
jq . ~/.config/nanoclaw/mount-allowlist.json
```

**Do NOT restart nanoclaw yet** — the new entry will activate in step 7 when we restart for the new agent_group to spawn.

---

## Step 2 — Pull the fork

```bash
cd ~/path/to/nanoclaw
git pull origin main
git log --oneline -3
# Expect: 317e4e6 feat(telos): Phase 4 fork-side — telos-life group skeleton + 두식 LIFE addendum

# Verify the new files landed
ls groups/telos-life/
# Expect: CLAUDE.local.md  container.example.json  soul.md  tick-bodycheck-prompt.md
#         tick-close-prompt.md  tick-morning-prompt.md  tick-transition-prompt.md
#         tick-workout-prompt.md
```

---

## Step 3 — Provision life agent_group + session DB

```bash
# Lock the IDs for this session. [L2] all lowercase. Reuse $LIFE_AG_ID from step 1.
LIFE_SESS_ID="sess-$(date +%s)000-life"
LIFE_MG_ID="mg-$(date +%s)000-life"
LIFE_MGA_ID="mga-$(date +%s)000-life"
LIFE_DB_DIR=/Users/guya/telos/data/v2-sessions/$LIFE_AG_ID/$LIFE_SESS_ID
LIFE_CHANNEL_ID="1503157300922417232"  # Discord #telos-life channel

echo "Life agent_group: $LIFE_AG_ID"
echo "Life session:     $LIFE_SESS_ID"
echo "Life mg:          $LIFE_MG_ID"
echo "Life mga:         $LIFE_MGA_ID"
echo "Life DB dir:      $LIFE_DB_DIR"
echo "Life channel:     $LIFE_CHANNEL_ID"

# Confirm the mount-allowlist path from step 1 matches: /Users/guya/telos/data/v2-sessions/$LIFE_AG_ID
# If not, edit the allowlist to match $LIFE_AG_ID exactly.

# Create the session DB dir
mkdir -p "$LIFE_DB_DIR"

# Initialize empty inbound.db + outbound.db with nanoclaw schemas.
# (Copy the same mechanism the learn session used in Phase 3 — typically via session-db.ts ensureSchema.)
cd ~/path/to/nanoclaw
node -e "
  const { ensureSchema } = require('./dist/db/session-db');
  ensureSchema('$LIFE_DB_DIR/inbound.db', 'inbound');
  ensureSchema('$LIFE_DB_DIR/outbound.db', 'outbound');
  console.log('Schemas applied');
"

# Verify
ls -la "$LIFE_DB_DIR"
sqlite3 "$LIFE_DB_DIR/inbound.db" ".tables"
sqlite3 "$LIFE_DB_DIR/outbound.db" ".tables"
```

---

## Step 4 — Insert the FOUR v2.db rows (the wiring)

**[L5] All four rows are required. Skipping `messaging_group_agents` will silently break the channel — Discord events will route to the bot but never reach the agent.**

Order matters because of FK constraints — `sessions` references both `agent_groups` and `messaging_groups`, so those come first.

```bash
NANOCLAW_DB=~/path/to/v2.db  # confirm path from pre-flight

# Row 1: messaging_groups (the destination — Discord #telos-life channel)
# Match the channel_type + platform_id convention used by work/learn. Inspect first:
sqlite3 "$NANOCLAW_DB" "SELECT * FROM messaging_groups WHERE id LIKE 'mg%' LIMIT 3"
# Note the schema, then insert with the SAME shape. Typical:
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO messaging_groups (id, channel_type, platform_id, name, created_at)
VALUES (
  '$LIFE_MG_ID',
  'discord',
  'discord:1497671232139825232:$LIFE_CHANNEL_ID',
  'telos-life',
  datetime('now')
);
EOF
# Adjust columns per your actual schema (run `.schema messaging_groups` if unsure).

# Row 2: agent_groups (the agent — folder, name, id)
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO agent_groups (id, name, folder, agent_provider, created_at)
VALUES (
  '$LIFE_AG_ID',
  'telos-life',
  'telos-life',
  'claude',
  datetime('now')
);
EOF

# Row 3: messaging_group_agents (THE ROUTING LINK — [L5])
# This row tells nanoclaw "incoming messages on $LIFE_MG_ID should wake $LIFE_AG_ID."
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO messaging_group_agents (
  id, messaging_group_id, agent_group_id, session_mode, priority,
  created_at, engage_mode, engage_pattern, sender_scope, ignored_message_policy
) VALUES (
  '$LIFE_MGA_ID',
  '$LIFE_MG_ID',
  '$LIFE_AG_ID',
  'shared',
  0,
  datetime('now'),
  'pattern',
  '.',
  'all',
  'drop'
);
EOF

# Row 4: sessions (link agent_group → messaging_group)
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO sessions (
  id, agent_group_id, messaging_group_id, thread_id, agent_provider,
  status, container_status, last_active, created_at
) VALUES (
  '$LIFE_SESS_ID',
  '$LIFE_AG_ID',
  '$LIFE_MG_ID',
  NULL,
  'claude',
  'active',
  'stopped',
  datetime('now'),
  datetime('now')
);
EOF

# Verify all four rows present
sqlite3 "$NANOCLAW_DB" "SELECT id FROM messaging_groups WHERE id = '$LIFE_MG_ID'"
sqlite3 "$NANOCLAW_DB" "SELECT id FROM agent_groups WHERE id = '$LIFE_AG_ID'"
sqlite3 "$NANOCLAW_DB" "SELECT id FROM messaging_group_agents WHERE id = '$LIFE_MGA_ID'"
sqlite3 "$NANOCLAW_DB" "SELECT id FROM sessions WHERE id = '$LIFE_SESS_ID'"
# All four should return exactly one row.
```

---

## Step 5 — Copy + fill in life container.json

```bash
cd ~/path/to/nanoclaw
cp groups/telos-life/container.example.json groups/telos-life/container.json

# Edit groups/telos-life/container.json — replace ALL placeholders:
#   "agentGroupId": "<paste $LIFE_AG_ID>"
#   additionalMounts hostPath fields:
#     1. shared/telos-tools → /Users/<user>/path/to/nanoclaw/shared/telos-tools
#     2. constantia → ~/path/to/constantia (or wherever it is on mini — check telos-learn for reference)
#     3. life session DB → $LIFE_DB_DIR (the directory containing inbound.db + outbound.db)
#     4. ssh-key dir → same dir as work + learn use (check groups/telos-learn/container.json)

# [L3] DO NOT set imageTag to a per-agent tag. Use the base image:
#   "imageTag": "nanoclaw-agent-v2-53edea47:latest"
# (Adjust the image name to match what work + learn use in their container.json.)

# Validate JSON:
jq . groups/telos-life/container.json

# DO NOT git add this file — it's per-installation (gitignored under groups/telos-life/*).
git status   # should NOT show container.json
```

---

## Step 6 — Insert 5 life-tick crons

The 5 ticks fire at **10am / 12pm / 6pm / 8pm / 11pm PT** (NOT learn's 10/1/4/7/10 PT — different cadence).

Match the cron convention work and learn use. Inspect first:
```bash
LIFE_DB=$LIFE_DB_DIR/inbound.db
WORK_DB=/Users/guya/telos/data/v2-sessions/<work-ag-id>/sess-<work-session-id>/inbound.db

# Look at work session's cron rows for the exact schema and TZ convention
sqlite3 "$WORK_DB" "SELECT id, kind, content, process_after, recurrence FROM messages_in WHERE recurrence IS NOT NULL"
```

If cron expressions use **PT-local** (likely, based on Phase 3): use `0 10`, `0 12`, `0 18`, `0 20`, `0 23` (hour-of-day, 24h).
If cron expressions use **UTC**: convert (PDT in May = UTC-7, so 10am PT = 17 UTC; 11pm PT = 06 UTC next day).

The runbook below assumes PT-local. **Verify against work session's actual rows before inserting.**

```bash
LIFE_DB=$LIFE_DB_DIR/inbound.db
NOW_TS=$(date +%s)000

# Tick 1: 10am morning
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-${NOW_TS}-life-morning',
  2,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-morning-prompt.md',
  datetime('now', '+1 minute'),
  '0 10 * * *',
  1,
  'task-${NOW_TS}-life-morning'
);
EOF

# Tick 2: 12pm bodycheck
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-${NOW_TS}-life-bodycheck',
  4,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-bodycheck-prompt.md',
  datetime('now', '+1 minute'),
  '0 12 * * *',
  1,
  'task-${NOW_TS}-life-bodycheck'
);
EOF

# Tick 3: 6pm transition
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-${NOW_TS}-life-transition',
  6,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-transition-prompt.md',
  datetime('now', '+1 minute'),
  '0 18 * * *',
  1,
  'task-${NOW_TS}-life-transition'
);
EOF

# Tick 4: 8pm workout
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-${NOW_TS}-life-workout',
  8,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-workout-prompt.md',
  datetime('now', '+1 minute'),
  '0 20 * * *',
  1,
  'task-${NOW_TS}-life-workout'
);
EOF

# Tick 5: 11pm close
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-${NOW_TS}-life-close',
  10,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-close-prompt.md',
  datetime('now', '+1 minute'),
  '0 23 * * *',
  1,
  'task-${NOW_TS}-life-close'
);
EOF

# Verify all 5 rows present
sqlite3 "$LIFE_DB" "SELECT id, recurrence, content FROM messages_in WHERE recurrence IS NOT NULL ORDER BY id"
```

**Note on `seq`:** the host writes EVEN seqs per `session-db.ts:nextEvenSeq`. Start at 2 and go up by 2 per row. If your work session inspection shows a different convention, match that instead.

---

## Step 7 — Restart nanoclaw (picks up new mount-allowlist + spawns life container)

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw-v2-53edea47
# Adjust label to match your actual plist label (check `launchctl list | grep nanoclaw`).

# Verify nanoclaw is back up
sleep 5
launchctl list | grep nanoclaw
ps -ef | grep nanoclaw | grep -v grep

# Watch for the life session container to spawn
docker ps | grep telos-life   # should appear within ~30s

# Tail the nanoclaw log for errors
tail -f ~/Library/Logs/nanoclaw.log
# Look for: "MCP server started with N tools" in the life-session log entry.
# Watch for [L4] dial unix .docker/run/docker.sock errors — if those appear, plist PATH regressed.
```

---

## Step 8 — Smoke test

Three checks. All three must pass for Phase 4 to be considered complete.

### 8a. Manual message → Korean 두식 response

Send a DM to the `#telos-life` Discord channel (`1503157300922417232`):
```
안녕
```

**Expected response:** Korean 존댓말 + 형님. No emoji. No "안녕하세요" greeting reflex. Per the CLAUDE.local.md first-contact protocol pattern 3 (nothing pending), should be terse and direct — something like *"형님, 오늘 좀 어떠십니까?"* or a pattern-surface lead-in if any signal is visible.

**Fail modes to watch for:**
- Response in English → language rule isn't loaded. Check `docker exec <life-container> cat /workspace/agent/CLAUDE.local.md` is non-empty.
- Response starts with "안녕하세요" or includes emoji → addendum isn't loaded into system prompt (per ADR-014, CLAUDE.local.md must be injected into system-prompt addendum, not project memory).
- No response at all → check `messaging_group_agents` row exists (**[L5]**). Insert log should show `Message routed`; if missing, the row is missing.

### 8b. Force-fire one tick

Don't wait for tomorrow. Manually trigger the 10am morning tick:
```bash
sqlite3 "$LIFE_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, trigger)
VALUES (
  'phase4-smoke-morning',
  (SELECT COALESCE(MAX(seq), 0) + 2 FROM messages_in),
  'tick',
  datetime('now'),
  'pending',
  '@./tick-morning-prompt.md',
  datetime('now', '+30 seconds'),
  1
);
EOF
```

**Expected within 2 minutes:** A Korean DM in `#telos-life` opening with body state + any pending R-reminders + 매님 line only if a signal is visible. Should NOT recite profile contents. Should match the rhythm of anchor 1 in CLAUDE.local.md.

If the tick fires but the brief is in English → language rule failed (same as 8a).
If the tick fires but the brief is wordy and clause-stacked → sentence-economy rule didn't land; the calibration anchors aren't being honored. Worth investigating in the running container's loaded prompt.

### 8c. add_reminder works

In `#telos-life`, send (in Korean to keep register consistent):
```
형님, 내일 아침 8시에 운동하라고 리마인드 해줘
```

**Expected:** 두식 calls `add_reminder` with appropriate `schedule_at`. New R-task lands in `tasks/reminders/R-NNN.md` in Constantia. Confirm via:
```bash
cd ~/path/to/constantia
ls -lt tasks/reminders/ | head -5
git log -1 --oneline
# Expect a recent commit from telos-life adding R-NNN.md
```

If the tool errors with a path issue → shared/telos-tools mount didn't resolve. Check `docker exec <life-container> ls /workspace/extra/telos-tools/`.
If the tool succeeds but the file doesn't land in Constantia → Constantia mount isn't writable. Check `docker exec <life-container> ls -la /workspace/extra/constantia/.git`.

---

## Rollback

If smoke fails and the issue isn't a quick fix:

1. Stop the life session container:
   ```bash
   docker ps | grep telos-life
   docker stop <life-container-name>
   ```
2. Delete the four v2.db rows:
   ```bash
   sqlite3 "$NANOCLAW_DB" "DELETE FROM messaging_group_agents WHERE id = '$LIFE_MGA_ID';"
   sqlite3 "$NANOCLAW_DB" "DELETE FROM sessions WHERE id = '$LIFE_SESS_ID';"
   sqlite3 "$NANOCLAW_DB" "DELETE FROM messaging_groups WHERE id = '$LIFE_MG_ID';"
   sqlite3 "$NANOCLAW_DB" "DELETE FROM agent_groups WHERE id = '$LIFE_AG_ID';"
   ```
   Reverse order: mga → sessions → mg → ag (because of FK constraints).
3. Remove the 5 cron rows from the life inbound.db (or just delete the DB dir):
   ```bash
   rm -rf "$LIFE_DB_DIR"  # or the entire $LIFE_AG_ID dir if you want to start fresh
   ```
4. Remove `groups/telos-life/container.json` (the per-installation config):
   ```bash
   rm ~/path/to/nanoclaw/groups/telos-life/container.json
   ```
5. Restore mount-allowlist from backup:
   ```bash
   cp ~/.config/nanoclaw/mount-allowlist.json.pre-phase4.bak ~/.config/nanoclaw/mount-allowlist.json
   ```
6. Restart nanoclaw:
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.nanoclaw-v2-53edea47
   ```

**Work and learn sessions are unaffected** — LIFE is fully isolated. If the rollback completes and work/learn are still running, you can iterate on Phase 4 content without further breaking risk.

---

## Post-deploy

- Update `STATUS.md` in guya repo: mark Phase 4 complete, note the fork SHA (`317e4e6`), record the new IDs ($LIFE_AG_ID, $LIFE_SESS_ID, $LIFE_MG_ID, $LIFE_MGA_ID).
- Update `ARCHITECTURE.md` if applicable.
- Watch for tick-fire issues over the next 24h. The 5 life ticks should produce 5 outbound DMs per day in `#telos-life`. If any silently drop, that's another silent-rot variant — investigate before Phase 5.
- Work and learn sessions should be unchanged. No regressions expected from Phase 4.
- Phase 5 (reminder firing infra) follows. Daniel can start adding R-task content via LIFE chat (`add_reminder`) as soon as smoke passes, but the reminder-firing script that actually fires R-tasks into life/inbound.db is Phase 5.

---

## Quick reference — the new IDs

Fill these in as you generate them in step 1 / step 3, then save somewhere for the post-deploy STATUS update:

```
LIFE_AG_ID    = ag-_______-life
LIFE_SESS_ID  = sess-_______-life
LIFE_MG_ID    = mg-_______-life
LIFE_MGA_ID   = mga-_______-life
LIFE_DB_DIR   = /Users/guya/telos/data/v2-sessions/<LIFE_AG_ID>/<LIFE_SESS_ID>
LIFE_CHANNEL  = 1503157300922417232 (Discord #telos-life)
```

---

## Differences from Phase 3 runbook (for the reader who knows Phase 3)

- **No critical sequencing constraint** — Phase 4 doesn't move files that the work session depends on. Work and learn can keep running through the entire deploy.
- **No work session container.json edits** — already correct from Phase 3.
- **One mount-allowlist entry** instead of two (shared/telos-tools already allowed).
- **Five lessons baked in as `[L#]` callouts** rather than appended at the bottom — the patterns are now known and pre-empted.
- **Cron times shifted**: 10am/12pm/6pm/8pm/11pm (NOT 10am/1pm/4pm/7pm/10pm).
- **Tick prompt filenames different**: morning/bodycheck/transition/workout/close (NOT morning/recall/midpoint/capture/close).
- **Smoke test in Korean** — the language rule and 매님 referent and 합쇼체/해요체 fluidity are the things that must visibly work.
