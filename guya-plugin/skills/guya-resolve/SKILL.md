---
name: guya-resolve
description: Works through open guya-audit GitHub issues in the CURRENT repo and fixes them autonomously — failing test first, then the fix, through the full review/deep-review/optimize gate, one PR per issue. Built to run unattended overnight and leave reviewable PRs plus a morning summary. Use when Daniel says "fix the issues", "work the backlog", "resolve the audit findings", "clear the issues overnight", or points at issues filed by /guya-audit. Use /guya-decision-bugfix instead for a single live bug he is describing to you directly.
argument-hint: "[--dry-run] [--max N] [issue numbers to limit to]"
---

# Autonomous Issue Resolution

Picks up open `guya-audit` issues, fixes them under TDD, and leaves one reviewable PR per unit of work.

Runs while Daniel is asleep. That single fact drives every rule here: **nobody is available to answer a question, so anything that needs an answer must be skipped, not guessed.** A wrong guess at 3am becomes a plausible-looking PR that costs more to review than it saved.

## Marker Management (MANDATORY — before anything else)

Write `.guya/decisions/.harness-active`:

    {"type": "resolve", "started_at": "<current ISO8601 timestamp>"}

Remove it when the run ends, aborts, or fails irrecoverably. Auto-expires after 2 hours.

## Step 0 — Preflight

Abort with a clear reason rather than proceeding on a bad footing:

1. **Clean tree.** `git status --porcelain` must be empty. Uncommitted work would ride along into PRs. Do not stash it — stop and say so.
2. **Know the base branch.** `git rev-parse --abbrev-ref HEAD`. Every branch is cut from it and every PR targets it. Never commit to it directly.
3. **`gh` authenticated**, remote resolves, and you can list issues.
4. **Tests run at all.** Find and execute the suite once (`pytest`, `npm test`, `node --test`, per the repo). If the suite is already red before you touch anything, stop — you cannot use "tests pass" as a signal when it was never true. Report the pre-existing failure as the run's finding.

## Step 1 — Select and Order Work

    gh issue list --label guya-audit --state open --limit 200 --json number,title,body,labels

Parse the `<!-- guya-audit ... -->` block in each body (the contract `/guya-audit` writes: `id`, `check`, `class`, `files`).

Order the queue:

1. **Mechanical, grouped by check type.** All `leftover-marker` work is one unit. All `missing-test` work is one unit. These are repetitive and low-risk, and batching them by category is deliberate: thirty separate dead-code PRs is worse to review than one, and **review bandwidth is the binding constraint here, not compute.**
2. **Judgment, one issue at a time.** Higher risk, needs isolation so a bad one reverts cleanly.

Respect `--max N` if given. Otherwise work the whole queue.

## Step 2 — The Skip Rule

Skip an issue when **any** of these is true. Skipping is a success, not a failure — an honest skip costs one line in the summary, while a guessed answer costs a review cycle and possibly a bad merge.

- The issue has no **acceptance criteria**, or none that can be expressed as a test.
- The fix requires **choosing between valid alternatives** (which pattern, which boundary, which trade-off). That is Daniel's call.
- The fix changes a **public interface, on-disk format, or observable behavior**. Callers you cannot see may depend on it.
- The fix needs **credentials, network services, or infrastructure** you cannot reach.
- The fix would touch **more than ~10 files** or cross module boundaries. Blast radius too wide to verify unattended.
- The issue text contains an **open question** or hedge ("should we", "maybe", "unclear whether").
- You attempted it and the **test would not go green in two honest tries**. Do not loosen the test to make it pass. That converts a real defect into a false all-clear, which is worse than leaving the bug.

For each skip, record the issue number and the specific reason. Comment the reason on the issue so it is visible from GitHub, then move on.

## Step 3 — Fix One Unit of Work

For each unit that survived the skip rule:

### 3a. Branch

    git checkout -b guya-resolve/<issue-number>-<short-slug>

