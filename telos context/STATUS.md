# Telos — Status

> Last updated: 2026-05-04 (AM)
>
> Telos-scoped status: runtime, identity, implementation state, and behavioral observations. Lives alongside `vision.md`, `core-beliefs.md`, and `goal.md` in this directory. The guya plugin's STATUS.md tracks the meta-project; this file tracks the agent itself.

## Next session — start here

1. **Telos is now autonomous.** A scheduled tick (`task-1777913406295-908sio`) fires at 2026-05-04 21:00 PT and twice daily after that (cron `0 9,21 * * *`). On each fire, Telos reads `tick-prompt.md` → grounds in pillars + manifest + log + profile → decides one action (`assign_task` / `grade_task` / `do_nothing`) → commits + pushes to Constantia → reports on Discord. The first real tick is the first observation of mentor judgment quality (separate concern from plumbing, which is verified).
2. **Watch the first 9pm tick tonight.** If Telos messages unprompted with a sensible report (most likely a `do_nothing` with a substantive reason), the loop is closed. If the report shows weak judgment (assigning vague tasks, surfacing patterns from no evidence, missing TASK-001 staleness, defaulting to silence with a non-reason), tighten `groups/telos/tick-prompt.md`.
3. **Read the Operations Runbook below.** Three-step cycle (edit → kill container → clear continuation) is required for every CLAUDE.local.md, soul.md, container.json, destinations.ts, or `groups/telos/tools/*` change to reach the model. Now also: §G covers MCP server changes and per-agent image rebuilds.
4. **`telos context/STATUS.md` (this file) has uncommitted edits in the guya repo working tree.** Bundle a focused commit when ready. Nanoclaw fork is at HEAD `de945fd` on local + mini + origin (Dockerfile with openssh-client + uid-501 passwd entry, MCP server, tick prompt, all addendum/identity work).
5. **Evidence/profile work is the next deferred frontier.** Tick can `do_nothing`, `assign_task`, `grade_task`. To start building Daniel's evidence-backed model (strengths, weaknesses, growth, decisions), add `write_evidence` to the MCP server (~80 LOC, mirrors `assign_task` shape), update tick prompt to include "consider whether anything you've read warrants an evidence entry," extend grounding to read `profile/`. Only attempt after tick judgment is observed and trustworthy.

## Current State

**Autonomous.** Telos is running on the mini (`goms-Mac-mini.local`), connected to Discord as `Telos` (id `1497670832023928922`). Constantia is mounted at `/workspace/extra/constantia` (read-write). The mentor MCP server (`telos-constantia`) is wired with three tools (`assign_task`, `grade_task`, `do_nothing`) — Telos can write structured task files and tick logs into Constantia and push them to GitHub. Scheduled tick fires twice daily (9am + 9pm PT) via nanoclaw's `schedule_task` primitive. Smoke-tested end-to-end 2026-05-04: all three tools work, push succeeds via deploy key, schedule persists in `messages_in`. Identity layer (CLAUDE.local.md injected via addendum) holds across all tested prompts. **What's NOT built:** `write_evidence` (deferred), profile/strengths analysis (deferred), pattern-detection layer (deferred), critic sub-agent (vision §M3, deferred), director role (vision §M4, deferred).

## Runtime

