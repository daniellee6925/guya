---
name: guya-audit
description: Full-codebase rot audit for the CURRENT repo — holds the code to the repo's own written standards, then files GitHub issues for everything found. Runs unattended (overnight) and produces the same report every time on unchanged code. Use whenever Daniel says "audit this repo", "what's rotting", "check the codebase", "find all the issues", "file issues for what's broken", or wants an agent-built codebase held to standard. Prefer this over ad-hoc review prompts for whole-repo sweeps; use /guya-review for a single diff and /guya-architecture for interactive design work.
argument-hint: "[--dry-run] [path or subdirectory to limit scope]"
---

# Codebase Rot Audit

Sweeps the current repo, measures it against the standards the repo itself declares, and files a GitHub issue per finding.

Built for one job: **agent-built codebases rot, and the rot is invisible until someone reads everything.** Nobody reads everything. This does, on a fixed checklist, so two runs a month apart are comparable.

## The Rule That Makes This Work

**Same code in, same report out.**

That is the whole product. An ad-hoc "review this repo" prompt samples different files, applies thresholds inconsistently, and phrases findings differently each run — so you cannot tell whether the codebase changed or the reviewer did. Every design choice below exists to remove that variance.

Which means:
- Anything mechanically checkable is checked by a **script**, never by judgment.
- The file set and traversal order are **fixed and sorted**, never "whatever looked interesting."
- Every finding carries a **stable fingerprint** so re-runs recognise what they already filed.
- The checklist is **closed**. Do not improvise extra checks mid-run — an ad-hoc check found in run 3 but not run 2 recreates the exact problem this replaces. If a check is missing, add it to the skill, don't sneak it into one run.

## Marker Management (MANDATORY — before anything else)

Create `.guya/decisions/` if needed and write `.guya/decisions/.harness-active`:

    {"type": "audit", "started_at": "<current ISO8601 timestamp>"}

Long unattended runs trip Guya's UserPromptSubmit hooks otherwise. Remove it (`rm .guya/decisions/.harness-active`) when the run finishes, aborts, or fails. It auto-expires after 2 hours.

## Step 0 — Preflight

Stop and report rather than guessing if any of these fail:

1. **Git repo?** `git rev-parse --show-toplevel`. Everything is scoped to that root.
2. **Clean tree?** `git status --porcelain`. Uncommitted work means findings mix your in-progress edits with real rot. Warn and continue; do not stash anything.
3. **`gh` ready?** `gh auth status` and `git remote get-url origin`. If there's no remote or no auth, switch to dry-run and say so — never silently skip filing.
4. **Which repo?** Print the resolved `owner/name`. Issues are permanent and public to your collaborators; confirming the target out loud is cheap insurance against filing into the wrong project.

If `--dry-run` was passed, do everything except create issues, and write the report to stdout instead.

## Step 1 — Load the Repo's Standards

Read, in this order, whatever exists:

1. `.guya/pre-commit-config.json` — numeric limits (`maxFileLOC`, `maxFunctionLines`, cleanup markers). Already the gate's source of truth; reusing it means the audit and the gate can never disagree.
2. `CLAUDE.md` (repo root) — the project's written rules.
3. `ARCHITECTURE.md` — module boundaries and the decision log.
4. `context/core-beliefs.md` — hard invariants, if present.

**Audit against what the repo declares, not against your own taste.** A finding you cannot trace to a written rule is an opinion, and opinions are what make reports vary. If the repo declares no standards at all, say so and fall back to the global LOD rules — but report that gap as its own finding, because an agent-built repo with no written standard will rot with nothing to measure against.

## Step 2 — Mechanical Pass (deterministic, no judgment)

Run the bundled scanner:

    node <skill-dir>/scripts/scan-standards.mjs "$(git rev-parse --show-toplevel)"

It emits JSON findings on stdout and a summary on stderr. It checks file length, function length, leftover debug markers, missing calling specs, and missing test files — all pure functions of the file bytes, sorted, with line-number-free fingerprints.

Take its output as-is. Do not re-judge, re-rank, or filter its findings; that reintroduces the variance the script exists to remove. If a check is systematically wrong, fix the script.

## Step 3 — Judgment Pass (lenses, fixed order)

The scanner cannot see design problems. This pass can, but it is the variable half, so constrain it hard.

