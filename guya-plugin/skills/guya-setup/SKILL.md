---
name: guya-setup
description: Install Guya git hooks into the current repo. Run once in any guya-enabled repo to get post-commit scribe and pre-commit review. Use when asked "guya setup", "install guya hooks", "set up guya here".
---

# Guya Setup

Install Guya's git hooks into the current repo's `.git/hooks/` directory.

## When This Triggers

- User says "guya setup", "install guya hooks", "set up guya in this repo", "add guya hooks here"

## What To Do

### Step 1 — Verify this is a git repo

```bash
git rev-parse --show-toplevel
```

If this fails, stop and tell the user: "This directory isn't a git repo. Run `git init` first."

Store the output as REPO_ROOT.

### Step 2 — Check existing post-commit hook

```bash
cat "$REPO_ROOT/.git/hooks/post-commit" 2>/dev/null || echo "NONE"
```

- If output contains `guya-post-commit-scribe` → already installed. Skip Step 3, report "already installed".
- If output is `NONE` → write fresh hook (Step 3a).
- If output has other content → append guya block (Step 3b).

### Step 3a — Write fresh post-commit hook

Write this exact content to `$REPO_ROOT/.git/hooks/post-commit`:

```bash
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
```

Then make it executable:
```bash
chmod +x "$REPO_ROOT/.git/hooks/post-commit"
```

### Step 3b — Append to existing post-commit hook

Append the guya block (from Step 3a, minus the shebang line) to the end of the existing hook. Then `chmod +x`.

### Step 4 — Verify

```bash
cat "$REPO_ROOT/.git/hooks/post-commit"
```

Confirm the scribe block is present.

### Step 5 — Report

Tell the user:
- What was done (fresh install / appended / already present)
- That the scribe will now auto-log commits to `STATUS.md` after every `git commit`
- Reminder: the hook only activates if `.guya/` exists in the repo root
