# Telos Content Plan — Day-2 Onward

> Date: 2026-05-12
> Status: Working plan, lives in `docs/`. Curriculum scaffolds here migrate to `constantia/tasks/learn/curricula/` when authored in earnest.

## Context

Phases 0-5 of the Telos reorg shipped infrastructure (schema, three sessions, shared MCP tools, life session, reminder firing, addendum-scoping for conversation continuity). The system is built. **What's missing is content — the substance the system was designed to operate on.**

This doc captures: (a) the canonical Day-2 content todo list, organized by gate + tranches, and (b) curriculum scaffolds for all three pillars so Telos has a structured curriculum to grade L-tasks against from day one.

---

## Pillar Definitions (canonical — from `constantia/goals/pillars.md`)

| Pillar | Definition | Served by |
|--------|------------|-----------|
| **Pillar 1: LLM Serving + Inference at Scale** | Primitives for intuition (attention, KV cache, sampling), pivot fast to production (continuous batching, quantization, speculative decoding, multi-tenant serving, cost/latency tradeoffs). | Synthetic Data Factory, TBD inference project |
| **Pillar 2: Production Agentic Systems** | Orchestration, state management across tool calls, failure modes, retry/idempotency, context management, observability for non-deterministic systems. | Guya + Telos |
| **Pillar 3: Eval Methodology** | The actuarial-lens wedge. Pass rates + confidence intervals, drift detection, shadow eval, A/B on non-deterministic systems, statistical rigor on noisy metrics. | Synthetic Data Factory, Guya + Telos (self-eval) |

**Identity:** Agentic systems architect — production-scale, reliability-first.
**North Star:** Staff-level architect role at a frontier-adjacent AI company.

---

## Content Todos

### Gate (must happen first)

- [x] **A. Pillar 1 project decision** — **LOCKED 2026-05-14: "Production Serving Cookbook."** Operator-mode (not builder-mode) project: deploy and progressively optimize a 7B model (recommended: Llama 3.1 8B Instruct) on vLLM and SGLang. 7 phases, 18 modules, ~16 weeks at 3-5 hrs/week. End state = personal serving cookbook + portfolio-grade benchmark suite. Full curriculum at [`constantia/tasks/learn/curricula/pillar-1-llm-serving.md`](../../constantia/tasks/learn/curricula/pillar-1-llm-serving.md). Pivot rationale (vs original nanoGPT-extended proposal): Daniel's stated end-state is to *operate* production inference engines (vLLM, SGLang), not to build one. Operator-mode produces direct skill match + stronger portfolio signal.

### Tranche 1 — direct content authoring (unblocks once Pillar 1 picked)

- [x] **E. Pillar 1 curriculum** REVISED 2026-05-14 (v2 at constantia commit `dc1da65`, 954 lines). At `constantia/tasks/learn/curricula/pillar-1-llm-serving.md`. Bytebytego-grade detail per module: theme + why-it-matters + reading + 6 concept-check questions + 3 application options (no effort hints) + cross-application to SDF/BosonAI + by-end-of-module markers. 20 modules across 7 phases + capstone over 16 weeks at 3-5 hrs/week. Hardware: RunPod RTX 4090 default ($0.50/hr), A100 40GB for Phases 5 + 7. Total spend: $80-150. **Pre-Phase-2 blocker: GPU access must be confirmed before Module 4 starts.** Optional capstone escalation: open-source the benchmark harness as `llm-serving-bench`.
- [ ] **D. First L-task assigned** from Pillar 1 Module 1. Sets LEARN tick's first concrete thing to grade against.
- [x] **B. Weekly schedule** SHIPPED 2026-05-14 at `constantia/goals/weekly-schedule.md` (commits `0918877` + `41c9e44`). Daily rhythm M/T/Th + Wed (WFH + 9:30-12 brunch w/ Yi+Jaewon) + Friday (rest day + 19-22 목장) + Saturday (9-13 Pillar 1 deep block) + Sunday. Workout: 6 days active (M/T/W/Th evenings 20-21, Sat/Sun 16-17, Friday REST). Planning mechanism: WORK-only, each night 22:00-22:30 → tomorrow priorities to work-Telos; Sunday night 22:00-23:00 → weekly horizon. LIFE + LEARN are reminder-driven, not scheduled.
- [~] **C. Starter R-reminders** SCOPED-DOWN 2026-05-14. Daniel's design: LIFE reminders are ad-hoc via `add_reminder`, not pre-loaded. Generic recurring nudges (workout / sleep / 매님 baseline) already covered by LIFE tick prompts + weekly schedule. Specific date-anchored one-shots (Audrey birthday, anniversary, parents' birthdays) deferred — Daniel adds when relevant.
- [~] **F. Profile scaffolds** DONE 2026-05-13 via pre-/clear synthesis. work-Telos wrote 4 patterns to `profile/cognitive|habits|strengths|weaknesses|trajectory.md` (constantia commit `227f6a8`). LIFE-Telos populated `profile/relationship.md` + `profile/health.md` during LIFE pre-/clear synthesis the same evening. Files are no longer empty scaffolds — they're seeded with real observations. **Ongoing maintenance** = future Telos profile-sync ticks (separate proposal noted under Tranche 1.5 below).

