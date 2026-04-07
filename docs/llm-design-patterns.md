# LLM-Oriented Design Patterns

You are writing code that will be read, modified, and assembled primarily by LLMs. Follow these design patterns to maximize AI comprehension and minimize hallucination risk.

All examples are drawn from oxRL, a post-training framework for LLMs, but the patterns apply to any codebase.

---

## Pattern 1: Radical Fragmentation

Split monolithic classes into single-responsibility micro-gears.

ANTI-PATTERN — god class with 7 responsibilities:
```python
# oxRL example: GRPO algorithm class — 665 LOC
@ray.remote
class GRPO:
    def __init__(self, ...):              # engine setup
    def load_model(self):                 # model I/O
    def compute_kl_distance(self, ...):   # math utility
    def compute_policy_loss(self, ...):   # 3 algorithm variants behind if-else
    def train_step(self, ...):            # training orchestration
    def _strip_lora_and_merge(self, ...): # weight merging (duplicated in PPO)
    def save_checkpoint(self, ...):       # file I/O (2 code paths)
    # Must read all 665 LOC to modify any single concern
```

PATTERN — shatter into focused files:
```
algs/
├── losses/
│   ├── sgrpo.py       # 67 LOC — one algorithm variant per file
│   ├── gspo.py        # 75 LOC
│   └── cispo.py       # 66 LOC
├── grpo.py            # 477 LOC — orchestration only
tools/
├── lora_merge.py      # 61 LOC — pure function, no class state
├── checkpoint.py      # 84 LOC — save/gather/config extraction
```

To modify one variant: read 75 LOC, not 665. To fix weight merging: read 61 LOC, reused by every algorithm.

**The principle**: if a class has N responsibilities, an LLM modifying responsibility #3 must load all N into context. After splitting, it loads only #3.

---

## Pattern 2: Calling Specs as Black Boxes

Every module gets a calling spec at the top. The LLM reads the spec (~20-30 tokens) instead of the implementation (~500+ tokens).

ANTI-PATTERN — no spec, must read full source to use:
```python
class SomeService:
    # What methods exist? What args do they take? What do they return?
    # Answer: read the entire file.
```

PATTERN — spec at the top of every module:
```python
"""SomeService — Brief description of purpose.

CALLING SPEC:
    svc = SomeService.remote(config=config)

    svc.process.remote(
        items=[{"id": int, "data": {...}}, ...],
        batch_id=int,
    ) -> List[Dict]:
        Each dict: result_id (int), score (float), metadata (dict)

    svc.refresh.remote(new_model_path, version) -> bool
"""
```

**Recursive compression** — at each level, read only the spec from below:
```
Level 0: variant_fn spec    -> "result = variant_fn(inputs)"        ~20 tokens
Level 1: engine.step spec   -> "metrics = engine.step(batch)"       ~20 tokens
Level 2: phase spec         -> "phase_result = run_phase(...)"      ~15 tokens
Level 3: main.py            -> "calls phase_1 -> phase_2 -> phase_3" ~10 tokens
Total: ~65 tokens to understand the full pipeline (vs ~10,000 tokens reading source)
```

---

## Pattern 3: Variant Functions as a Registry

When multiple implementations share the same interface (algorithm variants, serialization formats, scoring strategies), use a registry of pure functions with identical signatures. Dispatch via dict, not if-else.

ANTI-PATTERN — multiple variants interleaved in one method:
```python
def compute(self, data, ...):
    if self.variant == "A":
        # 30 LOC — variant A logic
    elif self.variant == "B":
        # 25 LOC — variant B logic
    elif self.variant == "C":
        # 20 LOC — variant C logic
    # Modifying one variant risks breaking others
```

PATTERN — registry of pure functions with identical signatures:
```python
# variants/__init__.py
REGISTRY = {
    "A": compute_variant_a,
    "B": compute_variant_b,
    "C": compute_variant_c,
}

def get_variant_fn(name):
    return REGISTRY[name]
```

```python
# variants/variant_b.py — single file, single responsibility
def compute_variant_b(data, config_a, config_b, ...):
    """Variant B: brief description of what makes it different."""
    # ... self-contained implementation ...
    return result, metrics_dict
```

Add a new variant = add one file + one registry entry. Zero risk to existing variants.

---

## Pattern 4: Toolification

Extract deterministic logic into standalone, tested, pure-function tools. If two classes share the same utility, it must be a tool, not a duplicated method.

ANTI-PATTERN — deterministic logic buried inside a class:
```python
class AlgorithmA:
    def _merge_weights(self, state_dict):
        # 42 LOC of linear algebra using self.config
        # AlgorithmB duplicates this exact same method
```

PATTERN — standalone tool, no class state:
```python
# tools/weight_merge.py
def merge_weights(state_dict, alpha, rank):
    """Merge adapter weights into base weights.

    TOOL CONTRACT:
        Input:  state_dict with base + adapter weights, scaling params
        Output: new state_dict with merged weights, adapter keys removed
        Side effects: None
        Deterministic: same input -> same output
    """
    # ... pure function ...
    return new_state_dict
```

---

## Pattern 5: Orchestrator Files as Recipes

The top-level entry point is a slim orchestrator that reads like a recipe. All logic lives in the phases it calls.

PATTERN — orchestrator calls named phases:
```python
# main.py — ~190 LOC, pure orchestration
def main(config_file):
    config = load_config(config_file)
    infra = setup_infrastructure(config)
    engines = create_engines(config, infra)

    for epoch in range(config.num_epochs):
        results = run_processing(engines, data, epoch)   # Phase 1
        metrics = run_optimization(engines, results)      # Phase 2
        save_and_refresh(engines, config, epoch)          # Phase 3
```

---

## Pattern 6: Schema Separated from Logic

Data definitions (what fields exist) must be separate from behavior (what to do with them).

```
configs/
├── schema.py    # Pydantic models only, zero logic
├── sync.py      # Config synchronization / derivation logic
└── loader.py    # File I/O + verification
```

---

## Pattern 7: Zero-Hallucination Contracts

Use validators to prevent invalid configurations:
```python
class WorkerConfig(BaseModel):
    model_config = ConfigDict(extra='forbid')  # reject unknown fields
    num_workers: int = Field(default=8, ge=1, le=64)
    timeout_sec: int = Field(default=30, gt=0, le=3600)
```

---

## Pattern 8: Dict Dispatch over Factory Patterns

```python
ALGORITHMS = {
    "variant_a": ClassA, "variant_b": ClassA,
    "variant_c": ClassB,
}
alg = ALGORITHMS[config.algorithm_name.lower()]
```

---

## Pattern 9: Feedback Loops with Measurable Outcomes

Design feedback at multiple tiers:
```
MICRO (per step):   NaN detection, gradient explosion, metric collapse -> halt or warn
MACRO (per epoch):  Stagnation detection, divergence trends            -> suggest config changes
SYSTEM (per run):   OOM, timeout, crash                                -> auto-retry with adjusted params
```
