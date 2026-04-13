# SDF Vision — What We're Building

> The north star for SDF: product vision, engineering quality, and acceptance criteria in one place.

---

## One-Liner

SDF is a universal, plugin-based pipeline for generating high-quality synthetic multi-turn conversations at scale.

---

## 1. Universal Plugin Architecture

SDF is not an insurance conversation generator. It is a **framework** that happens to ship with an insurance domain.

### 1.1 The 20-Line Wrapper Promise

Any conversation generation method — from a research paper (CAMEL, Magpie, Evol-Instruct), a proprietary technique, or a custom heuristic — can be plugged into SDF by implementing one interface:

```python
@register(path="sdf.custom.my_method", name="My Method", role="customer")
class MyMethod(TurnGeneratorABC):
    def __init__(self, model_service, prompt_manager, config):
        ...
    async def generate(self, ctx: Context) -> GenerationResult:
        return GenerationResult(message="...", metadata={...})
```

`GenerationResult(message: str, metadata: dict)` is intentionally minimal. The framework handles everything else — retries, timeouts, checkpointing, cost tracking, output formatting.

### 1.2 Domain as a Directory

Adding a new vertical (healthcare, e-commerce, tech support, legal) requires:
1. `sdf/domains/<vertical>/blueprints.py` — what kinds of conversations exist
2. `sdf/domains/<vertical>/tasks.py` — what the agent is trying to accomplish
3. `sdf/domains/<vertical>/knowledge.py` — product/service knowledge the agent references

Zero framework changes. Zero runtime modifications. The registry auto-discovers everything under `sdf/domains/`.

Each domain is self-contained: domain modules only import from `sdf.registry`, `sdf.context_keys`, and `sdf.types` — never from each other or from runtime internals. Removing a domain directory produces zero import errors elsewhere.

### 1.3 Acceptance Criteria

- [ ] 2+ domains pass the full pipeline with shared infrastructure and zero domain-specific code in `sdf/runtime/`
- [ ] A new generation technique can be added, registered, and generating conversations in under 30 minutes
- [ ] Domain modules are fully isolated — removing a domain directory causes zero import errors in other domains
- [ ] A third-party developer can add a domain without reading runtime source code (only `MODULE_PATTERN.md` and the interface docstrings)

---

## 2. Information Asymmetry by Construction

This is SDF's core differentiator for conversation quality. It's not a convention — it's enforced in code.

### 2.1 The Principle

- The **customer** has a persona (name, age, personality, situation, patience) but no access to product knowledge, pricing, or the agent's task playbook. It asks genuine questions because it genuinely doesn't know.
- The **agent** has a task definition (goals, constraints, playbook) and a knowledge base (products, pricing, FAQ) but no access to the customer's internal state (patience, buying intent, personality). It responds based on what it can observe in the conversation.

### 2.2 How It's Enforced

The customer `build_template_vars()` function signature physically cannot accept `task_definition` or `knowledge_base` parameters. The agent `build_template_vars()` function signature physically cannot accept `persona`. This is not a naming convention — a developer literally cannot pass the wrong data without modifying the function signature.

### 2.3 Why It Matters

Most synthetic conversation generators give both sides full information. The resulting conversations are unnaturally smooth — the "customer" asks exactly the right questions, the "agent" anticipates every need. Real conversations are messy because of information asymmetry. SDF produces messy, realistic conversations because the architecture enforces the same asymmetry.

---

## 3. Agent-Side Tool Call Generation

### 3.1 The Goal

Generate training data where the agent uses tools as part of its responses — looking up policies, checking inventory, calculating quotes. This is the fastest-growing category of LLM training data.

### 3.2 Architecture Extension

```python
class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]

class Message(BaseModel):
    role: str  # "customer", "agent", "system", "tool"
    content: str
    turn_index: int
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
```

### 3.3 Conversation Flow with Tools

```
Customer: "How much would auto insurance cost for a 2020 Honda Civic?"
Agent:    [tool_call: get_quote(vehicle="2020 Honda Civic", coverage="basic")]
Tool:     [tool_result: {"monthly_premium": 89.50, "coverage": "basic", ...}]
Agent:    "For a 2020 Honda Civic with basic coverage, you're looking at $89.50/month..."
```

### 3.4 Plugin Point

