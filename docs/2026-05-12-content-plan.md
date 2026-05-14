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

- [ ] **A. Pillar 1 project decision** — the "TBD inference project" that complements SDF. Candidates: nanoGPT extended with progressive serving optimizations (fp16 → int8 → KV cache → continuous batching); rapGPT2.0 progressive optimization; vLLM-style serving stack from scratch; distillation + quantization toolkit. Includes: scope, 1-month / 3-month success criteria, and the rubric Telos will use to grade progress. *Daniel ↔ Telos discussion. Everything in Tranche 1 waits on this.*

### Tranche 1 — direct content authoring (unblocks once Pillar 1 picked)

- [ ] **E. Pillar 1 curriculum** authored per scaffold below → `constantia/tasks/learn/curricula/pillar-1-llm-serving.md`
- [ ] **D. First L-task assigned** from Pillar 1 Module 1. Sets LEARN tick's first concrete thing to grade against.
- [ ] **B. Weekly schedule** → `constantia/goals/weekly-schedule.md`: deep work windows, gym, Audrey time, family contact, weekly planning. Plus decision on update cadence (Sunday tick vs manual).
- [ ] **C. Starter R-reminders**: workout cadence, sleep prep nudge (11pm), family weekly check-ins (mom/dad/sister), 매님 baseline if not redundant with LIFE tick.
- [ ] **F. Profile scaffolds**: `profile/relationship.md` (Audrey context) + `profile/health.md` (workout history, body baseline). Currently empty; LIFE tick prompts already reference them.

### Tranche 2 — Pillar 2 + 3 curricula + identity polish (parallel with Tranche 1)

- [ ] **E.2 Pillar 2 curriculum** authored per scaffold below → `constantia/tasks/learn/curricula/pillar-2-agentic-systems.md`
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

## Pillar 1 Curriculum Scaffold — LLM Serving + Inference at Scale

> **Intent:** Build production intuition for serving LLMs at scale. Start from the primitives (how a transformer actually runs an inference step), pivot fast to the production optimizations that matter (KV cache, batching, quantization, speculative decoding), end with multi-tenant serving and cost/latency engineering.
>
> **Cadence:** ~3-5 hrs/week, ~16-20 weeks total. One module per week unless project work demands it.
>
> **Per-module flow:** read + watch (90-120 min) → implement or instrument (90-120 min) → connect to TBD inference project (30-60 min) → 3-5 sentence writeup. Same shape as bytebytego curriculum.

### Phase 1: Transformer Inference Primitives (Modules 1-4)

1. **Attention math + the inference step.** Re-derive scaled dot-product attention; trace one token's forward pass through a small transformer. *Reading:* Karpathy's nanoGPT walkthrough; Lilian Weng "The Transformer Family." *Implement:* tiny single-head attention from scratch in PyTorch.
2. **KV cache mechanics.** What's actually stored, memory profile, how generation differs from training. *Reading:* "Efficient Memory Management for Large Language Model Serving with PagedAttention" (Kwon et al., vLLM paper) §2-3. *Implement:* add KV cache to nanoGPT's generate loop; measure memory + latency before/after.
3. **Sampling strategies.** Greedy, top-k, top-p, temperature, beam search; what production picks and why. *Reading:* HuggingFace generation docs; Holtzman et al. "The Curious Case of Neural Text Degeneration." *Implement:* swap samplers, profile latency, A/B perplexity on a fixed prompt set.
4. **Inference vs training: where the work goes.** Compute-bound vs memory-bound, arithmetic intensity, why H100 ≠ 2× A100 for inference. *Reading:* Horace He's "Making Deep Learning Go Brrrr From First Principles."

### Phase 2: Throughput Optimization (Modules 5-9)

