# Phase 3 — Learn Session Bootstrap, Mini Deployment Runbook

**Date**: 2026-05-10
**Phase**: 3 of 6 (Telos reorg per `docs/2026-05-08-telos-reorg.md`)
**Scope**: Deploy the shared-tools refactor + learn session group to mini.

This runbook executes Phase 3 on mini. The fork-side work (file moves, learn group skeleton) shipped in commit `<phase-3-fork-sha>` on `daniellee6925/nanoclaw`. The Constantia repo is unchanged. This runbook covers everything that has to happen on mini to land Phase 3 safely.

---

## Critical sequencing constraint

The fork-side commit MOVES `groups/telos/tools/` to `shared/telos-tools/`. Mini's currently-running work-session container has a `container.json` pointing at the OLD path (`bun /workspace/agent/tools/mcp-server.ts`). When mini's nanoclaw restarts the work-session container after the `git pull`, that path won't exist and the MCP server spawn will fail.

**Therefore: stop work session BEFORE pulling, and update its container.json BEFORE restarting.** Sequence is:

1. Stop work session
2. Update mount-allowlist.json (add new shared dir as allowed root)
3. `git pull` fork
4. Update work session's container.json (new mount + new MCP command path)
5. Restart work session, verify a tick fires clean
6. Provision learn agent_group + session DB
7. Copy + fill in learn container.json
8. Insert learn-tick cron rows
9. Boot learn session
10. Smoke test

If you skip any of steps 2–4 before step 5, the work session breaks until they're done.

---

## Pre-flight (on mini)

```bash
# SSH into mini, cd to nanoclaw fork checkout
ssh mini
cd ~/path/to/nanoclaw  # confirm with: git remote -v should show daniellee6925/nanoclaw

# Confirm we're at Phase 2c head before pulling
git log --oneline -5
# Expect HEAD at df6c829 or descendant

# Confirm work session container is healthy now (so we know what "healthy" looks like for verification later)
launchctl list | grep nanoclaw
ps -ef | grep nanoclaw | grep -v grep
# Note PID for the host nanoclaw process

# Capture current work session container.json before editing
cp groups/telos/container.json groups/telos/container.json.pre-phase3.bak
cat groups/telos/container.json
# Note the existing additionalMounts and mcpServers shape — your edits will preserve everything except the changes called out below
```

If the work session has been silent (no ticks firing) for the last 48h per the 5/10 STATUS investigation, **diagnose that BEFORE running this runbook**. Phase 3 layers on top of the shared infra; if shared infra is broken, Phase 3 will reveal it during smoke but you'll be debugging two issues at once.

---

## Step 1 — Stop work session container

Choose the cleanest stop method for your current setup. Goal: container is not running and won't restart until step 5.

```bash
# Option A: if you control the agent container directly
docker ps | grep telos-work  # find container name
docker stop <work-container-name>

# Option B: if the host nanoclaw process spawns containers per tick
# Stop the host process so no new container spawns:
launchctl unload ~/Library/LaunchAgents/com.guya.nanoclaw.plist
# OR: launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.guya.nanoclaw.plist
```

Verify nothing is running:
```bash
docker ps | grep -i telos
ps -ef | grep nanoclaw | grep -v grep
```

---

## Step 2 — Update mount-allowlist.json

The new `shared/telos-tools/` host path must be in the allowlist or `validateAdditionalMounts` will reject it on container spawn.

```bash
# Edit mount-allowlist.json (path varies — check your installation)
# Add the fork's shared/ dir as an allowed root:

cat ~/.nanoclaw/mount-allowlist.json  # or wherever yours lives

# Add this entry under allowedRoots:
#   {
#     "path": "/Users/<user>/path/to/nanoclaw/shared",
#     "allowReadWrite": false,
#     "description": "Shared Telos MCP tools — single source of truth across work/learn/life"
#   }
```

Save and confirm the JSON is valid (`jq . mount-allowlist.json` should not error).

---

## Step 3 — Pull the fork

```bash
git pull origin main
git log --oneline -3
# Expect new HEAD with Phase 3 commit message

# Verify the structural changes landed
ls shared/telos-tools/   # should show: helpers.ts helpers.test.ts mcp-server.ts
ls groups/telos/         # should NO LONGER show tools/
ls groups/telos-learn/   # should show: CLAUDE.local.md soul.md tick-*.md container.example.json
```