A `ToolExecutorABC` protocol defines how tools are executed. Domains register their tool sets alongside their other modules. The conversation engine handles the `agent → tool_call → tool_result → agent` loop.

```python
@register(path="sdf.domains.insurance.tools", name="Insurance Tools")
class InsuranceToolExecutor(ToolExecutorABC):
    tools = {"get_quote": get_quote_fn, "lookup_policy": lookup_policy_fn}
    async def execute(self, tool_call: ToolCall) -> str: ...
```

### 3.5 Acceptance Criteria

- [ ] `Message` type supports tool calls and tool results
- [ ] `ConversationEngine` handles the agent → tool → agent loop
- [ ] `GenerationResult` can carry structured tool calls, not just text
- [ ] Output formatters serialize tool calls correctly in all formats (especially OpenAI Chat)
- [ ] Tool execution is pluggable per domain

---

## 4. Conversation Quality and Diversity

### 4.1 Stage-Based Flow

Conversations follow natural stages, not random back-and-forth:

```
Opening → Discovery → Presentation → Objection Handling → Close/Abandon
```

Stage transitions are driven by exit conditions and `STAGE_INSTRUCTIONS` context key. Each stage has configurable turn ranges and transition probabilities.

### 4.2 Diversity Dimensions

At 100K conversations, diversity is critical. Every conversation should feel different:

| Dimension | Mechanism |
|-----------|-----------|
| Customer persona | Varied demographics, personality, patience, situation |
| Conversation arc | Stage probabilities, early abandonment, extended negotiation |
| Agent behavior | Different knowledge depth, response styles, upsell aggressiveness |
| Scenario texture | Time pressure, competitor mentions, emotional escalation, language complexity |
| Outcome distribution | Not all conversations end in a sale — realistic win/loss ratios |

### 4.3 Quality Convergence

Quality is not an afterthought — it's a pipeline-level feedback loop:

1. QC evaluators score each conversation on configurable rubrics
2. `QUALITY_METRIC` flows into `BatchSummary.avg_quality_score`
3. `BatchLoop` checks convergence: if quality exceeds threshold for N consecutive batches, generation stops early
4. Poor-quality conversations can trigger prompt adjustments (future: optimizer module)

### 4.4 Acceptance Criteria

- [ ] QC evaluators wired into batch-post phase and writing `QUALITY_METRIC`
- [ ] Convergence triggers early stop when quality stabilizes
- [ ] Diversity metrics reported per run (unique persona count, stage distribution, outcome distribution)
- [ ] No two conversations in a batch share the same persona profile
- [ ] Configurable outcome distribution (e.g., 60% sale, 25% callback, 15% abandon)

---

## 5. Training Data as the Product

SDF's output is training data. The quality of that output is the entire point.

### 5.1 Validation Pipeline

Every conversation passes through validators before export:

| Validator | Purpose |
|-----------|---------|
| Deduplication | No near-duplicate conversations (content similarity threshold) |
| PII scan | No real names, phone numbers, SSNs, emails leaked from LLM |
| Schema check | Every message has required fields, turn indices are sequential |
| Token budget | Conversations fit within the target model's context window |
| Quality gate | Minimum quality score from QC evaluators |

Validators run as a chain in the batch-post phase. A conversation must pass all validators to be included in the output. Failed validations are logged with reasons, not silently dropped.

### 5.2 Output Format Fidelity

Each output format must be directly consumable by its target framework:

| Format | Target | Guarantee |
|--------|--------|-----------|
| ShareGPT | Axolotl, LLaMA-Factory | Passes `sharegpt` format validator |
| OpenAI Chat | OpenAI fine-tuning API | Valid JSONL with tool call schema |
| Alpaca | Stanford Alpaca format | Instruction/input/output structure |
| JSONL | Generic | One JSON object per line, UTF-8 |
| Parquet | HuggingFace datasets | Valid schema, column types match |

### 5.3 Data Statistics

Every run produces a statistics report:

- Total conversations, messages, tokens
- Distributions: turns per conversation, tokens per message, quality scores
- Persona demographics: age, personality, outcome distributions
- Cost breakdown: per-model, per-module, per-conversation average
- Anomalies: outlier conversations (too short, too long, low quality)

### 5.4 Acceptance Criteria

