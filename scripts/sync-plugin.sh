#!/usr/bin/env bash
# sync-plugin.sh — Sync guya-plugin source → Claude Code plugin cache
#
# Run automatically via post-commit hook, or manually:
#   bash scripts/sync-plugin.sh
#
# Why: Claude Code runs hooks from the plugin cache (a static copy), not from
# source. Without sync, edits to guya-plugin/ are invisible to the running system.

set -euo pipefail

command -v rsync >/dev/null 2>&1 || { echo "sync-plugin: rsync not found — install it first" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/guya-plugin"
CACHE_BASE="$HOME/.claude/plugins/cache/guya/guya"

# Find the installed version directory (e.g. 0.1.0/)
if [ ! -d "$CACHE_BASE" ]; then
  echo "sync-plugin: cache not found at $CACHE_BASE — is the guya plugin installed?" >&2
  exit 1
fi

VERSION_DIR=$(find "$CACHE_BASE" -mindepth 1 -maxdepth 1 -type d | xargs -I{} basename {} | sort -V | tail -1)

if [ -z "$VERSION_DIR" ]; then
  echo "sync-plugin: no version directory found under $CACHE_BASE" >&2
  exit 1
fi

DEST="$CACHE_BASE/$VERSION_DIR"

# Sync — exclude test files and dev-only state dirs
rsync -a --delete \
  --exclude='__tests__/' \
  --exclude='.guya/' \
  --exclude='.omc/' \
  --exclude='node_modules/' \
  "$SRC/" "$DEST/"

echo "sync-plugin: synced guya-plugin → $DEST"