---

## Step 4 — Update work session's container.json

Mini's `groups/telos/container.json` needs two changes:

1. Add an `additionalMounts` entry for `shared/telos-tools/` → `telos-tools` (RO).
2. Change the `mcpServers.<name>.args` from `/workspace/agent/tools/mcp-server.ts` to `/workspace/extra/telos-tools/mcp-server.ts`.

**Everything else stays the same** — preserve constantia mount, telos-session mount, ssh-key mount, env, agentGroupId, etc.

```bash
# Edit groups/telos/container.json
# Use the diff sketch:

# In additionalMounts array, ADD:
#   {
#     "hostPath": "/Users/<user>/path/to/nanoclaw/shared/telos-tools",
#     "containerPath": "telos-tools",
#     "readonly": true
#   }

# In mcpServers.<your-name>, CHANGE:
#   "args": ["/workspace/agent/tools/mcp-server.ts"]
# TO:
#   "args": ["/workspace/extra/telos-tools/mcp-server.ts"]

# Validate JSON:
jq . groups/telos/container.json
```

---

## Step 5 — Restart work session, verify

```bash
# Restart the host nanoclaw (Option B from step 1)
launchctl load ~/Library/LaunchAgents/com.guya.nanoclaw.plist
# Verify it's up
launchctl list | grep nanoclaw
ps -ef | grep nanoclaw | grep -v grep

# Wait for the next tick fire OR manually trigger one for verification.
# Check logs for the work session — MCP server should start without ENOENT.
# Look for: "MCP server started with N tools" in the agent logs.

# If you can't wait for a natural tick, insert a synthetic test message into the work session's inbound.db with process_after = now + 60s, trigger=1:
WORK_DB=/Users/guya/telos/data/v2-sessions/<work-ag-id>/sess-<work-session-id>/inbound.db
sqlite3 "$WORK_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, trigger)
VALUES ('phase3-smoke', (SELECT COALESCE(MAX(seq), 0) + 2 FROM messages_in), 'user', datetime('now'), 'pending', 'Smoke test post-Phase-3 deploy. Reply with: tools loaded.', datetime('now', '+60 seconds'), 1);
EOF
```

**Pass criteria:** within 2 minutes, work session sends an outbound message confirming MCP tools are loaded. If it times out or errors, **roll back step 4 to the .bak file, restore old tools path, restart, and report.**

---

## Step 6 — Provision learn agent_group + session DB

```bash
# Generate a new UUID for the learn agent_group
LEARN_AG_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "Learn agent_group ID: $LEARN_AG_ID"

# Generate a session ID following the existing convention
LEARN_SESS_ID="sess-$(date +%s)-$(openssl rand -hex 3)"
echo "Learn session ID: $LEARN_SESS_ID"

# Create the session DB dir
LEARN_DB_DIR=/Users/guya/telos/data/v2-sessions/$LEARN_AG_ID/$LEARN_SESS_ID
mkdir -p "$LEARN_DB_DIR"

# Initialize empty inbound.db + outbound.db with nanoclaw schemas
# (Use the same mechanism nanoclaw uses to bootstrap a session — likely via session-manager.ts)
# If a manual init is needed:
cd ~/path/to/nanoclaw
node -e "
  const { ensureSchema } = require('./dist/db/session-db');
  ensureSchema('$LEARN_DB_DIR/inbound.db', 'inbound');
  ensureSchema('$LEARN_DB_DIR/outbound.db', 'outbound');
  console.log('Schemas applied');
"

# Verify
ls -la "$LEARN_DB_DIR"
sqlite3 "$LEARN_DB_DIR/inbound.db" ".tables"
sqlite3 "$LEARN_DB_DIR/outbound.db" ".tables"

# Insert agent_group row into central nanoclaw DB
NANOCLAW_DB=~/path/to/nanoclaw-central.db  # adjust per your install
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO agent_groups (id, name, folder, agent_provider, created_at)
VALUES ('$LEARN_AG_ID', 'telos-learn', 'telos-learn', 'claude', datetime('now'));
EOF

# Insert session row
sqlite3 "$NANOCLAW_DB" <<EOF
INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, agent_provider, status, container_status, last_active, created_at)
VALUES ('$LEARN_SESS_ID', '$LEARN_AG_ID', '<learn-discord-channel-id-or-similar>', NULL, 'claude', 'active', 'stopped', datetime('now'), datetime('now'));
EOF
```