5. **Continuous batching.** Why static batching kills throughput in inference; how Orca / vLLM solve it. *Reading:* Yu et al. "Orca"; vLLM paper §4. *Implement:* port a basic continuous batching scheduler.
6. **PagedAttention + block KV cache.** Memory fragmentation, virtual memory for attention. *Reading:* vLLM paper §3-4 in depth.
7. **Speculative decoding.** Draft model + verify model, expected speedup, when it fails. *Reading:* Leviathan et al. "Fast Inference from Transformers via Speculative Decoding"; Chen et al. "Accelerating Large Language Model Decoding with Speculative Sampling." *Implement:* speculative decoding loop with a 70M draft model verifying a larger target.
8. **Quantization basics.** INT8, INT4, fp16/bf16; calibration vs weight-only vs activation. *Reading:* LLM.int8 (Dettmers); GPTQ (Frantar); AWQ (Lin et al.). *Implement:* quantize a model with one of the libraries (bitsandbytes, AWQ, GPTQ), measure quality drop.
9. **Compilation + kernel fusion.** PyTorch 2.x compile, Flash Attention, custom CUDA kernels. *Reading:* Flash Attention paper (Dao et al.); Flash Attention 2.

### Phase 3: Multi-Tenant Production Serving (Modules 10-13)

10. **Request scheduling + admission control.** Priority queues, SLA tiers, backpressure. *Reading:* AWS Builders' Library "Caching at scale"; Anthropic / OpenAI public posts on serving architecture.
11. **Latency engineering.** P50 / P95 / P99, head-of-line blocking in token generation, prefix caching. *Reading:* Google SRE Book Ch. 4 (Service Level Objectives); papers on speculative + chunked prefill.
12. **Cost engineering.** Cost per million tokens math; H100 vs A100 vs L4; spot vs on-demand. *Reading:* public cost analysis posts (Together, Anyscale, Fireworks comparisons).
13. **Observability for inference.** Metrics that matter (TTFT, TPOT, throughput, GPU utilization, KV-cache hit rate). *Reading:* vLLM metrics docs; OpenTelemetry semantic conventions for LLM serving.

### Phase 4: Capstone (Modules 14-16)

14-16. **Apply to TBD inference project.** Three weeks of focused project work using the primitives above. Define a concrete optimization arc (e.g., nanoGPT → +KV cache → +continuous batching → +INT8 quantization → measure end-to-end throughput improvement on a fixed eval set).

### Reference Materials

- **Papers:** vLLM (Kwon), Orca (Yu), Flash Attention (Dao), Speculative Decoding (Leviathan / Chen), LLM.int8 (Dettmers), GPTQ (Frantar), AWQ (Lin).
- **Books:** *Programming Massively Parallel Processors* (Hwu/Kirk); *Deep Learning Systems* (Chen / Tao if it has shipped); CMU 11-664 / 15-749 lecture notes.
- **Code to read:** vLLM, TGI (HuggingFace), SGLang, llama.cpp, TensorRT-LLM, FlashInfer.
- **Videos:** Karpathy's "Let's build GPT," "Neural Networks Zero to Hero" series; CMU Catalyst talks; vLLM talks at MLSys.

### Grading rubric (for Telos)

- **Conceptual** (40%): can Daniel re-derive the mechanic from primitives without notes?
- **Implementation** (40%): does the module-end artifact run + measure correctly?
- **Connection** (20%): does the 3-5 sentence writeup tie the concept to TBD-inference-project decisions or SDF?

---

## Pillar 2 Curriculum Scaffold — Production Agentic Systems

> **Intent:** Build the engineering discipline for shipping agents that don't silently rot in production. Orchestration, idempotency, observability, failure-mode handling for non-deterministic systems.
>
> **Cadence:** ~3 hrs/week, ~12-14 weeks. Lighter than Pillar 1 because Guya + Telos is the live lab — module reading is paired with applying the concept to Guya or Telos directly.
>
> **Per-module flow:** read (60-90 min) → audit Guya / Telos for the pattern (45 min) → write an ADR or evidence note about what's working / broken (30 min).

### Phase 1: Foundations (Modules 1-3)

