# ADR-024: Docker bind-mount breaks container-side `git rebase`; host-side `constantia-sync` daemon owns push

**Status:** Accepted
**Date:** 2026-05-16

## Decision

Container-side Telos code commits to constantia but does NOT push. A new host-side launchd daemon (`constantia-sync`) polls the repo every 5s and runs `git fetch + git rebase + git push` on mini's native APFS filesystem, where git behaves correctly.

The container-side `helpers.ts:commitAndPush` is renamed `commitOnly(message, paths)` and reduced to `git add -A <paths>` + `git commit`. All 10 MCP-tool callers pass the specific paths they wrote so concurrent containers don't capture each other's mid-write files (eliminates the `git add -A` race surface). The host post-commit hook's auto-push and `check_reminders.sh`'s inline pull/push are dropped — the daemon is the only pusher.

Daemon health surfaces via `/Users/guya/constantia/.git/sync-status.json` (heartbeat + last-cycle outcome). The Guya session-start hook reads it and emits an alert when the heartbeat is stale (>5 min) or the last cycle ended in a rebase conflict / push failure. Silent in the healthy case.

## Amendment (2026-06-08): idle-pull + deploy-key pin

Two gaps surfaced when laptop→Mini sync stalled — triggered by the first-ever task-file merge conflict: Telos graded T-006 (`status: graded`, grade A) on the Mini from a *stale* base while the laptop set `status: complete`, colliding on the same frontmatter line. The daemon (correctly) parked on `conflict`; clearing it took a manual pause → rebase → merge-keeping-both → regen MANIFEST → push → restart.

1. **Idle-pull.** `do_cycle` short-circuited to `no-op` the moment `local == last_pushed`, never fetching — so an idle Mini never pulled laptop commits until its own next commit (this is the gap that let Telos grade from a stale base). The idle branch now does a throttled (60s) `git fetch + merge --ff-only`. **ff-only is provably safe there:** `local == last_pushed` ⇒ zero unpushed local commits ⇒ origin is equal-or-ahead, never diverged. This revisits the Decision's original "fetch+rebase as a push precondition" model — and the 2026-05-06 "not a periodic pull-cron" caution: that footgun was *container-side* bind-mount corruption, which **this ADR already eliminated** by moving git to the host's native APFS. Host-side ff-only is safe. Folded into the one daemon (not a separate puller) to avoid a two-process `index.lock` race. New status outcome `pulled` is healthy — `readSyncStatus` treats it as such by omission (blacklist of `conflict`/`push-failed`/`fetch-failed`).

2. **Deploy-key pin.** The daemon ran git with no explicit key, relying on the repo's `core.sshCommand` — which points at the *container* path (`/workspace/extra/ssh-key/constantia-deploy-key`, nonexistent on the host). git silently fell back to the host's default SSH identity (`guyacode`, **not** the repo-scoped `daniellee6925/constantia` deploy key). It happened to work because guyacode is a collaborator — a latent landmine. The daemon now `export`s `GIT_SSH_COMMAND="ssh -i /Users/guya/.config/nanoclaw/constantia-deploy-key -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"`, so a broken/rotated default identity can't mask a failure.

Both shipped in constantia `scripts/constantia-sync.sh` (`eec5382`), `bash -n` + both review passes clean, and verified live: an idle Mini pulled a marker commit on its own (`last_cycle_outcome: "pulled"`, divergence 0/0).

## Why — symptom

For ~2 days (2026-05-14 → 2026-05-16) Telos commits accumulated on mini's local main without ever reaching origin. The reflog showed **14 consecutive `rebase (start) + rebase (abort)` pairs in the same second** — every Telos action hit a rebase failure that `helpers.ts:commitAndPush`'s try/catch auto-aborted, retaining the local commit. After 2 days, 21 commits sat unpushed and Telos's DMs to Daniel reported a different "blocking file" each time (whichever file the latest action wrote).

## Why — diagnostic chain

Four hypotheses tested via instrumented `commitAndPush` (E1 trace logged to `.git/git-debug.log`):

**H1 — concurrent-container race.** Two simultaneous test fires inserted into WORK and LIFE inbound.db at the same `process_after`. **Refuted:** nanoclaw serialized the spawns; containers ran ~14s apart. `git status --porcelain` was `<clean>` immediately before each rebase failure.

**H3 — mid-flight working-tree dirt (something writing files between commit and rebase).** **Refuted:** the instrumented log showed working tree clean at the `before-rebase` stage in every failed cycle. No concurrent writer was observed.

