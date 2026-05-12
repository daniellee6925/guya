# Phase 5 — Reminder firing infra deploy runbook

> Started: 2026-05-11. Authored before deploy; "Lessons learned" filled after smoke.

## What ships

| Repo | Path | Purpose |
|---|---|---|
| `constantia` | `scripts/check_reminders.sh` | The poller. Walks `tasks/reminders/R-*.md`, evaluates schedule + last_fired, inserts a `messages_in` row into life-session `inbound.db` when due. |
| `telos` (fork) | `launchd/com.guya.reminder-fire.plist` | LaunchAgent template. `StartInterval=60`. Per-host install copies + substitutes `{{HOME}}`, `{{CONSTANTIA_ROOT}}`. |
| `guya` | `docs/2026-05-11-phase5-deploy-runbook.md` | This file. |

## Design (locked 2026-05-11)

- **`last_fired` for cron** = mini-local sidecar JSON only. R-file frontmatter `last_fired` stays null in git. Sidecar at `~/.local/state/guya-reminder-fire/last_fired.json`. Idempotency keyed on `YYYY-MM-DDTHH:MM` so a re-fire within the same minute is a no-op.
- **`last_fired` for once** = R-file frontmatter (status flips pending→fired, last_fired set, commit + push). Low volume — each once-shot is single-use.
- **Message shape** = XML wrap: `<reminder id="..." title="..." schedule_type="..." schedule_(at|expr)="...">body</reminder>`. `kind='task'` matches existing scheduling-module path; differentiation lives in content, not kind.
- **TZ** = `America/Los_Angeles`, set in plist EnvironmentVariables.
- **PATH** = Docker.app + Homebrew prepended per Phase 3 lesson L4 (defensive parity with nanoclaw plist).

## Pre-deploy checklist

- [ ] `bash -n scripts/check_reminders.sh` passes
- [ ] Local smoke test: temp dir + synthetic inbound.db with messages_in schema + 3 R-files (cron-match-now, cron-no-match, once-past) → expect 2 rows inserted, R-files updated correctly, idempotent on re-run
- [ ] `jq`, `sqlite3`, `openssl`, `python3` available on mini (all default on macOS + Homebrew)
- [ ] LIFE session `inbound.db` exists at the configured path
- [ ] Daniel SSH access to mini confirmed

## Deploy steps

### A. Laptop side — author + commit