**Note:** `messaging_group_id` is the Discord channel (or other messaging destination) where Daniel will DM the learn-Telos. You may need to register a new channel first — see your Discord setup notes. If you don't yet have a learn-channel, register one before this step.

---

## Step 7 — Copy + fill in learn container.json

```bash
cd ~/path/to/nanoclaw
cp groups/telos-learn/container.example.json groups/telos-learn/container.json

# Edit groups/telos-learn/container.json — replace ALL placeholders:
#   "agentGroupId": "<paste $LEARN_AG_ID from step 6>"
#   "additionalMounts" hostPath fields: absolute paths on mini

# Specifically:
#   1. shared/telos-tools mount → REPLACE_WITH_FORK_PATH/shared/telos-tools
#      Set to: /Users/<user>/path/to/nanoclaw/shared/telos-tools
#   2. constantia mount → REPLACE_WITH_CONSTANTIA_PATH
#      Set to: ~/path/to/constantia (or wherever it is on mini)
#   3. learn session DB → REPLACE_WITH_LEARN_SESSION_DB_DIR
#      Set to: $LEARN_DB_DIR from step 6
#   4. ssh-key dir → REPLACE_WITH_DEPLOY_KEY_DIR
#      Set to: same dir as work session uses (check groups/telos/container.json)

# Validate JSON:
jq . groups/telos-learn/container.json

# DO NOT git add this file — it's per-installation (gitignored).
git status   # should NOT show container.json under groups/telos-learn/
```

---

## Step 8 — Insert 5 learn-tick crons

