---
name: guya-pr
description: Pre-PR preparation skill. Runs a Codex fresh-eyes pass on the full diff, checks PR readiness (scope, breaking changes, migrations, documentation), verifies cross-diff consistency, and generates a PR summary. Use before submitting any PR. guya-review and guya-deep-review handle commit-level quality — this handles PR-level readiness.
argument-hint: "[branch or diff range — defaults to main...HEAD]"
---

# PR Preparation

Run before submitting a PR. Assumes guya-review and guya-deep-review have already run on all commits in this branch — this skill handles what only makes sense at the PR level: independent Codex review, readiness checks, and a PR description ready to paste.

## Step 1 — Get the Full Diff

Get the changes being submitted:

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

If a branch or range is passed as `$ARGUMENTS`, use that instead of `main...HEAD`.

## Step 2 — Codex Independent Review

A different model, fresh context, no familiarity with the code — Codex catches what Claude misses through familiarity. Run on the changed files:

```bash
git diff main...HEAD --name-only | head -5 | xargs -I{} sh -c 'echo "=== {} ===" && cat {}' | codex exec "You are a senior engineer reviewing a PR. Look for: 1) Bugs and correctness issues 2) Logic errors 3) Architectural concerns 4) Error handling gaps. Be specific with file names and line numbers. Be critical."
```

If Codex is unavailable, note it and continue.

## Step 3 — PR Readiness Checklist

Check each item. Flag anything that must be resolved before submitting.

### Scope
- Is every changed file traceable to the PR goal? Flag unintended changes.
- Are cleanup or refactoring changes mixed with feature/fix changes that should be a separate PR?

### Breaking Changes
- Do any API signatures, config formats, or behavioral contracts change?
- Are all consumers of changed interfaces updated everywhere?
- Are breaking changes explicitly documented?

### Migration Needs
- Does this require a DB migration, data migration, or config change in other environments?
- Is the migration safe to run before, during, or only after deployment?

### Test Coverage
- Are there tests for the new behavior introduced?
- Are there known gaps that should be noted in the PR description?

### Documentation
- Are changed public APIs documented?
- Does any CLAUDE.md, README, or architecture doc need updating?

### Cross-Diff Consistency
- Are naming conventions consistent across all changed files?
- Are similar patterns handled consistently (error handling, logging, validation)?
- Do changed files follow the same style as their neighbors?

## Step 4 — Generate PR Summary

Produce a description ready to paste:

```
## Summary
[1-3 bullets: what changed and why]

## Changes
[Bullet list: each changed file and what it does]

## Breaking Changes
[None / list them]

## Migration
[None / steps required]

## Test Plan
[What to verify manually + what the automated tests cover]
```

## Step 5 — Final Verdict

State clearly: **Ready to submit** or **Not ready — [specific blockers]**.

If not ready, list exactly what needs to be resolved before the PR goes up.
