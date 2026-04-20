---
name: guya-setup
description: Bootstrap Guya in the current repo — creates .guya/ directory tree, writes pre-commit-config.json, installs post-commit scribe and pre-commit quality hooks. Use when asked "guya setup", "install guya", "set up guya here", "bootstrap guya in this repo".
---

# Guya Setup

One-shot bootstrap for a repo. Leaves it with everything Guya needs to operate: `.guya/` directory tree, pre-commit config, and both git hooks installed.

## When This Triggers

- "guya setup", "install guya", "set up guya in this repo", "bootstrap guya here", "add guya hooks"

## Plugin Root Resolution

Resolve once at the start, referenced by every step below:

```bash
CACHE_BASE="$HOME/.claude/plugins/cache/guya/guya"
VERSION_DIR=$(find "$CACHE_BASE" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
  | xargs -I{} basename {} | sort -V | tail -1)
PLUGIN_ROOT="$CACHE_BASE/$VERSION_DIR"
TEMPLATES="$PLUGIN_ROOT/skills/guya-setup/templates"
```

If `$VERSION_DIR` is empty, stop — the plugin cache isn't populated. Tell the user to reinstall the guya plugin.

## Step 1 — Verify git repo

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
```

If empty, stop: "Not a git repo. Run `git init` first."

## Step 2 — Create `.guya/` directory tree

```bash
mkdir -p "$REPO_ROOT/.guya/memory/core" \
         "$REPO_ROOT/.guya/memory/recall" \
         "$REPO_ROOT/.guya/memory/archival" \
         "$REPO_ROOT/.guya/memory/reflections" \
         "$REPO_ROOT/.guya/evolution/traces" \
         "$REPO_ROOT/.guya/evolution/guidelines" \
         "$REPO_ROOT/.guya/decisions"
```

Safe to re-run — `mkdir -p` is idempotent.

## Step 3 — Write `pre-commit-config.json` (if missing)

```bash
if [ ! -f "$REPO_ROOT/.guya/pre-commit-config.json" ]; then
  cp "$TEMPLATES/pre-commit-config.json" "$REPO_ROOT/.guya/pre-commit-config.json"
fi
```

Don't overwrite an existing config — the user may have tuned it.

## Step 4 — Install post-commit hook (scribe)

```bash
HOOK="$REPO_ROOT/.git/hooks/post-commit"
if [ ! -f "$HOOK" ]; then
  cp "$TEMPLATES/post-commit.sh" "$HOOK"
elif ! grep -q "guya-post-commit-scribe" "$HOOK"; then
  # Append guya block to existing hook (skip shebang line)
  tail -n +2 "$TEMPLATES/post-commit.sh" >> "$HOOK"
fi
chmod +x "$HOOK"
```

The installed hook locates the Guya plugin in the cache at runtime and invokes `guya-post-commit-scribe.mjs`. It exits silently if `.guya/` is missing, so it's safe to leave in place.

## Step 5 — Install pre-commit hook (quality gate)

```bash
HOOK="$REPO_ROOT/.git/hooks/pre-commit"
if [ ! -f "$HOOK" ]; then
  cp "$TEMPLATES/pre-commit.sh" "$HOOK"
  chmod +x "$HOOK"
elif grep -q "Guya Git Pre-Commit Hook" "$HOOK"; then
  : # already ours
else
  echo "Non-Guya pre-commit hook present at $HOOK — skipping."
fi
```

If a non-guya pre-commit hook is present, do NOT overwrite. Report it and ask the user whether to back it up and replace, or leave it alone.

The pre-commit gate reads `.guya/pre-commit-config.json` and enforces: test-file existence, file/function LOC limits, and a cleanup scan for `HACK`/`FIXME`/`debugger`/`breakpoint()`/`pdb.set_trace`. Bypass with `git commit --no-verify` when needed.

## Step 6 — Verify

```bash
ls -la "$REPO_ROOT/.guya"
ls -la "$REPO_ROOT/.git/hooks/" | grep -E "(pre|post)-commit"
```

Confirm the directory tree exists, the config is present, and both hooks are executable.

## Step 7 — Report

Tell the user in one short block what changed vs what already existed:

- `.guya/` directory tree: created / already existed
- `pre-commit-config.json`: written / preserved existing
- post-commit scribe: installed / appended to existing / already present
- pre-commit quality gate: installed / already present / skipped (non-guya hook exists)

Mention that the scribe activates on every `git commit` once `.guya/` is present, and that the pre-commit gate can be bypassed with `git commit --no-verify` when necessary.