1. **What an agent actually is.** ReAct, tool use, the agent loop. *Reading:* ReAct paper (Yao et al.); Anthropic "Building effective agents" post; Lilian Weng "LLM Powered Autonomous Agents." *Audit:* trace a single tick through Telos from cron fire to Discord reply — every layer.
2. **State management across turns.** Continuation tokens, conversation history, when to clear. *Reading:* nanoclaw `poll-loop.ts` + `session-state.ts`; Anthropic context-management docs. *Audit:* the L7 + tick-default contamination bugs from Phase 4/5.
3. **Tool design for reliability.** Idempotency, error envelopes, parameter validation. *Reading:* OpenAI / Anthropic tool use docs; design docs for production tool frameworks (LangChain core, Anthropic Computer Use). *Audit:* `shared/telos-tools/` MCP tools — which are idempotent? Which aren't?

### Phase 2: Orchestration + Multi-Agent (Modules 4-7)

4. **Multi-agent patterns.** When two agents > one big agent; the Guya↔Telos↔Constantia split as a case study. *Reading:* AutoGen paper; CrewAI patterns; AssistantOps writing.
5. **Routing and engagement.** Engage patterns, sender scope, ignored-message policies. *Reading:* nanoclaw's router code; Slack/Discord bot routing patterns.
6. **Memory architectures.** Three-tier memory (Letta/MemGPT), conversation summarization, vector recall, structured vs unstructured. *Reading:* MemGPT paper; Letta docs; "Memory in agents" survey if available.
7. **Reflection + self-improvement.** *Reading:* Reflexion paper (Shinn et al.); ADR-002 + ADR-011 (Guya's evolution decisions); LATS paper.

### Phase 3: Reliability + Observability (Modules 8-11)

8. **Failure modes specific to LLM agents.** Cascading retries, hallucinated tool calls, context window blow-up, silent prompt-history drift. *Reading:* "Embers of Autoregression" (McCoy et al.); production postmortems where available.
9. **Retry + idempotency.** When to retry, when to fail forward, how to detect partial state. *Reading:* "Patterns of Distributed Systems" (Joshi) chapters on idempotent receivers, exactly-once delivery.
10. **Observability for non-deterministic systems.** What to log, what to trace, what to alert on. *Reading:* LangSmith / Anthropic Evals / Helicone docs; OpenTelemetry GenAI semantic conventions.
11. **Pre-deploy gates + post-deploy validation.** *Reading:* Guya's pre-commit + post-commit hook setup; the silent-rot lessons L1-L11 from Phases 3-5 (when ADR-019 lands).

### Phase 4: Capstone (Modules 12-14)

12-14. **Apply to Guya or Telos.** Pick a real silent-rot risk in the current system; design + ship the observability + anti-rot gate that catches it. Could be: drift detection on Telos's `priority` field usage, automated daily tick-fire smoke + alert, KV/JSON corruption recovery for the reminder sidecar.

### Reference Materials

- **Papers:** ReAct, Reflexion, MemGPT, AutoGen, ToolFormer, LATS, "Designing the Future of Memory in LLM Agents," "Embers of Autoregression."
- **Books:** *Patterns of Distributed Systems* (Joshi); *Release It!* (Nygard) — for failure-mode discipline; *Site Reliability Engineering* (Google) chapters on alerting + SLOs.
- **Code to read:** LangGraph, AutoGen, Letta, Anthropic Computer Use reference implementations, nanoclaw itself (you literally have the source).
- **Live lab:** Guya + Telos. Every module's audit step grounds the reading in the system you're already running.

### Grading rubric (for Telos)

- **Concept identification** (30%): can Daniel name where a pattern lives in Guya/Telos (or argue why it shouldn't be there)?
- **Audit quality** (40%): the ADR / evidence note demonstrates concrete diagnosis, not generic summary.
- **Action** (30%): at least 1 of every 3 modules produces a real PR or commit to Guya/Telos.

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