- [ ] Validation pipeline wired into batch-post phase (all 5 validators active)
- [ ] Output in each format passes the target framework's own validator
- [ ] Statistics report generated per run with distributions, not just averages
- [ ] Failed validations are logged with reasons, not silently dropped

---

## 6. Scale Target

### 6.1 Performance Goals

| Metric | MVP | Target |
|--------|-----|--------|
| Conversations per run | 1,000 | 100,000+ |
| Concurrent conversations | 5–10 | 50–100 |
| Memory usage | ~1GB (all in RAM) | <500MB (streaming) |
| Checkpoint interval | Every batch | Every batch |
| Resume time | <5s | <5s |
| Provider rate limits | Reactive (Retry-After) | Proactive (token bucket) + reactive |

### 6.2 Memory-Bounded Execution

At 100K scale, the pipeline must never hold more than one batch of data in memory at a time:

- **Streaming persistence:** Each conversation is written to storage as it completes, not accumulated in a list. The batch context holds only metadata (counts, quality scores), not conversation payloads.
- **Copy-on-write context:** Batch-inherited data is shared by reference across all conversations. Deep-copy occurs only when a conversation writes to the same key. Memory usage is O(batch_size × per_conv_delta), not O(batch_size × total_batch_data).
- **Bounded checkpoints:** Checkpoint snapshots contain only pipeline state (batch_id, counts, resolved config), not conversation content.

### 6.3 Operational Goals

- A 100K run can be started, interrupted, and resumed without data loss
- Failed conversations are retried, not discarded
- Partial batch recovery: a batch that completes 480/500 records 480 successes, 20 failures; the next batch compensates
- Cost is tracked in real-time with budget enforcement (warn at 80%, hard stop at 100%)
- Progress is visible via CLI, web UI, or callback
- A crashed run leaves a clear diagnostic (run status, error report, checkpoint)
- `sdf resume <run_id>` restores the original run config from the checkpoint, not from re-resolved defaults

### 6.4 Timeouts at Every Layer

| Layer | Config Key | Default |
|-------|-----------|---------|
| Per-request (LLM API call) | `request_timeout_s` | 120s |
| Per-conversation (full turn loop) | `conversation_timeout_s` | 300s |
| Per-batch (all conversations) | `batch_timeout_s` | 3600s |
| Per-run (entire pipeline) | `run_timeout_s` | None |

Each timeout produces a clear error, writes whatever progress exists, and allows the pipeline to continue.

---

## 7. Multi-Domain Validation

The architecture claims to be domain-agnostic. This must be proven, not assumed.

### 7.1 Target Domains

| Domain | Conversation Type | Unique Challenges |
|--------|------------------|-------------------|
| Insurance (shipped) | Cold outbound sales | Product knowledge, pricing, objection handling |
| Customer support | Inbound troubleshooting | Issue diagnosis, escalation, resolution tracking |
| E-commerce | Product inquiry / purchase | Inventory lookup, comparison, cart management |
| Healthcare scheduling | Appointment booking | Availability, insurance verification, urgency triage |

### 7.2 Acceptance Criteria

- [ ] 2+ domains fully functional with no shared mutable state between them
- [ ] Same pipeline config runs different domains by changing `--include` flags
- [ ] Domain-specific tool sets work with the tool call extension
- [ ] Quality rubrics are domain-configurable (not hardcoded insurance metrics)
- [ ] Adding a 5th domain takes <2 hours for someone reading the docs

---

## 8. Open-Source Readiness (if pursued)

### 8.1 5-Minute Quickstart

```bash
pip install sdf
sdf run --domain insurance --count 10 --format sharegpt
# → output/run_xxx/conversations.json (10 conversations, ~30 seconds)
```

No YAML, no config file, no API key setup required for a demo run (use a local/mock provider).

### 8.2 Documentation

- README with quickstart, architecture diagram, and example output
- `MODULE_PATTERN.md` for plugin developers
- `docs/adding-a-domain.md` tutorial
- `docs/adding-a-technique.md` tutorial
- Example output files in `examples/`

### 8.3 Naming

"SDF" collides with multiple existing projects (Signed Distance Functions, Smart Data Fabric, etc.). If open-sourcing, consider a distinctive name. Candidates TBD.

---

## 9. Engineering Quality Standards