**H4 — container's git version too old.** Debian-bookworm image ships git 2.39.5; host has Apple Git 2.50.1. Installed git 2.47.3 in a running container via `apt -t trixie`. **Refuted:** 2.47.3 fails the same way.

**H5 — Docker bind-mount filesystem semantics.** The container's view of `/Users/guya/constantia` is via gRPC FUSE / virtio-fs. Tested by copying the exact same repo bytes from the bind mount to the container's overlay filesystem (`cp -R /workspace/extra/constantia /tmp/c-test`) and re-running the same `git rebase origin/main` from `/tmp/c-test`. **Confirmed:**

```
$ git -C /workspace/extra/constantia rebase origin/main    # bind mount
Rebasing (1/21)error: Your local changes to the following files would be overwritten by merge:
    profile/strengths.md
    profile/weaknesses.md
Please commit your changes or stash them before you merge.

$ git -C /tmp/c-test rebase origin/main                    # overlay FS
Rebasing (1/21)...
Rebasing (21/21)
Successfully rebased and updated refs/heads/main.
```

Same git binary. Same data. Same container. Only the filesystem layer differs. Git's `unpack-trees` safety check (which fires before `pick` to verify the rebase target's tree won't clobber working-tree changes) misreads tracked-but-divergent file state through the bind mount. The check is correct in spirit — working-tree blobs differ from rebase-target blobs because of the local commit chain — but on native FS the same check passes because git reconciles via index, while on bind mount the index/working-tree reconciliation diverges.

This is consistent with known Docker-on-macOS file semantics issues (mtime precision, stat caching, atomic-rename behavior under the FUSE layer). The exact upstream root cause inside Docker's mount layer is not pinned down; the structural fix is to keep working-tree operations off the bind mount.

## Adjacent bugs surfaced in the same debug session

Two more bugs surfaced once the bind-mount issue was understood. Both predated this debug session but were masked by the rebase failure swallowing all attention:

1. **Container missing `python3`.** The constantia post-commit hook uses `python3` in its `trunc` helper. Container image doesn't ship python3 → hook's `set -e` exits early → MANIFEST regeneration writes a partial file → working tree dirty → next rebase fails on "unstaged changes" instead of the bind-mount error. Replaced `trunc` with pure-bash parameter expansion. Container hook now runs cleanly.

2. **`check_reminders.sh` silent for 2+ days.** Independent issue. Filed as constantia issue #1. The script's git flow (commit + pull --rebase + push) had no `git rebase --abort` on conflict, so any rebase failure left a paused rebase that broke every subsequent cycle. Refactored to commit-only; daemon handles push.

## Fix

**`constantia-sync` daemon** (`scripts/constantia-sync.sh` + `~/Library/LaunchAgents/com.guya.constantia-sync.plist`):

```
loop every 5s:
  1. Abort any stale rebase/merge from a prior killed cycle.
  2. local = git rev-parse main; origin = git rev-parse origin/main
  3. If local == last_pushed_sha → heartbeat-only, exit.
     If local == origin → mark current as pushed, exit.
  4. git fetch origin main
  5. git rebase origin/main
       on conflict → git rebase --abort + status='conflict' + exit cycle
       (next cycle retries; self-clears when Daniel resolves)
  6. git push origin main
  7. Write status.json: last_cycle_ts, last_cycle_outcome, last_push_sha, ...
```

The daemon's atomic-write contract on status.json (tmp + rename) lets readers see consistent state without locking.

**Container-side changes:**
- `telos-tools/helpers.ts`: `commitAndPush(message)` → `commitOnly(message, paths)`. Drops fetch / rebase / push entirely. Each caller passes the specific files it wrote.
- `mcp-server.ts`: all 10 MCP handlers updated. `appendTickLogSection` now returns its log path so callers can include it in `commitOnly`'s paths array.
- `constantia/hooks/post-commit`: drops auto-push (daemon owns push). `trunc` helper rewritten in pure bash (kills the python3 dependency).
- `constantia/scripts/check_reminders.sh`: drops inline pull/push (daemon owns push). Just commits R-file status flips locally.

**Guya-side:** `guya-plugin/hooks/constantia-sync.mjs` exports `readSyncStatus(path)` which reads the daemon's status file and returns an alert string when heartbeat is stale or last cycle errored. `guya-session-start.mjs` calls it and emits a `constantia-sync-alert` section when the alert fires. Silent in the healthy case.

