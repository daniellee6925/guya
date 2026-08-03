#!/usr/bin/env bash
# sync-plugin.sh — Sync guya-plugin source → Claude Code plugin cache
#
# Run automatically via post-commit hook, or manually:
#   bash scripts/sync-plugin.sh
#
# Why: Claude Code runs hooks from the plugin cache, not from source. When the
# cache is a static COPY, edits to guya-plugin/ are invisible until synced.
#
# ADR-028: the install is now a SYMLINK to source, so there is nothing to sync
# and this script no-ops. It stays because a plugin reinstall through the
# /plugin UI can replace the symlink with a real copy — at which point syncing
# silently starts mattering again. Deleting the script would make that
# regression invisible; keeping it makes the recovery automatic.
#
# Note this only ever ran on post-commit, so even in copy mode it never covered
# mid-session edits — those still needed a manual copy to take effect.

set -euo pipefail

command -v rsync >/dev/null 2>&1 || { echo "sync-plugin: rsync not found — install it first" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/guya-plugin"
CACHE_BASE="$HOME/.claude/plugins/cache/guya/guya"

# Find the installed version directory (e.g. 0.1.0/, or a 0.2.0 -> source symlink)
if [ ! -d "$CACHE_BASE" ]; then
  echo "sync-plugin: cache not found at $CACHE_BASE — is the guya plugin installed?" >&2
  exit 1
fi

# `-type l` matters: the current install is a symlink, and a `-type d`-only
# search skips it and silently selects an older, unread copy directory instead —
# which is exactly what happened after ADR-028 landed (every commit dutifully
# synced to 0.1.0 while the runtime read 0.2.0).
VERSION_DIR=$(find "$CACHE_BASE" -mindepth 1 -maxdepth 1 \( -type d -o -type l \) \
  | xargs -I{} basename {} | sort -V | tail -1)

if [ -z "$VERSION_DIR" ]; then
  echo "sync-plugin: no version directory found under $CACHE_BASE" >&2
  exit 1
fi

DEST="$CACHE_BASE/$VERSION_DIR"

# Symlinked install (ADR-028) — source IS the runtime, nothing to copy.
# Guard before rsync, not just as an optimization: `rsync -a --delete` with
# src and dest resolving to the same tree is a destructive no-op at best.
if [ -L "$DEST" ]; then
  # A DANGLING symlink is the dangerous case: the plugin is entirely broken
  # (Claude Code resolves installPath to nothing, so no hooks and no skills
  # load) while a naive `-L` check happily reports "already live". That is the
  # silent-rot pattern this repo keeps getting bitten by, so fail loud instead.
  # `-d` follows the link, so it is false exactly when the target is missing —
  # e.g. after the guya repo is moved or renamed.
  if [ ! -d "$DEST" ]; then
    echo "sync-plugin: $DEST is a BROKEN symlink → $(readlink "$DEST" 2>/dev/null || echo '?')" >&2
    echo "sync-plugin: the guya plugin cannot load. Re-point the symlink at the repo, or restore a real copy." >&2
    exit 1
  fi
  echo "sync-plugin: $DEST is a symlink to source (ADR-028) — already live, nothing to sync"
  exit 0
fi

# Sync — exclude test files and dev-only state dirs
rsync -a --delete \
  --exclude='__tests__/' \
  --exclude='.guya/' \
  --exclude='.omc/' \
  --exclude='node_modules/' \
  "$SRC/" "$DEST/"

echo "sync-plugin: synced guya-plugin → $DEST"