**Scope.** Take the scanner's file list. Sort it. Process in batches of ~15 files, in order. Never sample, never "focus on what looks interesting" — the point is coverage you can rely on.

**Lenses.** Apply exactly these, in this order, to every batch. They mirror the review skills so the audit and the pre-commit gate look for the same things:

1. **Correctness** (from `guya-review`) — silent errors, unhandled edge cases, race conditions, security.
2. **Depth** (from `guya-deep-review`) — logic errors, state leaks, data integrity, observability gaps, boundary behavior.
3. **Structure** (from `guya-architecture`) — shallow modules whose interface costs as much as their implementation, duplicated logic across files, abstractions with one caller, tangled dependencies.

For large repos, run batches as parallel subagents with an identical prompt per batch. Identical prompts and fixed batching are what keep the run reproducible; a subagent that gets a different prompt produces a different report.

**Every judgment finding must name the standard it violates and the file it lives in.** No file anchor means it cannot be deduped, fixed, or verified — drop it.

## Step 4 — Dedupe Against Open Issues

Fetch what's already filed:

    gh issue list --label guya-audit --state open --limit 500 --json number,title,body

Each issue body carries a `guya-audit-id`. Match new findings against those IDs.

- **Already open** → skip silently. Do not comment "still present"; a nightly run would turn every issue into a wall of noise.
- **New** → file it.
- **Previously filed, now absent** → the fix landed. Close it with a one-line note. This is what keeps the tracker honest over months, and it is the payoff for fingerprinting rather than re-filing.

Fingerprints deliberately exclude line numbers. A problem that moved down 12 lines is the same problem.

## Step 5 — File Issues

One issue per finding, except **mechanical findings of the same check type get grouped into one issue per check** (all `missing-test` findings in one issue, all `leftover-marker` in another). Thirty near-identical issues is a tracker nobody reads, and the fixer batches them anyway.

Label every issue `guya-audit`, plus `mechanical` or `judgment`.

**Body format — this is a contract with `/guya-resolve`, not decoration.** It must be machine-readable or the fixer cannot act:

```markdown
<!-- guya-audit
id: <fingerprint, or comma-separated list when grouped>
check: <check-id>
class: mechanical | judgment
files: <repo-relative path(s)>
-->

## What
<one sentence: the specific defect>

## Standard violated
<quote the rule, and where it is written — "CLAUDE.md: max file size 800 LOC">

## Where
- `path/to/file.py` — <symbol or region, not a bare line number>

## Acceptance criteria
- [ ] <objectively checkable statement of done>

## Suggested test
<the test that should fail before the fix and pass after; "none — mechanical" if not applicable>
```

The acceptance criteria and suggested test are the load-bearing fields. `/guya-resolve` writes the failing test first, so an issue without a testable statement of done is an issue it must skip.

## Step 6 — Report

Print, and save to `.guya/audits/YYYY-MM-DD-audit.md`:

- Repo, commit SHA audited, file count scanned
- Findings by check, mechanical vs judgment
- Issues created, skipped as duplicates, closed as fixed
- Anything that failed (unreadable files, `gh` errors) — **never** let a partial run look like a clean one

Then remove the harness marker.

## Verifying It Actually Works

The acceptance test for this skill is not "did it find bugs." It is:

    # on an unchanged repo
    node scripts/scan-standards.mjs "$REPO" > /tmp/a.json
    node scripts/scan-standards.mjs "$REPO" > /tmp/b.json
    diff /tmp/a.json /tmp/b.json   # must be empty

If that ever differs, the mechanical half is broken and the skill has stopped solving the problem it exists for.

The judgment half cannot be byte-stable — it is a model. Fixed batching, fixed lens order, identical prompts, and fingerprint dedup are what keep it *practically* stable: phrasing may drift, but the same problem resolves to the same issue instead of a new one.

## What This Skill Does Not Do

- **Does not fix anything.** Filing is the whole job. `/guya-resolve` does the fixing, and keeping them separate is what lets you read the findings before code changes.
- **Does not scan multiple repos.** It audits the repo you invoke it in. Run it again elsewhere.
- **Does not invent standards.** No written rule, no finding.
- **Does not touch git state.** No stashing, no branching, no commits.
