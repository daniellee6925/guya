#!/usr/bin/env bash
# guya — post-commit scribe (auto-logs commits to STATUS.md)

REPO_ROOT="$(git rev-parse --show-toplevel)"
[ -d "$REPO_ROOT/.guya" ] || exit 0

CACHE_BASE="$HOME/.claude/plugins/cache/guya/guya"
VERSION_DIR=$(find "$CACHE_BASE" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
  | xargs -I{} basename {} | sort -V | tail -1)
if [ -n "$VERSION_DIR" ]; then
  PLUGIN_ROOT="$CACHE_BASE/$VERSION_DIR"
  printf '{"tool_name":"Bash","tool_input":{"command":"git commit"},"cwd":"%s"}' "$REPO_ROOT" \
    | node "$PLUGIN_ROOT/hooks/run.cjs" "$PLUGIN_ROOT/hooks/guya-post-commit-scribe.mjs" \
    || true
fi
