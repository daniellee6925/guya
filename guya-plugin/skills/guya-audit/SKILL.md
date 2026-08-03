---
name: guya-audit
description: Full-codebase rot audit for the CURRENT repo — a deterministic standards scanner plus a fan-out of 16 parallel agents, each hunting one orthogonal failure mode (duplication & convention drift, config & environment coupling, silent failure, idempotency & re-run safety, growth & cost of change, dead weight, persistence & schema evolution, doc drift, error paths, observability, contracts, state, test integrity, data integrity, concurrency, trust) — then files GitHub issues for everything found. Runs unattended (overnight) and produces the same report every time on unchanged code. Use whenever Daniel says "audit this repo", "what's rotting", "check the codebase", "find all the issues", "file issues for what's broken", or wants an agent-built codebase held to standard. Prefer this over ad-hoc review prompts for whole-repo sweeps; use /guya-review for a single diff and /guya-architecture for interactive design work.
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

## Step 3 — Judgment Pass (one agent per angle, fanned out)

The scanner cannot see design problems. This pass can — and **fan-out across distinct angles is the mechanism, not an optimization for large repos.**

One agent asked to "find issues" returns whatever it noticed first and calls it done. Ten agents asked the same thing return ten overlapping versions of the same shallow list. What actually surfaces real problems is *orthogonal* lenses: each agent hunting one specific failure mode, blind to what the others are looking for, so nobody's attention is diluted and nothing is left to "somebody else probably caught that."

### The angles

Apply **every** angle, one agent each. The list is closed — do not improvise an extra angle mid-run, and do not skip one because it "probably won't find anything." A run that varies its angle set is the ad-hoc prompt you are replacing.

Each angle says what it owns *and what it must not report*. The exclusions matter as much as the inclusions: overlapping agents produce duplicate findings that survive dedup because they are phrased differently.

The selection principle: **an audit hunts what you cannot notice by using the system.** Slowness, crashes, and wrong output announce themselves — you go look without being told. Duplication, a mechanism that quietly stopped running, and code that costs a week to extend stay invisible until they are expensive. Weight the angle set toward the invisible half.

Listed in rough order of expected yield on an agent-built codebase. **Exclusions reference angles by name, never by number** — numbers shift whenever the list is reordered, and a stale "see angle N" turns an exclusion into noise.