### Tranche 2 — Pillar 2 + 3 curricula + identity polish (parallel with Tranche 1)

- [x] **E.2 Pillar 2 curriculum** AUTHORED 2026-05-14 at `constantia/tasks/learn/curricula/pillar-2-agentic-systems.md` (constantia commit `76f4dc0`). 221 lines. Live-lab format using Guya + Telos as the codebase under study. 13 modules + 1 capstone over 12-14 weeks at ~3 hrs/week. Phases: Foundations / Orchestration + Multi-Agent / Reliability + Observability / Capstone. No hardware required (Guya + Telos already run locally). Capstone options: drift detector / replay harness / reliability dashboard / Daniel's choice. First L-task to assign: Module 1 (agent loop trace).
- [ ] **E.3 Pillar 3 curriculum** authored per scaffold below → `constantia/tasks/learn/curricula/pillar-3-eval-methodology.md`
- [ ] **G. Pillars review** — confirm 3 pillars are still right at next review (2026-05-17).
- [ ] **H. Telos identity refresh** — confirm 두식 voice / Doosik persona inheritance is current across all three sessions post-Phase 5.
- [ ] **F (extended)** — domains list (SDF, BosonAI synthetic data, agentic systems, ML systems design) + news sources (Twitter, blogs, arxiv categories) into profile.

### Tranche 3 — recurring meta-rhythms (can defer)

- [ ] **I.1 Sunday week-ahead review** — separate tick or fold into existing Sunday LIFE tick.
- [ ] **I.2 Monthly profile synthesis** — Telos synthesizes the month's evidence into profile updates. Cron-driven.
- [ ] **I.3 Quarterly goals review** — Daniel ↔ Telos pillar progress check.

### Tranche 4 — anti-rot + housekeeping (background)

- [ ] **J. Validator regression coverage** — test cases in Constantia hooks for every status transition, priority/pillar combo, proposal target type, reminder schedule type.
- [ ] **K. Old evidence / reflection cleanup** — old files reference deprecated T-/P- IDs. Decide: leave (audit trail) or annotate.
- [ ] **L. Daily smoke + drift checks** — log-grep that all 13 ticks fired; weekly drift check for R-task buildup, L-task grading, evidence growth. Optionally surface in `guya-status` skill.

### Tranche 5 — docs (after Phase 6 close)

- [ ] **M.1** ADR-018 entry in `CLAUDE.md` pointing to design doc.
- [ ] **M.2** Mark ADR-017 superseded by ADR-018.
- [ ] **M.3** ADR-019 (Phase 3-5 silent-rot lessons L1-L11 as meta-pattern).
- [ ] **M.4** STATUS.md cutover state update.

### Carry-over infra (flag separately)

- [ ] **WORK + LEARN addendum rollout** — same 12-line scope-clarify patch as shipped on LIFE 2026-05-12 (`6a731d9`). Validates tomorrow's WORK morning tick + LEARN ticks will hold conversation past the cron-fired turn.

---

## Pillar 1 Curriculum — Production Serving Cookbook (LOCKED 2026-05-14)

**Full curriculum:** [`constantia/tasks/learn/curricula/pillar-1-llm-serving.md`](../../constantia/tasks/learn/curricula/pillar-1-llm-serving.md)

**One-paragraph summary:** Operator-mode project. Deploy and progressively optimize Llama 3.1 8B (or alternative 7B-class model) on vLLM and SGLang across 7 phases: inference primitives (W1-2), vLLM baseline (W3-5), tuning study (W6-7), quantization (W8-9), speculative decoding (W10-11), SGLang head-to-head (W12-13), multi-tenant + production (W14-16). Each module produces a benchmark study or engineering note against a fixed 200-prompt eval set. Capstone = a single repo containing the harness + eval set + per-phase CSVs + cookbook markdown + 1-page README — portfolio-grade artifact.