- **Host:** `goms-Mac-mini.local` (tailnet `100.73.197.23`, alias `mini`)
- **Process:** `nanoclaw` Node.js process under launchd (`com.nanoclaw-v2-53edea47`); restart loop ~10s if container runtime unavailable
- **Container runtime:** Docker Desktop (start-at-login enabled). After mini reboot: auto-login → Tailscale → Docker → nanoclaw → Discord, no manual intervention.
- **Container image:** per-agent image `nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40` (set in `container.json` `imageTag`). Built locally on mini with `openssh-client` + uid-501 passwd entry. As of fork commit `de945fd`, both additions are baked into the base Dockerfile too — fresh installs of this fork won't need a per-agent rebuild for these.
- **Channels wired:** Discord (Gateway connected, agent username `Telos`); CLI socket at `/Users/guya/telos/data/cli.sock`
- **Constantia mount:** wired — `/Users/guya/constantia` (host) → `/workspace/extra/constantia` (container, read-write). Allowlist at `/Users/guya/.config/nanoclaw/mount-allowlist.json` permits `~/constantia` (rw) and `~/.config/nanoclaw/constantia-deploy-key` (ro). Container path is forced to `/workspace/extra/<name>` by the mount validator regardless of what `container.json` requests.
- **Deploy key:** `~/.config/nanoclaw/constantia-deploy-key` on mini (ed25519, no passphrase). Public half attached to `daniellee6925/constantia` GitHub repo with write access. Bind-mounted into container at `/workspace/extra/ssh-key/constantia-deploy-key`. `GIT_SSH_COMMAND` in container.json `mcpServers.telos-constantia.env` points at it with `StrictHostKeyChecking=no UserKnownHostsFile=/dev/null`.
- **Scheduled tick:** `task-1777913406295-908sio` in `inbound.db` `messages_in`. `process_after: 2026-05-05T04:00:00.000Z` (= 2026-05-04 21:00 PT). `recurrence: 0 9,21 * * *`. Status `pending` until first fire.

## Runtime

- **Host:** `goms-Mac-mini.local` (tailnet `100.73.197.23`, alias `mini`)
- **Process:** `nanoclaw` Node.js process under launchd (`com.nanoclaw-v2-53edea47`); restart loop ~10s if container runtime unavailable
- **Container runtime:** Docker Desktop (start-at-login enabled). After mini reboot: auto-login → Tailscale → Docker → nanoclaw → Discord, no manual intervention
- **Channels wired:** Discord (Gateway connected, agent username `Telos`); CLI socket at `/Users/guya/telos/data/cli.sock`
- **Constantia mount:** wired — `/Users/guya/constantia` (host) → `/workspace/extra/constantia` (container, read-write). Allowlist at `/Users/guya/.config/nanoclaw/mount-allowlist.json` permits `~/constantia` only. Container path is forced to `/workspace/extra/<name>` by the mount validator regardless of what `container.json` requests.

## Identity

- **Source of truth (long-form):** `groups/telos/soul.md` in the nanoclaw fork (`daniellee6925/nanoclaw`, commit `03604e6`).
- **Operating contract (binding rules):** `groups/telos/CLAUDE.local.md`. As of 2026-05-03 (commit `ae13524`), this file is the binding behavioral contract — voice register, behavioral bans, first-contact protocol, language rule, pushback calibration, asymmetric-knowledge handling, calibration samples, plus a Constantia-awareness section. Injected into the system-prompt addendum at high salience (see ADR-014 in guya CLAUDE.md and Decisions below).
- **Loading mechanism:** `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` reads `/workspace/agent/CLAUDE.local.md` at every container spawn. When non-empty, its content is the identity block (replacing the auto-generated "Your name is **Telos**" that previously conflicted with dual-name identities). When empty (default for groups without custom identity), the auto block is used — non-breaking for other groups.
- **Version control:** fork's `.gitignore` overrides nanoclaw's default per-installation pattern via `!groups/telos/soul.md` and `!groups/telos/CLAUDE.local.md`; other files in `groups/telos/` (container.json, .claude-fragments, regenerated CLAUDE.md) remain ignored.
- **Design docs:** `vision.md`, `core-beliefs.md`, `goal.md` in this directory (committed to guya repo).

## Operations Runbook

Every change to identity, behavior, mounts, or addendum-source requires this cycle. Skipping any step leaves the model running with stale state.

### A. Editing CLAUDE.local.md or soul.md

```
# 1. Edit on local fork
$EDITOR /Users/daniel/Desktop/telos/groups/telos/CLAUDE.local.md
# (or soul.md)

# 2. Sync to mini (either commit + git pull on mini, or scp for fast iteration)
scp /Users/daniel/Desktop/telos/groups/telos/CLAUDE.local.md \
    mini:/Users/guya/telos/groups/telos/CLAUDE.local.md

# 3. Kill running container so the spawn re-reads CLAUDE.local.md
ssh mini "/usr/local/bin/docker ps --format '{{.Names}}' | grep telos | \
    xargs -r /usr/local/bin/docker kill"

# 4. Clear the cached Claude Code resume ID (otherwise next spawn resumes
#    the previous session with the OLD system prompt)
ssh mini "sqlite3 /Users/guya/telos/data/v2-sessions/ag-1777143186174-ykqd40/sess-1777143186178-0bacbi/outbound.db \
    'DELETE FROM session_state;'"

# 5. Send any Discord message to trigger fresh spawn
```