| # | Angle | Hunts for | Must NOT report |
|---|-------|-----------|-----------------|
| 1 | **Duplication & convention drift** | The same logic implemented more than once; near-identical helpers in different modules; the same *concept* handled a different way in each place it appears — error style, config access, naming, validation | Style/formatting alone; duplicated *values* (→ Config & environment coupling); anything with a single implementation |
| 2 | **Config & environment coupling** | The same fact written in more than one place and required to agree; hardcoded paths, hosts and machine assumptions; code defaults that disagree with config-file defaults; knowledge of *where things live* duplicated across scripts | Duplicated *logic* (→ Duplication & convention drift); unvalidated config input (→ Trust & input) |
| 3 | **Silent failure** | Code that can stop working with nothing surfaced: guards that always pass, handlers registered but never invoked, `main()` never reached, retries swallowing the final error, flags stuck in a default nobody checks | Failures you DO learn about but cannot explain (→ Observability & diagnosability); a failure branch that exists but behaves wrongly (→ Error paths) |
| 4 | **Idempotency & re-run safety** | Operations that corrupt or duplicate when run twice; missing markers or guards on anything that can fire more than once; retries that are not safe to retry; partial runs that cannot resume cleanly | Two things racing at the same instant (→ Concurrency & ordering) |
| 5 | **Growth & cost of change** | What it costs to make this program bigger. Adding one feature: how many files must change, how much must be understood first, does the abstraction fight you? Then growth in data/load: unbounded structures, algorithmic complexity that is fine now and fatal later, work recomputed per item | Micro-optimizations with no observable effect; slowness already visible in normal use |
| 6 | **Dead weight & abandoned scaffolding** | Unreachable branches, unused exports, abstractions with exactly one caller, config nothing reads, half-built approaches left in place when the next attempt landed | Duplication (→ Duplication & convention drift); untested code (→ Test integrity) |
| 7 | **Persistence & schema evolution** | Code reading data written by an older version; format changes with no migration path; on-disk shapes no test covers; version fields that exist but are never checked; writes that can leave a half-written file behind | In-memory data handling (→ Data integrity) |
| 8 | **Doc/code divergence** | Comments, docstrings, READMEs and calling specs describing behavior the code no longer has | Absent docs — that is `missing-calling-spec` from the scanner |
| 9 | **Error paths** | Swallowed exceptions, bare catches, errors that lose context, cleanup that only runs on success, fail-open where it must fail-closed, irreversible operations (delete, overwrite, force-push) with no backup or confirmation | Something that never ran at all (→ Silent failure) |
| 10 | **Observability & diagnosability** | Failures you know happened but cannot explain: log lines with no context, errors that drop the input that caused them, no way to tell which of several paths ran, long operations with no progress signal, unattended jobs whose only record is an exit code | Failures nothing surfaces at all (→ Silent failure) |
| 11 | **Contracts & boundaries** | What a module promises vs what it does; callers relying on undocumented behavior; return shapes that vary by path; shallow modules whose interface costs as much as their body | Internal logic bugs (→ Error paths, State & lifecycle) |
| 12 | **State & lifecycle** | Mutable state shared across calls, init/teardown asymmetry, caches with no eviction, module-level mutable singletons, resources not released on every path | Concurrency specifically (→ Concurrency & ordering); on-disk state (→ Persistence & schema evolution) |
| 13 | **Test integrity** | Tests asserting nothing meaningful, happy-path-only coverage, tests that would still pass if the feature were deleted, known bugs with no regression pin | Missing test *files* — the scanner already reports those |
| 14 | **Data integrity** | Non-atomic writes, in-place mutation where a copy was intended, unchecked assumptions about sortedness/uniqueness/non-null, lossy conversions | Input arriving from outside (→ Trust & input); on-disk format changes (→ Persistence & schema evolution) |
| 15 | **Concurrency & ordering** | Races, `await` in a loop assuming stable state, unguarded shared writes, ordering assumptions between async steps | Single-threaded state issues (→ State & lifecycle); sequential re-runs (→ Idempotency & re-run safety) |
| 16 | **Trust & input** | Unvalidated external input — including content authored elsewhere that an agent will later act on, such as issue bodies and fetched pages; injection into shell, SQL or prompts; secrets in logs or serialized objects; permissive defaults | Internal data handling (→ Data integrity) |

**Why the top of the list looks like this.** The first eight target how *agent-built, self-running* code rots specifically. Each session re-solves a solved problem its own way, hardcodes a fact that already lives somewhere else, leaves a half-built approach behind, edits code without touching the prose above it, and adds a mechanism nobody ever confirms is still firing. Those out-produce classic bug-hunting on this kind of codebase, which is why they run first.

**Silent failure** exists because this project has documented the same defect three times — ADR-011 (evolve auto-fire dead six days), ADR-012 (review gate bypassed sixteen days), ADR-013 (five hooks whose `main()` never ran). Every one was a trusted mechanism that stopped working with no symptom.

**Idempotency** and **Persistence** exist because these systems run themselves. Ticks, crons and agents re-fire constantly, and almost everything here keeps state on disk. A non-idempotent operation that gets retried corrupts quietly; a format change with no migration passes every test until the day it reads old data.

**Observability** is deliberately narrow, and its boundary with Silent failure is the difference between *you never find out* and *you find out but cannot tell why*. Both agents will be tempted by the same code; the exclusions in both rows are what keep them from filing the same finding twice.

**Concurrency** and **Trust & input** are repo-dependent — a dashboard or a docs repo will score zero on both, and that is a correct result, not a broken agent. The report prints zeros for exactly this reason: a zero that *changed* is the signal, not a zero itself.

### Fan-out

Take the scanner's file list — already sorted, already excluding vendored trees.

- **≤ 60 files:** one agent per angle, each given the whole inventory. 16 agents.
- **> 60 files:** split into deterministic shards of 60 (sorted order, fixed size, so shard boundaries are identical every run). Run **angle by angle**, shards within an angle in parallel, at most ~8 concurrent agents.

Total agents is `16 × ceil(files / 60)`, so a 780-file repo is ~208 agents at 8 concurrent — on the order of half an hour. That is fine for an overnight run and absurd for an interactive one. **State the projected agent count before starting** and, if the run was invoked interactively rather than on a schedule, say so and offer `--dry-run` or a scoped path instead. Nobody should discover the scale of this by watching it.

