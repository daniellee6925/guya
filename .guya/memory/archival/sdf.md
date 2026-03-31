# SDF (Synthetic Data Factory)

## What It Is
Plugin-based pipeline for generating synthetic conversational training data at scale (~100k conversations). Insurance sales domain first, designed to be domain-agnostic. Python 3.11, async, multi-LLM (Claude/OpenAI/Gemini), SQLite, Click CLI.

## Architecture
- Registry-based plugin discovery with `@register` decorator + topo-sort
- DAG-based pipeline runtime with batch loop and conversation engine
- Modules communicate through typed shared context (ContextKey constants)
- No module imports another module directly
- Pipeline: Blueprint → Persona → Scenario → Customer/Agent Message Gen → QC → Export

## What's Done
- Core pipeline end-to-end working (1,564 tests passing)
- 3 LLM providers with retry + rate limiting
- Checkpoint/resume from any batch
- Cost tracking with budget enforcement
- 6 export formats (JSONL, ShareGPT, OpenAI Chat, Alpaca, Parquet, Custom)
- QC: rule-based + LLM-as-judge evaluators with configurable rubrics
- Scenario system: structure (fixed beats), texture (emotion drift), techniques (dialogue acts), dynamic (adaptive dialogue)
- Customer personas: template + LLM + census-enriched + 6 enrichment steps
- CLI: run, resume, validate, estimate, describe, list-modules, list-personas
- Information asymmetry enforced at function-signature level

## What's Remaining
**Production Hardening (for 100K):**
- GAP-H1: Signal handler for graceful shutdown
- GAP-H2: Streaming persistence (phase 2 — peak memory still O(total) at batch-post)

**Operational Quality:**
- GAP-M1-M6: Budget-aware retry, progress data, error diagnostics, context key validation, plugin sandboxing, run ID sanitization

**New Features (high leverage):**
- FEAT-1: Optimizer module (prompt version optimization feedback loop) — LARGE
- FEAT-2: Embedding-based evaluator (semantic similarity for repetition detection)
- FEAT-3: Realism/diversity metrics
- FEAT-4: Second domain (validate multi-domain architecture)
- FEAT-5: Tool call generation
- FEAT-7: Batch API routing (~50% cost reduction)
- FEAT-9: UI dashboard (FastAPI + HTMX)

## Project Locations
- `/Users/daniel/Desktop/projects/sdf` — original
- `/Users/daniel/Desktop/projects/sdf-dev` — development branch
- `/Users/daniel/Desktop/projects/sdf-autonomous` — autonomous improvements branch

## Key Learnings from Sessions (2026-03-31)
- Daniel corrected scale assumption: 100K not 1K — always verify business context early
- Daniel wants docs optimized for AI-driven dev, not human reading
- Daniel sets process rules before coding: STATUS.md tracking, commit at milestones, plan before implement
- Vague input is a signal to clarify, not guess and run
- Daniel's 5 pillars for SDF: Modular, Universal, Quality Controlled, Self-Improving, Scalable

## Scorecard
Overall: A- — Six A+ dimensions. Production-grade for 1-5K. Needs hardening for 100K.