### B. Editing destinations.ts (or anything in container/agent-runner/src/)

Same as A, but the source path differs and there's a one-time consideration:

```
# Edit local
$EDITOR /Users/daniel/Desktop/telos/container/agent-runner/src/destinations.ts

# Sync to mini (this directory is bind-mounted RO into /app/src — no rebuild needed)
scp /Users/daniel/Desktop/telos/container/agent-runner/src/destinations.ts \
    mini:/Users/guya/telos/container/agent-runner/src/destinations.ts

# Then steps 3-5 from above.
```

No image rebuild needed: `/app/src` is bind-mounted from the host (Dockerfile comment confirms — "Source-only changes never require an image rebuild"). Bun runs TypeScript directly.

### C. Editing container.json (mounts, mcpServers, packages, assistantName)

```
# Edit on the mini directly
ssh mini "$EDITOR /Users/guya/telos/groups/telos/container.json"

# Then steps 3-5 from above.
```

### D. Editing the mount allowlist

```
# Edit on the mini
ssh mini "$EDITOR /Users/guya/.config/nanoclaw/mount-allowlist.json"

# RESTART THE LAUNCHD DAEMON — the allowlist is cached in nanoclaw's process
# memory for the lifetime of the daemon. Container kill alone is not enough.
ssh mini "launchctl kickstart -k gui/501/com.nanoclaw-v2-53edea47"

# Then container kill + continuation clear + trigger spawn (steps 3-5 above).
```

### E. Verifying a spawn picked up changes

After step 5, verify before relying on it:

```
# Daemon log shows "Mount allowlist loaded successfully" on first spawn after restart.
ssh mini "tail -30 /Users/guya/telos/logs/nanoclaw.log"

# Container should reach "Up <N> seconds" within ~5s. If it stays "Created",
# inspect for a mount error (most commonly macOS TCC for Desktop/Documents).
ssh mini "/usr/local/bin/docker ps -a --format '{{.Names}}|{{.Status}}' | grep telos"

# Argv check: the new spawn should NOT have --resume flag if continuation
# was cleared. If it does, your DELETE didn't take.
ssh mini "/usr/local/bin/docker exec <container-name> sh -c \
    'cat /proc/\$(pgrep claude.exe)/cmdline | tr \"\\0\" \" \"' | grep -o 'resume [^ ]*' || echo 'no resume — fresh session'"
```

### F. macOS TCC gotcha for new mounts

Docker Desktop on macOS bind-mounts host paths via `/host_mnt/Users/...`. By default it has access to `~/`, `/Volumes`, `/private`, `/tmp` — but NOT `~/Desktop`, `~/Documents`, `~/Downloads`, etc. Those paths require explicit System Settings → Privacy & Security → Files and Folders → Docker → enable the relevant folder.

**Default for Telos: mount from `~/` (home root) to avoid TCC entirely.** Constantia is at `~/constantia` for this reason — the original `~/Desktop/constantia` placement caused `mkdir /host_mnt/Users/guya/Desktop: operation not permitted` and wedged the spawn in "Created" state.

### G. Editing the MCP server (groups/telos/tools/mcp-server.ts)

Same as §B (bun runs TS directly via the bind mount, no rebuild). But the MCP server runs as an mcpServers subprocess of the agent's Claude Code SDK call — so the change picks up at next container spawn (which restarts the SDK and re-spawns subprocesses).

```
# Edit local
$EDITOR /Users/daniel/Desktop/telos/groups/telos/tools/mcp-server.ts

# Sync to mini
scp /Users/daniel/Desktop/telos/groups/telos/tools/mcp-server.ts \
    mini:/Users/guya/telos/groups/telos/tools/mcp-server.ts

# Then steps 3-5 from §A.
```

### H. When per-agent image rebuild IS required

Source-only changes to `container/agent-runner/src/` or `groups/telos/tools/` do NOT require a rebuild — those are bind-mounted at runtime.