These are the contracts the implementation must satisfy. Where they map to a product feature above, they are the "how" behind the acceptance criteria.

### 9.1 Reliability and Fault Isolation

- **DAG tier isolation:** `asyncio.gather(..., return_exceptions=True)` in the DAG executor. A failing batch-setup module produces a diagnostic error; independent siblings complete normally.
- **Conversation-level retry:** Transient failures (rate limits, 503s) are retried at the model layer. If the entire conversation fails after retries, it is retried as a unit (configurable `max_conversation_retries`).
- **Graceful shutdown:** SIGINT/SIGTERM handler sets a `_shutdown_requested` flag. The batch loop checks it between iterations. In-flight conversations complete (with a timeout). A checkpoint is written with current progress. Run status is updated to "interrupted".

### 9.2 Concurrency

- **Two separate controls:** A concurrency limiter (semaphore) bounds in-flight requests per provider; a rate limiter (token bucket) bounds requests-per-second per provider.
- **Thread-safe context:** `BatchContext` (shared across concurrent conversations) routes all reads and writes through `asyncio.Lock`. Values returned by `read()` are deep-copied to prevent external mutation. `ConversationContext` (single-owner) returns copies to prevent accidental mutation of inherited batch data.
- **Atomic operations:** Semaphore creation uses `dict.setdefault()` (no TOCTOU races). Budget checks are performed inside the cost tracker's lock (no overshoot).
- When a provider returns `429 Too Many Requests` with a `Retry-After` header, the rate limiter uses `delay = max(computed_backoff, retry_after)`.

### 9.3 Error Handling

Errors classify into three categories that determine behavior:

```
ModelError (base)
  +-- RateLimitError        -> retryable, respects Retry-After
  +-- ProviderError         -> retryable (5xx, transient network)
  +-- AuthenticationError   -> non-retryable, abort provider
  +-- BadRequestError       -> non-retryable, skip conversation
  +-- BudgetExceededError   -> non-retryable, abort run
  +-- TimeoutError          -> retryable (up to limit)
```

- No bare `except Exception` in adapters — only provider SDK exceptions are caught. Programming bugs propagate immediately with full stack traces.
- Retry policy: exponential backoff with jitter (`delay = min(base * 2^attempt + random(0, jitter), max_delay)`). `Retry-After` header overrides computed delay.
- `StructuredOutputError` is distinct from `ProviderError` — same prompt may produce the same bad JSON, so it is not retried by default.

### 9.4 Security

- **Template safety:** All Jinja2 rendering uses `SandboxedEnvironment`. LLM-generated content is never interpreted as template source — always passed as a variable.
- **Plugin sandboxing:** Plugin directories are validated to be within the project root (or an explicitly configured path). System directories (`/`, `/tmp`, `/usr`, `/etc`, `/var`, home) are rejected. A `strict` mode aborts discovery if any plugin fails to import.
- **Input validation:** `ContextKey` fields reject `::` and empty strings at construction. Config models use `extra='forbid'` everywhere. Every `Field()` has explicit bounds. Cross-field validators catch impossible combinations. Path traversal is blocked with `resolve()` + `is_relative_to()`. Run IDs are validated with a whitelist regex (`^[a-zA-Z0-9_-]+$`).

### 9.5 Observability

- **Structured progress events** (not just log lines): `PipelineProgress` carries `run_id`, `batch_id`, `total_generated`, `total_failed`, `target`, `elapsed_s`, `estimated_remaining_s`, `cost_usd`, `avg_quality`, `conversations_per_second`. A progress callback (`Callable[[PipelineProgress], None]`) is registered at pipeline construction.
- **LLM call logging:** Each log entry includes the provider's response ID for cross-referencing with provider dashboards. Failed calls log token usage when available.
- **Cost tracking:** Pricing stored per-1M tokens. Budget enforcement: warn at 80%, hard stop at 100%. `summary()` is non-destructive.
- **Error diagnostics:** Every error includes context (conversation, turn, module, provider). Stack traces logged to file at ERROR level. User-friendly one-line messages at the CLI with a pointer to the log file. `discover_modules()` returns `DiscoverResult(nodes, failures)` with full import tracebacks per failure.

### 9.6 Data Integrity