**Hardware requirement (BLOCKING for Phase 2):** RunPod RTX 4090 (~$0.50/hr) as default; A100 40GB upgrade for Phases 5 + 7. Estimated $80-150 total spend over 16 weeks. BosonAI work-provided GPU access is the cheaper alternative if policy allows. Full hardware/software/eval-set/model-selection details in the curriculum file's "Hardware Requirements" section.

**Pre-Phase-2 checklist** (resolve before Module 4 starts): GPU access confirmed, CUDA 12.4+ installed, Python 3.10-3.12 venv set up, vLLM + SGLang installed, Llama 3.1 8B Instruct weights downloaded, 200-prompt eval set drafted, HF token configured.

**Pivot rationale:** Originally proposed nanoGPT-extended (builder-mode). Daniel's stated end-state is to operate production engines (vLLM, SGLang), not build them. Operator-mode produces direct skill match + stronger portfolio signal at staff-level. Phase 1 retains a quick nanoGPT pass-through (~2 weeks) for ground-truth intuition before pivoting to operator work in Phase 2.

---

## Pillar 2 Curriculum — Production Agentic Systems (LOCKED 2026-05-14, revised same day)

**Full curriculum:** [`constantia/tasks/learn/curricula/pillar-2-agentic-systems.md`](../../constantia/tasks/learn/curricula/pillar-2-agentic-systems.md) (619 lines, bytebytego-grade detail)

**One-paragraph summary:** Learning-focused curriculum (not a project plan). 11 modules across 3 phases over weeks 1-11 teach concepts (agent loop, state management, tool design, orchestration, memory, reflection, failure modes, retry/idempotency, observability, deploy gates) through reading + concept-check + optional application. Each module includes a cross-application section connecting the concept to SDF / BosonAI day-job work so learning compounds beyond Telos. **Phase 4 (Weeks 12-19) is an open-source launch sprint** — carve a release-worthy slice of the multi-personality agent framework, refactor for generalization, ship docs + reference personas + CI, launch publicly. Constantia + the Guya layer + Daniel-specific personas stay private. End state = 11 weeks of cemented concepts + a public open-source project with real users.

**Total span:** 19 weeks (Phase 1-3 = ~3 hrs/week, Phase 4 = 5-7 hrs/week launch sprint, can stretch to 12 weeks of lighter launch effort if needed).

**No hardware required.** Pillar 2 runs entirely against existing systems. Zero cloud cost.

**Cadence:** Parallel with Pillar 1 once Pillar 1 hits Phase 2 (~Pillar 1 W3). Evening reading slots.