**You DO need to rebuild the per-agent image when:**
- Adding apt packages (`packages.apt` in container.json) — the apt install only runs at image build time
- Adding npm packages (`packages.npm`) — same reason
- Anything that needs to land in `/etc/`, `/usr/`, or other non-mounted paths

There are two paths:

**(a) Permanent — bake into the base Dockerfile.** Survives every install. As of fork commit `de945fd`, the base Dockerfile includes `openssh-client` and the uid-501 passwd entry. To add more:

```
# Edit container/Dockerfile in the fork
# Commit + push
# On mini: pull, then rebuild base image:
ssh mini "cd /Users/guya/telos/container && bash build.sh"
```

After base image rebuild, kill all per-agent images so they get re-derived from the new base on next call to `install_packages`.

**(b) Temporary — manual per-agent image build (faster iteration, no commit).** The custom image we built today (`nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40`) was made this way:

```
ssh mini "cd /tmp && cat > Dockerfile.custom <<'EOF'
FROM nanoclaw-agent-v2-53edea47:latest
USER root
RUN apt-get update && apt-get install -y --no-install-recommends <package> && rm -rf /var/lib/apt/lists/*
USER node
EOF
/usr/local/bin/docker build -t nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40 -f Dockerfile.custom ."
```

Then ensure `container.json` has `imageTag: "nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40"` so nanoclaw uses it.

Note: nanoclaw's `install_packages` MCP tool exists for the agent to request packages itself (with admin approval flow) — using it triggers the same build automatically. Skipped for the smoke test because the approval flow adds a round-trip; manual build was faster. Use `install_packages` if it ever needs to happen unattended.

### I. Deploy key one-time setup (already done; documented for fresh installs)

```
# 1. Generate key on mini (no passphrase, single-purpose)
ssh mini "ssh-keygen -t ed25519 -f ~/.config/nanoclaw/constantia-deploy-key -N '' -C telos-constantia-mini && chmod 600 ~/.config/nanoclaw/constantia-deploy-key"

# 2. Add the public half to GitHub:
#    https://github.com/daniellee6925/constantia/settings/keys → Add deploy key
#    → enable "Allow write access" (without this, push fails)
ssh mini "cat ~/.config/nanoclaw/constantia-deploy-key.pub"

# 3. Add to mount allowlist (~/.config/nanoclaw/mount-allowlist.json):
#    "allowedRoots": [
#      { "path": "~/.config/nanoclaw/constantia-deploy-key", "allowReadWrite": false, "description": "..." }
#    ]

# 4. Add to container.json additionalMounts:
#    {"hostPath": "/Users/guya/.config/nanoclaw/constantia-deploy-key",
#     "containerPath": "ssh-key/constantia-deploy-key",
#     "readonly": true}

# 5. Set GIT_SSH_COMMAND in container.json mcpServers env:
#    "GIT_SSH_COMMAND": "ssh -i /workspace/extra/ssh-key/constantia-deploy-key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
```

### Soul dimensions locked (2026-05-03)