- **Serialization:** Context keys use `::` as an unambiguous separator. Serializer handles all project types: primitives, datetime, Pydantic models, dataclasses, lists, dicts. Round-trip property: `deserialize(serialize(ctx)) == ctx` — tested with property-based tests.
- **Checkpoint/Resume:** Checkpoint writes are atomic (`os.replace`). Resume loads the original run config from the checkpoint. Duplicate conversation IDs on resume handled with `INSERT OR REPLACE`.
- **Storage:** SQLite with WAL mode and `synchronous=NORMAL`. Bulk inserts via `executemany` — one commit per batch. Connection lifecycle is explicit. Indexed on `run_id` and `batch_id`.

### 9.7 Type Safety

- The `Context` protocol matches what modules actually use: `read`, `read_optional`, `write`, `has`. `ConversationContextProtocol` adds `conversation_id` and `batch_ctx`.
- Zero `# type: ignore` comments in module code. Module adapters annotate `ctx` as the `Context` protocol (not `object`).
- Aspirational: generic `ContextKey[T]` so `ctx.read(CUSTOMER_PERSONA)` returns `PersonaProfile`, not `Any`.

### 9.8 Module Design

- A generic `MessageGenerator` handles both agent and customer generation, parameterized by role, internal state class, error class, context keys, and prompt template name. Agent and customer generators are thin config wrappers — ~10 lines each.
- Domain modules accept config from the registry (`config_schema=` in `@register`). Adding a new topic is a config change, not a new file.
- Age distributions match the target vertical's customer demographics (weighted, not uniform). Persona IDs are always system-generated UUIDs, never LLM-generated.

### 9.9 Test Suite

| Layer | Unit Tests | Integration | Property-Based |
|-------|-----------|-------------|----------------|
| Registry | Collision, cycles, prefix deps, freeze, discovery | Full discover → validate → freeze → resolve | Fuzz: random DAGs for cycle detection |
| Context | Read/write/has, isolation, batch-inherited, round-trip | BatchContext concurrent writes | Property: serialize(deserialize(x)) == x |
| Model | Each adapter, retry policy, rate limiter, routing | ModelService end-to-end with mock adapter | Fuzz: random error sequences through retry |
| Runtime | Batch loop, conversation engine, DAG | Full pipeline: batch-setup → turns → batch-post | Stress: 500 conversations through pipeline |
| Modules | Each module's `run()` with mock context | Module → context key → downstream data flow | — |
| QC | Each evaluator, LLM judge prompt construction | QCRunner with mixed pass/fail evaluators | — |
| CLI | Config resolution priority, each command path | `sdf run` end-to-end with mock providers | — |

Critical path scenarios every test suite must cover:

1. Retry exhaustion: `RateLimitError` 3× → `RetryExhaustedError` with correct wrapping
2. Concurrent batch writes: 50 coroutines write simultaneously → all values present, no races
3. Partial batch failure: 2 of 5 conversations fail → batch records correctly → next batch compensates
4. Graceful shutdown: SIGINT during batch → checkpoint written → `sdf resume` picks up correctly
5. Checkpoint round-trip: save → load → pipeline state is identical, resolved config preserved
6. DAG failure isolation: one batch-setup node raises → siblings complete → pipeline continues
7. Budget enforcement: 80% → warning logged; 100% → `BudgetExceededError`, run stops cleanly
8. Provider error classification: `AuthenticationError` → not retried; `ProviderError` (5xx) → retried with backoff

Test quality standards:
- No `pytest.raises(Exception)` — always catch the specific expected error type
- Mocks verify contracts, not implementation. `ModelService` mocks return realistic `ModelResponse` objects, not bare strings
- Async tests use `pytest-asyncio` with proper event loop lifecycle
- Shared fixtures in `conftest.py` at each directory level, not duplicated across files
- Test names describe the scenario, not the method being tested

### 9.10 CLI and Operations

- All paths resolved relative to a known root (package location or config file directory), never relative to CWD.
- 4-layer config resolution: CLI flags > environment variables > YAML file > defaults. YAML parse errors reported immediately with line/column.
- Full stack traces logged to file at DEBUG/ERROR level always (not opt-in). User-friendly one-liners at the CLI with a pointer to the log file.
- Run reports summarize: total generated, total failed, cost, quality distribution, errors (capped at 1000).