**Why the open-source capstone matters:** Addresses the "single-user system" credibility gap honestly — 10 real users find 10 edge cases your private instance never surfaces. Also forces clean architecture (framework vs Daniel's instance), produces portfolio-grade artifact, and creates marketable positioning ("opinionated framework for personal-agent use cases" rather than competing on generality).

**What this curriculum WILL teach:** reading agent architecture, naming failure modes, designing tools/routing/memory/observability for non-deterministic systems, recognizing silent-rot patterns, shipping under constraints.

**What it WON'T teach:** framework fluency for stacks you don't use (LangGraph deliberately dropped), production scale beyond few-tenant (SDF covers this), greenfield design from blank page (already have this from Guya + Telos), ML training/inference (Pillar 1), statistical eval rigor (Pillar 3).

**First L-task to assign:** Module 1 — the agent loop. Read ReAct + Anthropic + Lilian Weng, trace one Telos tick end-to-end, answer concept-check without notes.

---

## Pillar 3 Curriculum Scaffold — Eval Methodology

> **Intent:** Get statistically rigorous about non-deterministic systems. Confidence intervals on pass rates, drift detection, shadow eval, A/B test design when outcomes are noisy. The actuarial-lens wedge that differentiates Daniel from "ML engineer who ships and prays."
>
> **Cadence:** ~2-3 hrs/week, ~10-12 weeks. Heaviest stats workload up front; later modules pair with Pillar 1 (eval inference quality) and Pillar 2 (eval Guya/Telos's effect on Daniel).
>
> **Per-module flow:** read (60-90 min) → derive or compute by hand (45 min) → apply to a real SDF / Guya / Telos eval scenario (30 min).

### Phase 1: Statistical Foundations (Modules 1-4)

1. **Probability + random variables, re-grounded.** *Reading:* Wasserman "All of Statistics" Ch. 1-3. *Derive:* CLT, binomial → normal approximation by hand.
2. **Estimation + confidence intervals.** *Reading:* Wasserman Ch. 6-7. *Compute:* given 100 LLM eval pass/fail outcomes with 73 passes, what's the 95% CI? Use Wilson, Clopper-Pearson, and normal approximation; explain the differences.
3. **Hypothesis testing + p-values.** *Reading:* Wasserman Ch. 10. *Compute:* you ran two prompt variants on 50 items each; variant A scored 38/50, variant B 42/50 — is the difference significant?
4. **Bayesian estimation basics.** *Reading:* Wasserman Ch. 11; Stan / PyMC intro docs. *Compute:* beta-binomial posterior over pass rate; how does the posterior update with more samples?

### Phase 2: Eval Design (Modules 5-7)

5. **Eval set construction.** Coverage, difficulty calibration, contamination risk, holdouts. *Reading:* "Holistic Evaluation of Language Models" (HELM); HumanEval / MMLU / GSM8K methodology critiques; "What's in My Big Data" papers.
6. **LLM-as-judge.** Bias modes, position bias, self-preference, calibration. *Reading:* Zheng et al. "Judging LLM-as-a-Judge with MT-Bench"; Anthropic evals blog.
7. **Pairwise + Elo eval.** When pairwise > absolute scoring; LMSYS Chatbot Arena methodology. *Reading:* Chatbot Arena paper; Bradley-Terry model.

### Phase 3: Production Eval (Modules 8-10)

8. **A/B testing on non-deterministic systems.** Sample sizes for noisy outcomes; sequential testing pitfalls. *Reading:* Kohavi/Tang/Xu "Trustworthy Online Controlled Experiments" Ch. 17-18 (variance reduction); Optimizely / Airbnb engineering posts.
9. **Drift detection.** Embedding drift, PSI, KL divergence; KS tests; concept drift vs covariate drift. *Reading:* Gama et al. survey on concept drift; Evidently AI docs.
10. **Shadow eval + canary.** Running new prompts/models against live traffic without user-facing risk. *Reading:* Google SRE Book Ch. 8 (Release Engineering); LinkedIn / Uber engineering posts on shadow deployment.

### Phase 4: Capstone (Modules 11-12)

11-12. **Design + run a real eval.** Pick one of: SDF synthetic-data quality eval, Guya guideline-improvement eval (do guidelines actually shift behavior?), Telos's grade calibration eval (do Telos grades correlate with actual Daniel improvement over a month?). Produce: hypothesis, eval design, sample size justification, results with confidence intervals, decision.

### Reference Materials

- **Books:** Wasserman *All of Statistics* (primary); Kohavi/Tang/Xu *Trustworthy Online Controlled Experiments*; Imbens/Rubin *Causal Inference* (later); McElreath *Statistical Rethinking* (excellent Bayesian alternative to Wasserman if Wasserman feels too dry).
- **Papers:** HELM, Chatbot Arena, MT-Bench, "Holistic Evaluation," LLM-as-judge bias papers.
- **Code:** OpenAI evals, Anthropic evals, Inspect AI, langfuse eval, weights-and-biases sweeps.

### Grading rubric (for Telos)

- **Derivation** (40%): can Daniel derive the statistical machinery without slide deck reference?
- **Application** (40%): does the module's applied computation produce a defensible eval design or analysis?
- **Real artifact** (20%): at least 2 of the 12 modules produce a real eval that ships into SDF / Guya / Telos.

---

## Suggested Order of Attack

**Tonight:** Pillar 1 project decision with Telos. The TBD inference project gate.

**Tomorrow morning:** Tranche 1 in this exact order — **curriculum (Pillar 1) → first L-task → weekly schedule → starter R-reminders → profile scaffolds.** Reasoning: each step makes the next one more useful. The curriculum gives LEARN something to assign. The L-task gives the firing infra something concrete to track. The weekly schedule lets WORK morning tick reference real blocks. R-reminders let the reminder infra fire against real Daniel cadences. Profile scaffolds let LIFE ticks ground 매님 / body / sleep questions against real context.

**This week:** Tranche 2 (Pillar 2 + 3 curricula authored; identity polish). Parallelizable while Pillar 1's first module is in progress.

**Next 2-4 weeks:** Tranche 3 (recurring meta-rhythms) once Tranches 1-2 stabilize.

**Background:** Tranches 4-5 (anti-rot, docs) when motivation aligns or when Phase 6 needs closing.

---

## Migration Notes

When a pillar curriculum gets authored in earnest, it migrates from this doc into `constantia/tasks/learn/curricula/pillar-N-{name}.md` (following the bytebytego format at 643 lines of depth). The scaffolds above are starting points — Daniel + Telos refine in session, then the canonical version lives in Constantia where LEARN can read it for L-task assignment.

This doc stays in `docs/` as the **rollup view + ordering plan**. It updates when tranches close.