## Validation

Three verification ticks fired sequentially after deployment:
1. Bootstrap rebase of the 21-commit backlog via host git — applied all 21 picks cleanly, pushed `7f2d61a..0257c57`.
2. Parallel-run tick (helpers.ts unchanged, daemon active): container committed locally, daemon detected the new local SHA within 5s, pushed cleanly. Status file showed `last_cycle_outcome: "ok"`.
3. Post-refactor verification tick (helpers.ts uses new `commitOnly`): container committed `b5abc25` touching only `log/telos/2026-05-16-tick.md`. Daemon pushed within 5s. `git log -1 --stat` confirmed only the explicit path was staged.

Daemon has been running stable since. Heartbeat consistently <10s old; multiple natural-cron ticks have pushed without intervention.

## Meta-pattern

Same family as ADR-011/012/013/016/018/019/020/021/022/023 — silent rot of trusted enforcement. The specific pattern here:

- **Trusted abstraction:** "container's git operates on the constantia repo correctly because it's a normal mounted filesystem."
- **Silent failure mode:** git's `unpack-trees` safety check returns the wrong answer through the bind mount layer. The error message ("your local changes would be overwritten by merge") is technically true but the proposed remedy (commit or stash) is impossible because there are no uncommitted changes to commit or stash.
- **What kept it silent:** `helpers.ts` caught the rebase error and auto-aborted, returning `pushed: false` in the tool response. Telos reported the failure to Daniel as a per-tick blocker, naming whichever file was in the action's diff. The structural cause was the same every time; the surface symptom rotated.

Two-and-a-half years of git releases between container (2.39.5) and host (2.50.1) was a tempting hypothesis — same shape as "library X has a bug fixed in version Y." Testing it via in-container `apt -t trixie install git` (cheap, definitive) refuted it cleanly. Worth the 15 minutes.

## Anti-rot watches

- **Daemon health is now the single point of trust.** If the daemon dies and the heartbeat-staleness alert in session-start fails (e.g., status file path drift), commits silently pile up on mini's local main again. The session-start surface MUST be load-bearing — verify on every Guya repo change to the session-start hook.
- **Status file path is `/Users/guya/constantia/.git/sync-status.json`** — under `.git/` so it's never tracked. If git's gitignore semantics for `.git/` ever change, or if someone moves the file out from under `.git/`, the path needs updating in two places (daemon + Guya's `constantia-sync.mjs:readSyncStatus`).
- **Laptop sessions don't see the status file** (it lives on mini's filesystem; `.git/*` isn't synced via git). For now, accept that the alert surface only fires on mini-side sessions. If Daniel routinely runs Claude Code on mini, this is fine. If not, the alert is silent on the machines that matter — needs a separate sync path (e.g., daemon writes a tracked-but-throttled status note, or laptop pulls status via ssh on session-start).
- **`git add -A` was a latent concurrent-write race** that never bit us in practice but was structurally wrong. Now removed via explicit paths. If a future MCP handler is added and uses naked `commitOnly(msg, [])` (empty paths), the function will create an empty commit object — almost certainly a bug. Worth a unit-level guard.
- **The `unpack-trees` safety check in container's git is still wrong** and could affect operations beyond `rebase`. We've only verified `commit` works through the bind mount (because it doesn't touch the working tree). If Telos ever needs `checkout`, `merge`, `cherry-pick`, or any other working-tree mutation in-container, expect the same failure mode. Push that work to the host daemon too.

## Commits

| Repo | SHA | What |
|------|-----|------|
| constantia | `eec5382` | **Amendment (2026-06-08):** idle-pull (throttled fetch + ff-only) + deploy-key pin via `GIT_SSH_COMMAND`+`IdentitiesOnly` |
| constantia | `0257c57` | Bootstrap rebase of 21-commit backlog (host git) |
| constantia | `deeb32c` | post-commit `trunc` pure-bash + daemon jq conflict-extraction safe |
| constantia | `1930445` | Drop post-commit auto-push (daemon owns push) |
| constantia | `37ff5b4` | Drop pull/push from `check_reminders.sh` |
| telos fork | `184a7d5` | `helpers.ts` → `commitOnly(message, paths)`; all 10 MCP callers updated |
| guya | `bf46252` | Session-start surface for `constantia-sync` status |
| guya | this commit | ADR-024 |