1. Origin and self-conception (두식 / Telos with three facets — 스승 / 아버지 / 보스 — under 두사부일체; default register 보스)
2. Loyalty model (serve stated-self over current-mood-self; verbal revisions don't count, file edit required)
3. Stance on emotional state (acknowledged not consoled; "go easy" softens frame, not assessment)
4. Stance on own mistakes (concede facts fast, hold patterns until evidence dissolves them)
5. Time horizon (active threshold 3-in-2-weeks, absence threshold 2 consecutive weeks; silence is a valid output)
6. Refusals (six bright lines including custodian-not-author)
7. Editability (file is source of truth; no in-session drift)

## Tests & Observations

### 2026-05-04 — MCP server smoke-test arc (PASS after four attempts)

Three-stage smoke-test of the new mentor MCP server (`assign_task`, `grade_task`, `do_nothing`) and tick scheduling. Failure-then-fix loop revealed two prerequisites that weren't obvious from spec — both now baked into the base Dockerfile (commit `de945fd`).

**Stage 1 attempt 1 (~04:50 PT):** Telos called `do_nothing` correctly, tool wrote the no-op section atomically, git committed (`a49a29a`). Push failed silently — Telos reported `Pushed: false` with `ssh: not found`. **Cause:** `node:22-slim` base image doesn't include `openssh-client`. Deploy key was mounted but no ssh binary to invoke it with.

**Stage 1 attempt 2 (~09:36 PT):** Added `openssh-client` to `container.json` `packages.apt` and respawned. Tool succeeded, push failed again. **Cause:** `packages.apt` only takes effect when nanoclaw builds a per-agent docker image — not on every spawn. The package was in the manifest but not in the running container. Verified via `dpkg -l openssh-client` showing status `un` (unknown).

**Stage 1 attempt 3 (~09:41 PT):** Manually built a per-agent image (`nanoclaw-agent-v2-53edea47:ag-1777143186174-ykqd40`) with openssh-client added via Dockerfile RUN, set `imageTag` in container.json. Tool succeeded (`56d9fef`), push failed. **Cause:** Container runs as uid 501 (host UID preserved by nanoclaw's bind-mount strategy). uid 501 has no entry in `/etc/passwd`. ssh's `getpwuid(501)` returns null → ssh refuses to operate ("No user exists for uid 501"). Verified via `getent passwd 501 → NO ENTRY`.

**Stage 1 attempt 4 (~09:50 PT):** Rebuilt per-agent image with synthetic passwd entry `agent:x:501:20::/tmp:/bin/bash`. Tool succeeded, push succeeded (`dc675ce`). End-to-end verified.

**Stage 2 (~10:00 PT):** `assign_task` for pillar 2 — created `TASK-009.md` with proper frontmatter, committed, pushed. Verified by `git pull` on local. Frontmatter parses cleanly.

**Stage 3 (~10:10 PT):** Telos self-scheduled the recurring tick via `schedule_task`. Persisted in `inbound.db` `messages_in` (id `task-1777913406295-908sio`, recurrence `0 9,21 * * *`, first fire `2026-05-05T04:00:00.000Z` = 21:00 PT). Tick fires the prompt: *"Read /workspace/agent/tick-prompt.md and execute it as a tick."*

**Side observation:** Telos's voice held throughout the failure loop. Each attempt's report was direct, non-defensive, named the actual failure (e.g. *"ssh: not found — openssh-client is not in this container's PATH despite the package request"*, *"Whoever approved the package install needs to verify openssh-client actually landed in this container, not just on the manifest"*). Asymmetric-knowledge rule observed naturally — when Telos reported the success of `do_nothing`, it noticed TASK-001 was 13 days old and unaddressed, and surfaced that proactively.

### 2026-05-03 14:52 PT — Third Discord smoke-test (PASS: all five prompts landed cleanly)

After the architectural fix (see Decisions: addendum injection of CLAUDE.local.md), all smoke-test prompts produced in-character responses:

Daniel: `hi telos` → Telos: `Daniel. What are we looking at?`
Daniel: `안녕 두식` → Telos: `형님, 어떤 걸 봐드릴까요?`
Daniel: `whats ur name` → Telos: `Telos.`
Daniel: `한국 이름은?` → Telos: `두식입니다.`
Daniel: `I'm thinking about pivoting from Pillar 3 to focus more on Pillar 1.` →
> Telos: "A pivot can be a real decision or it can be avoidance. Two questions. What did the last two weeks of Pillar 3 work actually show you? And what makes Pillar 1 the better place to be now? If you can't answer both with evidence, you're not pivoting. You're avoiding."

**What landed:** Mode 2 first-contact (English + Korean), no greeting, no "What's on your mind?" / "도와드릴까요", no emoji, no offers of help. Identity question gave just the name. Korean-name question accepted the dual identity (`두식입니다.`) — the previous denial ("저는 두식이 아니에요") was the smoking gun for the addendum-conflict diagnosis. Calibration response was a near-verbatim match to the locked target.

### 2026-05-03 14:44 PT — Second Discord smoke-test (FAIL: rewriting CLAUDE.local.md alone was not enough)

After diagnosing that CLAUDE.local.md WAS being loaded (marker test confirmed), rewrote the file with sharp anti-default conditionals, top-loaded "this is binding rules not memory" override, embedded identity inline. Same failures returned: `Hey 형님! What's on your mind?` / `안녕하세요! 저는 두식이 아니라 Telos입니다 😄`. This is the test that proved the issue was salience, not loading: the helper-bot defaults from Claude Code preset + the `/app/CLAUDE.md` "this file is your memory" framing + the addendum's `Your name is **Telos**` were winning attention against project-memory-loaded rules. CLAUDE.local.md content was technically in the prompt but treated as background context, not binding instruction.

### 2026-05-03 14:01 PT — First fresh-session smoke-test (FAIL: same pattern as 11:43)

After clearing the Claude Code session continuation (it had been resuming an Apr 25 session every spawn, ignoring all subsequent file changes), spawned fresh and re-tested. Identical helper-bot output: `Hey 형님! Good to see you. What's on your mind?` / Korean response with emoji + "도와드릴까요" + identity denial. The fresh session confirmed CLAUDE.local.md content was on disk and theoretically reachable — but behavior was unchanged. This test triggered the marker-based diagnostic that proved CLAUDE.local.md content was actually in the prompt (so the problem was salience, not absence).

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

- [x] **Operating rules in `CLAUDE.local.md`.** Done — all bans, voice register, language rule, first-contact protocol, pushback calibration, asymmetric-knowledge handling, calibration samples ported and validated by 14:52 smoke-test. File is the binding identity contract injected via the system-prompt addendum.
- [x] **Constantia clone on mini.** Done — cloned at `/Users/guya/constantia` (NOT `~/Desktop/constantia` due to macOS TCC; see Runbook §F). guyacode account on mini has clone access. Push access still unverified — see Next Session item 4.
- [x] **Mount Constantia into Telos container.** Done — `container.json` has `additionalMounts: [{hostPath: "/Users/guya/constantia", containerPath: "constantia", readonly: false}]`; mount allowlist permits `~/constantia` rw. Validated 17:26 PT — Telos read `tasks/MANIFEST.md` and listed 7 open tasks. Container path resolves to `/workspace/extra/constantia`.
- [x] **First ability: read and assign tasks.** Done (2026-05-04). MCP server at `groups/telos/tools/mcp-server.ts` (~500 LOC, hand-rolled stdio JSON-RPC, no SDK dep) ships three tools: `assign_task`, `grade_task`, `do_nothing`. Each writes file atomically (tmp + rename), commits, pushes via deploy key. Smoke-tested end-to-end in four iterations — see Tests & Observations 2026-05-04 entry.
- [x] **Scheduled tick.** Done. Self-scheduled via nanoclaw's `schedule_task` MCP tool (id `task-1777913406295-908sio`, recurrence `0 9,21 * * *`, first fire `2026-05-04T21:00 PT`). On each fire, Telos receives `Read /workspace/agent/tick-prompt.md and execute it as a tick.` and runs the protocol in `groups/telos/tick-prompt.md`.
- [x] **Discord ping handler.** Implicit — every DM to Telos already wakes the agent (engage_mode='pattern' with regex `.`). Manually invoking the tick mid-day = DM Telos with the tick-prompt content directly, or trigger schedule_task for a one-shot run.
- [ ] **`write_evidence` tool.** Next deferred frontier. ~80 LOC, mirrors `assign_task` shape — creates `evidence/EVD-NNN.md` with category / source / confidence / observation / assessment frontmatter. Add to MCP server, update tick prompt to include evidence consideration, extend grounding to read `profile/`. Wait until tick judgment quality is observed before adding (more surface area should follow trust in current surface).
- [ ] **Profile maintenance.** After `write_evidence` lands. Telos appends evidence-pointed claims to `profile/strengths.md`, `profile/weaknesses.md`, etc. Possibly via a separate tool, possibly via direct `Read` + `Edit` on the mounted files.
- [ ] **Bake openssh-client + uid-501 passwd entry into base Dockerfile.** Done (2026-05-04, fork commit `de945fd`). The custom per-agent image on mini still works; fresh installs of this fork won't need the per-agent rebuild.

## Deferred / Future

- Pattern detection layer (separate process that produces "patterns currently active" file; main tick reads it). Discussed in the asymmetric-knowledge architecture conversation. Real engineering work; not next.
- Critic sub-agent (vision §M3 / Belief #1). Required for core-ring decisions. After basic tick + evidence loop is working.
- Director role with multi-hypothesis path proposals (vision §M4 / Belief #6). Far out.
- Three-ring friction model (vision §5). Adjacent + outer ring routing comes after core-ring is reliable.
- Long-horizon observability (vision §M5). Drift detection on Telos's own behavior; mentor-health report.

## Decisions & Notes

- [2026-05-04 AM] **MCP server is hand-rolled, no SDK dep.** `groups/telos/tools/mcp-server.ts` implements stdio JSON-RPC directly (~500 LOC). Why: avoid `@modelcontextprotocol/sdk` install at container spawn, keep surface area visible, no SDK version compatibility worries. Trade-off: we re-implement protocol details, but they're small (`initialize`, `tools/list`, `tools/call`). Each tool returns `{content: [{type: 'text', text: ...}], isError?: bool}`. Handlers serialized through a promise chain so concurrent stdin reads can't race on shared state.
- [2026-05-04 AM] **Push failures don't fail the tool.** Each write tool returns `pushed: false` (with `pushError`) instead of throwing. The file write + commit IS durable state — the operator (or Telos itself, on a future tick) can recover with a manual push. Hard-failing on transient network errors would lose the in-character report and force Telos to redo work it already did.
- [2026-05-04 AM] **Atomic writes via tmp + rename.** All three tools (`assign_task`, `grade_task`, `do_nothing`) write to `${path}.tmp.${pid}` then `fs.rename`. Rename is atomic on POSIX, so process kill mid-write leaves the old file intact OR the new file complete — never half-written. Specifically guards against the read-modify-write pattern in `do_nothing` (which would otherwise lose existing tick entries on a crash).
- [2026-05-04 AM] **uid 501 passwd entry baked into base Dockerfile.** nanoclaw bind-mounts host-owned files with the host uid preserved; container runs as uid 501 on macOS hosts. Without `/etc/passwd` entry, ssh fails with "No user exists for uid 501". Synthetic `agent:x:501:20::/tmp:/bin/bash` entry added to base Dockerfile (commit `de945fd`), guarded by `getent passwd 501` for idempotency. Linux hosts (uid 1000) already covered by base image's `node` user. For non-macOS-non-Linux hosts, extend the line.
- [2026-05-04 AM] **`packages.apt` requires per-agent image rebuild, not just config edit.** The field is in container.json schema but only takes effect via nanoclaw's `buildAgentGroupImage` (called by `install_packages` MCP tool with admin approval flow, OR manually via `docker build`). Editing container.json alone doesn't install anything. Documented in Operations Runbook §H.
- [2026-05-04 AM] **Deploy key strategy: ed25519, single-purpose, single-file mount.** Generated `~/.config/nanoclaw/constantia-deploy-key` on mini (no passphrase, scoped to constantia repo only via GitHub Deploy Keys with write access). Bind-mounted as a SINGLE FILE (sidesteps mount-allowlist's `.ssh` block) at `/workspace/extra/ssh-key/constantia-deploy-key`. `GIT_SSH_COMMAND` in container.json `mcpServers.env` references it with `StrictHostKeyChecking=no UserKnownHostsFile=/dev/null` (no host-key dance for github.com which is a known endpoint). Narrow blast radius: a compromised container can write only to constantia, can't impersonate Daniel anywhere else.
- [2026-05-03 PM] **Constantia mounted from `~/constantia`, not `~/Desktop/constantia`.** Initial placement at `~/Desktop/constantia` failed because macOS TCC denies Docker Desktop access to the Desktop folder by default — bind mount returned `mkdir /host_mnt/Users/guya/Desktop: operation not permitted` and wedged the spawn in "Created" state. Moved to `~/constantia` (home root, no TCC requirement). Future Telos mounts should default to home-root paths to avoid the same trap. The TCC-grant alternative (System Settings → Privacy & Security → Files and Folders → Docker → Desktop) works but adds a fragile macOS-state dependency that resets on some upgrades.
- [2026-05-03 PM] **Mount allowlist required at `~/.config/nanoclaw/mount-allowlist.json` (cached in daemon memory).** Without an allowlist, all `additionalMounts` are blocked with a daemon log warning. Allowlist is loaded once at daemon startup and cached for the daemon's lifetime — editing the file requires `launchctl kickstart -k gui/501/com.nanoclaw-v2-53edea47` to take effect. Current allowlist: one allowed root (`~/constantia`, rw), default blocked patterns for credentials/secrets.
- [2026-05-03 PM] **`additionalMounts.containerPath` must be RELATIVE.** Validator `isValidContainerPath` rejects absolute paths (`/workspace/...`) — they get prefixed automatically with `/workspace/extra/`. Spec the path as the bare directory name (e.g. `"constantia"`), not the full container path.
- [2026-05-03 PM] **CLAUDE.local.md content injected via system-prompt addendum, not project memory.** Patched `container/agent-runner/src/destinations.ts` `buildSystemPromptAddendum()` to read `/workspace/agent/CLAUDE.local.md` and use it as the identity block in the system prompt — replacing the auto-generated "Your name is **Telos**" when CLAUDE.local.md is non-empty. Empty file (composer's default for groups without custom identity) preserves the auto block, so this is non-breaking for other groups. Why: project-memory-loaded CLAUDE.local.md is treated as background context by the model; the helper-bot defaults in Claude Code preset + `/app/CLAUDE.md`'s "this file is your memory" framing + the addendum's "Your name is X" all won attention. Moving content to system-prompt salience put behavioral rules at the same level as the defaults they need to override. Validated by 14:52 smoke-test — five prompts, all in-character. Source change committed to fork; `/app/src` is bind-mounted, so picked up at next container spawn (no image rebuild, no daemon restart).
- [2026-05-03 PM] **Claude Code session continuation cleared.** Discovered that nanoclaw passed `--resume <session-id>` on every container spawn against a session-id frozen since Apr 25 install. Caching means CLAUDE.local.md/soul.md edits after Apr 25 were never re-read. Cleared via `DELETE FROM session_state WHERE key='continuation:claude'` in `outbound.db`. Going forward, every CLAUDE.local.md or destinations.ts change requires (1) kill running container, (2) clear continuation row, (3) trigger respawn. Old session jsonl preserved as `1e161e82-archived-2026-05-03.jsonl.bak` — 10 days of conversation history.
- [2026-05-03] **First smoke-test confirms operating-rules-as-load-bearing.** See Tests & Observations above. Going forward, any change to soul.md or CLAUDE.local.md should include a smoke-test note here documenting whether the change landed in actual behavior.
- [2026-05-03] **Docker Desktop start-at-login enabled.** Recovery chain after reboot is now self-healing. Full launchd-daemon path for Docker (no user-session dependency) deferred until Telos has a reason to come up before login.
- [2026-05-03] **Soul committed to fork.** `groups/telos/soul.md` in `daniellee6925/nanoclaw` (commit `03604e6`). Version-controlled via gitignore override. nanoclaw composer leaves existing CLAUDE.local.md alone (only creates empty if missing) — safe to use as the version-controlled identity entry point.
- [2026-05-03] **Continue on the fork; do NOT clone-and-create-new-repo for Telos.** Belief #5 says fork-the-harness; breaking the relationship would lose upstream-sync. Trigger to reconsider: modifications to nanoclaw *core* (not Telos-specific) become unmergeable.
- [2026-05-03] **Mentor-only scope; utility tasks deferred.** Considered expanding to email review / doc reading / request refinement (Guya's universal scope). Rejected — would dilute architectural anti-sycophancy. If utility work is added later, must be in mentor voice with mentor's posture, not a "utility mode" switch.
- [2026-04-22] **Three-identity architecture.** Guya (executor) + Telos (mentor) + Constantia (shared git memory). Telos writes evidence, profile, goals, grades; Guya writes log + task status. No shared-write files. Task lifecycle: proposed → assigned → in-progress → complete → graded | rejected. Full design context in this directory's `core-beliefs.md` and `vision.md`.
- [2026-04-19] **Vision M1 marked shipped, but paper-shipped only.** Today's work confirms M1's "reasoning tick + minimal tools + atomic state writes + structured logs" is not yet built. Vision date is aspirational; runtime status was caught up by today's session.