Every agent gets an **identical prompt template**, varying only in the angle definition and its file list. This is load-bearing for reproducibility: a subagent handed a bespoke prompt produces a bespoke report, and the run stops being comparable to the last one.

Also hand every agent the mechanical findings from Step 2, with the instruction: **do not re-report these.** Otherwise eleven agents each independently rediscover the same oversized file.

### What each agent returns

Structured findings only, one JSON object per finding:

```json
{"angle": 4, "file": "src/auth.py", "anchor": "refresh_token",
 "what": "one sentence", "why": "the concrete failure it causes",
 "standard": "the written rule or invariant it violates",
 "acceptance": "objectively checkable statement of done",
 "test": "the test that should fail before a fix"}
```

**A finding with no `file` and `anchor` is dropped.** It cannot be fingerprinted, deduped, assigned, or verified — and an un-anchored complaint is exactly the vague output this skill exists to replace. Same for a finding with no `acceptance`: `/guya-resolve` will skip it, so filing it just grows the backlog.

Fingerprint each with the same scheme as the scanner — `(angle-id, file, anchor)`, never line numbers.

## Step 4 — Dedupe Against Open Issues

Fetch what's already filed:

    gh issue list --label guya-audit --state open --limit 500 --json number,title,body

Each issue body carries a `guya-audit-id`. Match new findings against those IDs.

- **Already open** → skip silently. Do not comment "still present"; a nightly run would turn every issue into a wall of noise.
- **New** → file it.
- **Previously filed, now absent** → the fix landed. Close it with a one-line note. This is what keeps the tracker honest over months, and it is the payoff for fingerprinting rather than re-filing.

Fingerprints deliberately exclude line numbers. A problem that moved down 12 lines is the same problem.

## Step 5 — File Issues (via `/guya-issue` batch mode)

**Do not hand-roll `gh issue create` here.** `/guya-issue` already owns issue filing — preflight checks, body structure, label caution, URL capture. Duplicating that logic means two places to fix when GitHub or the conventions change, and they will drift.

Invoke `/guya-issue` in **batch mode** (see its "Batch Mode" section). That mode exists for exactly this caller: it swaps the interactive per-issue approval for the audit's own preconditions — an explicit invocation, a dedup pass already run, and `guya-audit` labelling — while keeping the shared body format.

One issue per finding, except **mechanical findings of the same check type get grouped into one issue per check** (all `missing-test` in one, all `leftover-marker` in another). Thirty near-identical issues is a tracker nobody reads, and `/guya-resolve` batches them anyway.

Label every issue `guya-audit`, plus `mechanical` or `judgment`.

**Body format — this is a contract with `/guya-resolve`, not decoration.** It extends `/guya-issue`'s standard sections with a machine-readable header, and the fixer cannot act without it:

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

- Repo, commit SHA audited, file count scanned, shard count
- Mechanical findings by check
- **Judgment findings by angle — all 16 listed, including the zeros.** An angle that returns nothing is either genuinely clean or quietly broken, and those look identical unless the zero is printed. An angle that reports zero on a repo where it scored last month is the signal that something in the fan-out stopped working.
- Agents spawned vs agents that returned; any that failed
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

The judgment half cannot be byte-stable — it is a model. Four things keep it *practically* stable, and all four are load-bearing:

- **A closed angle set.** Eleven angles, every run. Adding one ad-hoc mid-run is how the reports start diverging again.
- **Deterministic sharding.** Sorted file list, fixed shard size, so shard boundaries are identical between runs.
- **Identical prompt templates.** Only the angle definition and file list vary.
- **Fingerprint dedup.** Phrasing drifts between runs; `(angle, file, anchor)` does not. The same problem resolves to the same issue rather than a new one.

The cheapest way to notice this half has broken is the per-angle counts in the report. Compare against the previous `.guya/audits/` entry: a angle that went from twelve findings to zero on barely-changed code did not get fixed, it stopped running.

## What This Skill Does Not Do

- **Does not fix anything.** Filing is the whole job. `/guya-resolve` does the fixing, and keeping them separate is what lets you read the findings before code changes.
- **Does not scan multiple repos.** It audits the repo you invoke it in. Run it again elsewhere.
- **Does not invent standards.** No written rule, no finding.
- **Does not touch git state.** No stashing, no branching, no commits.
