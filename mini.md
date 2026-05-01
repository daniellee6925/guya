# Mac Mini — Operational Reference

> Last updated: 2026-05-01
>
> Everything needed to reach, work on, and recover access to the Mac Mini. The mini is the deployment target for Telos.

## Identity

| Field | Value |
|-------|-------|
| Hostname (mDNS) | `goms-Mac-mini.local` |
| Tailscale IP | `100.73.197.23` |
| User on the mini | `guya` |
| Client machine | `daniels-MacBook-Pro` |
| SSH alias | `mini` (from `~/.ssh/config` on the client) |

## SSH

```
ssh mini                           # interactive shell
ssh mini "command"                 # one-shot command, fresh shell each call
ssh -t mini "sudo ..."             # any sudo needs -t (tty allocation)
```

Passwordless via `ssh-copy-id`. Key on the client: `~/.ssh/id_ed25519`. Authorized on the mini: `~/.ssh/authorized_keys`.

## sshfs Mount (work on mini files locally)

```
mkdir -p ~/mini-fs
sshfs mini:/Users/guya ~/mini-fs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3
```

After mount, `~/mini-fs/` is the mini's `/Users/guya/`. Telos lives at `~/mini-fs/telos/`.

Maintenance:

```
mount | grep mini-fs               # is it mounted?
umount ~/mini-fs                   # clean unmount
```

Mount does **not** survive a reboot of the client. Re-run the `sshfs ...` line after restarting.

Stack: **FUSE-T** (userspace, no kernel extension) + sshfs binary (`/usr/local/bin/sshfs`). Installed via:

```
brew tap macos-fuse-t/homebrew-cask
brew install --cask fuse-t fuse-t-sshfs
```

## Screen Sharing (GUI)

```
open vnc://mini                    # or vnc://100.73.197.23
```

Authenticates with the mini's macOS login (user: `guya`).

## Trust Model

- **Auto-login: ON** for `guya`. Mini comes up to the desktop after reboot — Tailscale (GUI app, runs as user agent) and any LaunchAgents launch with the user session.
- **FileVault: OFF.** No disk-unlock prompt at boot. No remote lockout risk after power blip / OS update.
- **Tailscale identity = network tunnel.** Anyone with physical access to the unlocked mini has SSH-via-Tailscale into anything else on Daniel's tailnet. Acceptable for the apartment context. **Not** acceptable if the mini ever leaves the apartment — at that point, FileVault back on, auto-login off.

## Deferred Decisions

- **No LaunchAgent for sshfs auto-mount.** Bar: if remounting manually starts annoying me (more than once a week), wire up `~/Library/LaunchAgents/com.daniel.mini-sshfs.plist` with `RunAtLoad` + `KeepAlive`. Until then, manual remount is a one-line cost.
- **No `tailscaled` Homebrew/LaunchDaemon path.** Auto-login + the GUI Tailscale app is sufficient because the user session always exists. Revisit only if Telos ever needs to come up *before* any user session (e.g., Telos as a system daemon that must survive logout).
- **No tmux installed on the mini.** Premature without a long-running process to protect. Install when first long-lived Telos process lands: `brew install tmux`, then `ssh mini -t tmux new -A -s main`.
- **No second SSH alias for `goms-Mac-mini`.** `mini` is canonical. Long-name alias earns nothing.

## Recovery / Troubleshooting

**`ssh mini` hangs or times out:**

1. `ping -c 3 100.73.197.23` — does the tailnet see it?
   - **No reply** → mini is offline OR Tailscale isn't running. Open Tailscale admin (https://login.tailscale.com/admin/machines), check whether `goms-Mac-mini` shows online. If offline, the mini is asleep / off / Tailscale crashed. Last-resort fix is physical access.
   - **Reply works** → tailnet is fine, sshd is the problem. Try `vnc://mini` for GUI access; if that works too, sshd may have died (rare).
2. **System Settings → Energy** on the mini: confirm "Prevent automatic sleeping when display is off" + "Wake for network access" still on. Updates can reset these.

**sshfs mount hangs / `ls ~/mini-fs` freezes:**

```
umount -f ~/mini-fs                # force unmount
# wait a few seconds, then re-mount
```

If that hangs, kill the sshfs process: `pgrep sshfs | xargs kill -9` then unmount.

**Mini won't auto-login after reboot:**

- System Settings → Users & Groups → "Automatically log in as" → confirm `guya` is selected.
- Requires FileVault off (`fdesetup status` over SSH to verify).

## Setup Provenance

Setup completed 2026-04-30. STATUS.md and `.guya/memory/archival/guya.md` have full context.