The 5 ticks fire at 10am / 1pm / 4pm / 7pm / 10pm PT (= 17 / 20 / 23 / 02 / 05 UTC respectively, **with DST adjustment** — verify your system's TZ handling).

Each cron is a `messages_in` row with `recurrence` set to the cron expression and `kind: 'tick'` (or your existing convention — match the work session's cron rows).

```bash
LEARN_DB=$LEARN_DB_DIR/inbound.db

# Inspect work session's existing cron rows for the exact convention:
WORK_DB=/Users/guya/telos/data/v2-sessions/<work-ag-id>/sess-<work-session-id>/inbound.db
sqlite3 "$WORK_DB" "SELECT id, kind, content, process_after, recurrence FROM messages_in WHERE recurrence IS NOT NULL"

# Then insert the 5 learn ticks. Example for 10am morning brief:
sqlite3 "$LEARN_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, recurrence, trigger, series_id)
VALUES (
  'task-$(date +%s)000-learn-morning',
  2,
  'tick',
  datetime('now'),
  'pending',
  '@./tick-morning-prompt.md',
  datetime('now', '+1 minute'),
  '0 17 * * *',
  1,
  'task-$(date +%s)000-learn-morning'
);
EOF

# Repeat for the other 4 ticks:
#   1pm recall:    cron expr '0 20 * * *', content '@./tick-recall-prompt.md'
#   4pm midpoint:  cron expr '0 23 * * *', content '@./tick-midpoint-prompt.md'
#   7pm capture:   cron expr '0 2 * * *',  content '@./tick-capture-prompt.md'  (note: next-day UTC)
#   10pm close:    cron expr '0 5 * * *',  content '@./tick-close-prompt.md'    (next-day UTC)

# Match seq numbers (host writes EVEN seqs per session-db.ts:nextEvenSeq logic — start at 2 and go up by 2 per row).
```

**TZ note:** the cron expression uses the timezone of the cron evaluator. If nanoclaw's scheduler evaluates in UTC, use the UTC times above. If it evaluates in the system's local TZ (likely PT on mini), use `0 10 * * *`, `0 13 * * *`, etc. **Check work session's existing cron rows to confirm which convention is in use.**

Verify all 5 rows present:
```bash
sqlite3 "$LEARN_DB" "SELECT id, recurrence, content FROM messages_in WHERE recurrence IS NOT NULL ORDER BY id"
```

---

## Step 9 — Boot the learn session container

```bash
# The host nanoclaw should automatically pick up the new agent_group + session
# on its next sweep cycle. To force immediately:
launchctl kickstart -k gui/$(id -u)/com.guya.nanoclaw

# Watch for spawn:
docker ps | grep telos-learn   # should appear within ~30s

# Check spawn logs for errors (mount-allowlist rejections, missing agent_group, etc.)
tail -f ~/Library/Logs/nanoclaw.log
# Look for "MCP server started with N tools" in the learn-session log.
```

---

## Step 10 — Smoke test

Three checks. Each must pass for Phase 3 to be considered complete.

### 10a. Manual message → Socratic response

Send a DM to the learn channel: `"hi"`. Expected response per CLAUDE.local.md first-contact protocol: terse direct ask, no greeting (e.g., *"What are we learning today?"*) OR a stale-L-task probe if any L-task exists with 3+ days no notes.

If response is generic ("Hi! How can I help?") or has emoji or starts with "Hello" — the addendum isn't loaded into the system prompt. Check that `/workspace/agent/CLAUDE.local.md` is non-empty inside the learn container (`docker exec <learn-container> cat /workspace/agent/CLAUDE.local.md`).

### 10b. Force-fire 10am tick

Don't wait for tomorrow's natural fire. Manually trigger by inserting a one-shot:
```bash
sqlite3 "$LEARN_DB" <<EOF
INSERT INTO messages_in (id, seq, kind, timestamp, status, content, process_after, trigger)
VALUES (
  'phase3-smoke-morning',
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

Expected within 2 minutes: a learn-brief DM with "Today's micro-goal" / "Today's paper" / "AI news" structure. If WebSearch surfaces a paper URL, web tools work.

If the brief comes but mentions no paper / no news → check WebSearch is reachable from inside the container (`docker exec <learn-container> curl -I https://www.google.com`).

If the tick fires but errors on a missing L-task — that's expected on day 1 (no L-tasks exist yet). The brief should still send and surface the empty state cleanly.

### 10c. write_evidence path works

Manual test with a fake L-task or skip until a real L-task gets graded organically. To force:
```bash
# In a manual chat with learn-Telos, ask: "test write_evidence with a pretend L-task graded A".
# Watch for the tool call to succeed and a new evidence/EVD-NNN.md to land in Constantia.
ls -lt ~/path/to/constantia/evidence/ | head -5
```

If `write_evidence` errors with a path issue, the shared mount likely isn't resolving. Check `docker exec <learn-container> ls /workspace/extra/telos-tools/`.

---

## Rollback

If smoke fails and the issue isn't a quick fix:

1. Stop the learn session container.
2. Delete the agent_group and session rows from the central DB:
   ```bash
   sqlite3 "$NANOCLAW_DB" "DELETE FROM sessions WHERE id = '$LEARN_SESS_ID'; DELETE FROM agent_groups WHERE id = '$LEARN_AG_ID';"
   ```
3. Optionally remove `groups/telos-learn/container.json` (the per-installation config).
4. **Work session is unaffected** as long as steps 4 and 5 verified clean — the learn group is fully isolated.
5. To roll back the shared-tools refactor entirely:
   ```bash
   cd ~/path/to/nanoclaw
   git revert <phase-3-fork-sha>   # restores groups/telos/tools/
   # Restore the work container.json from the .bak:
   cp groups/telos/container.json.pre-phase3.bak groups/telos/container.json
   # Restart work session.
   ```

The session DB dir at `$LEARN_DB_DIR` can be left in place (orphaned but harmless) or removed.

---

## Post-deploy

- Update `STATUS.md` in guya repo: mark Phase 3 complete, note the SHA of the fork commit.
- Watch for tick-fire issues over the next 24h. The 5 learn ticks should produce 5 outbound DMs per day. If any tick silently drops, that's the ADR-013 anti-rot pattern — investigate before Phase 4.
- The work session's tick-fire pattern should be unchanged — no regressions from the shared-tools refactor.
- Phase 4 (life session) follows the same template. Replicate this runbook with `telos-life` group + Korean addendum + 5 life-tick crons.