1. Write `~/Desktop/constantia/scripts/check_reminders.sh`, `chmod +x`.
2. Local smoke test (see test block in this file's Lessons section).
3. Write `~/Desktop/telos/launchd/com.guya.reminder-fire.plist` (template form, `{{HOME}}` + `{{CONSTANTIA_ROOT}}` substituted at install time).
4. Commit + push both repos.

### B. Mini side — pull + install plist

```bash
ssh guya@<mini>
cd ~/constantia && git pull --rebase
cd ~/telos && git pull --rebase

# Substitute template
HOME_DIR=$HOME
CONSTANTIA_ROOT=$HOME/constantia
mkdir -p ~/Library/LaunchAgents ~/Library/Logs ~/.local/state/guya-reminder-fire
sed -e "s|{{HOME}}|$HOME_DIR|g" \
    -e "s|{{CONSTANTIA_ROOT}}|$CONSTANTIA_ROOT|g" \
    ~/telos/launchd/com.guya.reminder-fire.plist \
    > ~/Library/LaunchAgents/com.guya.reminder-fire.plist

# Load
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.guya.reminder-fire.plist
launchctl enable gui/$(id -u)/com.guya.reminder-fire

# Verify
launchctl print gui/$(id -u)/com.guya.reminder-fire | head -30
tail -f ~/Library/Logs/com.guya.reminder-fire.log
```

### C. Smoke test (synthetic R-files)

From laptop, use the `add_reminder` MCP tool via Telos work-session to create:

1. `schedule_type=once`, `schedule_at=<now+90s PT ISO>`, title `"phase5 smoke once"`, context `"smoke test — retire immediately"`
2. `schedule_type=cron`, `schedule_expr=* * * * *`, title `"phase5 smoke cron"`, context `"smoke test — retire immediately"`

Wait ~2 minutes. Expect:
- 1 DM in `#telos-life` from once reminder
- 1+ DMs from cron reminder
- `inbound.db` shows the inserted rows
- Sidecar JSON on mini has both IDs with current minute timestamp

### D. Retire smoke

Immediately after verification (don't leave the every-minute cron running):

```bash
# On laptop:
cd ~/Desktop/constantia
# For the cron one, edit status: active → retired in the R-file (validator enum: active|paused|retired)
# For the once one, it's already status: fired — leave or set to archived (enum: pending|fired|archived)
git add tasks/reminders/ && git commit -m "fire(reminder): retire phase5 smoke tests"
git push

# On mini:
cd ~/constantia && git pull --rebase
# Confirm next launchd fire is silent
tail -f ~/Library/Logs/com.guya.reminder-fire.log
```

Validator enums (verified in `hooks/pre-commit:182,188`): once → `pending|fired|archived`; cron → `active|paused|retired`.

### E. Document

- [ ] Update `STATUS.md`: mark Phase 5 complete, mention Phase 6 as next
- [ ] Append "Lessons learned" section to this runbook
- [ ] If any new silent-rot variant surfaced, candidate for ADR-019 (or successor)

## Phase 3 + Phase 4 lessons baked in

- **L1** Constantia post-commit hook breaks rebase — fixed in `7095f49`. The script's batch-commit at end of run inherits the fix.
- **L2** OneCLI requires lowercase IDs — N/A (no new agent_groups).
- **L3** `imageTag: :latest` — N/A (no container changes).
- **L4** plist PATH must include Docker.app + Homebrew — **applied** (defensive parity).
- **L5** `messaging_group_agents` row mandatory — N/A (using existing wiring).
- **L6** transient 125 on first spawn after kickstart — N/A (no nanoclaw restart needed).
- **L7** synthetic test messages without Discord routing contaminate session state — **mitigated** by routing via real cron fire path. Test reminders fire through the SAME poll-loop as real ticks, so no "no destination" pattern can leak.

## Lessons learned

**L8 — Phase 5 infra delivers; LIFE addendum has no `<reminder>` handler.**
Three smoke fires (R-003 cron at 23:46, R-002 once-shot at 23:47:22, R-003 cron at 23:47) all landed as `kind=task` rows in `inbound.db` and were processed by life-Telos (status → `completed`). **Zero outbound DMs** in `#telos-life`. The container saw the `<reminder>` XML, found no matching tick-prompt or addendum rule, and chose silence (or `do_nothing`). The phase split is now explicit: Phase 5 = pipe-in (laptop → host scheduler → inbox), content seeding = pipe-out (addendum teaches Telos how to surface a reminder). Tomorrow at 6pm PT, real `R-001` (movie reminder) is the natural test. If it stays silent, patch `groups/telos-life/CLAUDE.local.md` with a `<reminder>` handler: surface title + body via Discord DM, suggest action, distinguish once-shot ack vs recurring nudge.

**L9 — Surgical host deploy avoids a dirty repo block.**
Mini's `~/telos` had an unrelated uncommitted prompt edit (`groups/telos/tick-midday-prompt.md`) that blocked `git pull --rebase`. Instead of stashing or asking the user to clean up, the deploy used:
```
git -C ~/telos fetch origin                  # safe, no working-tree changes
git -C ~/telos show origin/main:launchd/com.guya.reminder-fire.plist \
  | sed substitution > ~/Library/LaunchAgents/com.guya.reminder-fire.plist
```
The plist's permanent home is `~/Library/LaunchAgents/`, not the repo. The repo template was used as a *source* via `git show`, never checked out. Generalizes: any host-only deploy artifact doesn't need the source repo to be clean — fetch + show + redirect is the move. Worktree state preserved verbatim.

**L10 — Constantia's post-commit hook pushes automatically, so an explicit `git push` from the same session is a no-op.**
After committing on mini (`git commit ...`), the constantia post-commit hook ran and pushed. The subsequent explicit `git push` returned `Everything up-to-date`. Not a bug, just an idiom worth recognizing — without context, "Everything up-to-date" right after a fresh commit reads like a failure. Verification: `git log --oneline -3` showed both my commit AND the hook's MANIFEST regen commit, both on origin.

**L11 — Script's own commit-and-push (for once-shot status flip) worked end-to-end on first try.**
`b384891 fire(reminder): R-002` was the script's batched commit at end of fire run. It pushed cleanly via the same Phase 3 L1 rebase-guarded hook path. Validates that the batched-commit pattern in `check_reminders.sh` (lines 297-313) is wire-compatible with Telos's `commitAndPush` helper semantics — same rebase-with-autostash + push-and-warn flow. Phase 3 L1 fix is still holding 2 days later.

### Anti-rot watches added by Phase 5

- **Tomorrow 5/12 18:00 PT — real R-001 fires.** If `#telos-life` stays silent, the content gap is confirmed and `<reminder>` handler should be added to LIFE addendum.
- **Sidecar corruption recovery is one-way** — if `last_fired.json` ever resets due to corruption, every active cron R-file fires once in the next minute (false positive burst). Acceptable but worth watching the log for unexpected `WARN sidecar JSON corrupt — resetting` lines.
- **`R-003` is `status: retired` not deleted** — left in the repo as a known-good test artifact. If R-IDs become a contention point, archive it.

### Candidates for ADR-019

The L1-L11 set now spans 11 silent-rot variants across Phases 3-5. Three structural buckets:
1. **Routing/auth/runtime tier** (L1-L5 from Phase 3)
2. **Spawn/state tier** (L6-L7 from Phase 4)
3. **Content/contract tier** (L8 from Phase 5 — infra ships fine but the recipient agent doesn't have a contract for the new message type)

L9-L11 are operational rather than silent-rot: L9 is a deploy pattern, L10 is an idiom-to-recognize, L11 is a positive confirmation. Probably not ADR-worthy themselves but worth captioning in the meta-pattern.

## Known limitations (v1)

- Cron subset: `*`, `N`, `N-M`, `N,M,...`, `*/N`. No `@hourly` aliases, no day-of-week names (`MON`, `TUE`...). If you need them, extend `cron_atom_match` in the script.
- One-shot in the past at script start fires immediately (intended — `now >= schedule_at`).
- Sidecar is local-only; if mini is restored from a backup that's older than the last fire, the script may double-fire that minute. Acceptable for v1.
- No retry on sqlite3 failure. If `inbound.db` is locked by the nanoclaw process for >tick, fire is dropped silently. Belt-and-suspenders: launchd will fire again in 60s; cron reminders will pick up next match.
- Title and body are XML-escaped (`&`, `<`, `>`); attribute values also escape `"` and `'`. Content containing `]]>` is technically still problematic but unlikely.