Always from the base branch, never from the previous unit's branch — otherwise PR #2 contains PR #1's changes and neither can be merged independently.

### 3b. Write the failing test FIRST

This is not ceremony. It is the only mechanism that makes unattended work verifiable: a test that fails before and passes after is objective evidence the fix does something, and it is the one signal an agent cannot talk itself into.

1. Write the test from the issue's **Acceptance criteria** and **Suggested test**.
2. Run it. **Confirm it fails, and capture the failure output verbatim** — it goes in the PR body as proof the test actually exercises the defect.
3. A test that passes before the fix is testing the wrong thing. Rewrite it. If you cannot make it fail, the issue is not reproducible: skip per Step 2 and say so.

For mechanical work where a unit test makes no sense (deleting dead code, splitting an oversized file), the equivalent evidence is: the full suite green before, and green after, with the mechanical check now passing. Re-run `scan-standards.mjs` and show the finding count dropping.

### 3c. Fix

Smallest change that turns the test green. Resist adjacent improvements — an unattended PR that also refactors something else is one nobody can review with confidence.

### 3d. Run the gate, in order

The pre-commit gate (ADR-027) requires three passes, and it enforces ordering, not just presence:

1. `/guya-review`
2. `/guya-deep-review`
3. `/guya-optimize`

Run them against the staged change, in that order, after staging and before committing. Re-running an earlier pass resets the chain, so fix findings as they come rather than looping back.

**`/guya-optimize` is report-only, and at 3am there is nobody to weigh its trade-offs.** Do not act on its findings and do not silently accept them. **Paste its full output into the PR body** under `## Optimize findings (unreviewed)`. That converts a rubber stamp into a decision waiting for Daniel — which is what a report-only pass should always have been.

### 3e. Commit and open the PR

Commit as you go within the branch; each commit should leave the suite green.

    gh pr create --title "<type>(<scope>): <what>" --body "<body below>" --base <base-branch>

PR body:

```markdown
Closes #<issue-number>

## What changed
<one paragraph>

## Test evidence
**Before the fix** (test fails as expected):
```
<verbatim failure output>
```
**After the fix:**
```
<verbatim pass output>
```

## Full suite
<pass/fail counts before and after>

## Optimize findings (unreviewed)
<verbatim /guya-optimize output — Daniel's call, not applied>

---
🤖 Autonomous fix via /guya-resolve. Test written before the fix.
```

Then return to the base branch before starting the next unit.

## Step 4 — Failure Handling

**One failing unit must never end the run.** On any error — test won't go green, gate blocks, `gh` fails, merge conflict:

1. Record what failed and why.
2. `git checkout <base-branch>` and leave the branch in place for inspection. Do not force-push and do not delete it.
3. Continue to the next unit.

Never `--no-verify`, never weaken a test, never close an issue you did not actually fix.

## Step 5 — Morning Summary

Print, and save to `.guya/audits/YYYY-MM-DD-resolve.md`:

- **PRs opened** — number, issue, one-line description
- **Skipped** — issue number and the specific reason, grouped by reason. This is the most important section: it is Daniel's queue for the morning, and the reasons tell him whether the audit is filing unactionable issues.
- **Failed** — what broke, which branch to look at
- **Suite status** at the start and end of the run
- **Anything still open** if `--max` cut the queue short

Then remove the harness marker.

State the numbers plainly. "12 issues, 5 PRs, 6 skipped, 1 failed" is the summary; a run that quietly attempted three things and reports success is the failure mode to avoid.

## What This Skill Does Not Do

- **Does not merge.** Every PR waits for Daniel. Unattended authorship is fine; unattended merging is not.
- **Does not push to the base branch.** Ever.
- **Does not file issues.** That is `/guya-audit`.
- **Does not fix what it cannot test.** No test, no fix — skip it.
- **Does not decide design questions.** Those are skips by definition.
