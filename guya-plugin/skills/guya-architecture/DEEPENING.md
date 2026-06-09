# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**.

The dependency category determines *how the deepened module is tested across its seam* — which is the whole point of deepening (testability). Classify the candidate's dependencies before you propose a shape.

## Dependency categories

### 1. In-process
Pure computation, in-memory state, no I/O. **Always deepenable** — merge the modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable
Dependencies with local test stand-ins (PGLite for Postgres, an in-memory filesystem, a fake clock). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the suite. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)
Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter; production uses an HTTP/gRPC/queue adapter.

> Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external (Mock)
Third-party services you don't control (Stripe, Twilio, the Anthropic API, Discord). The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection — interface cost with no leverage.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them — that leaks implementation into the interface and re-shallows the module.

## Testing strategy: replace, don't layer

- Old unit tests on the shallow modules become **waste** once tests at the deepened module's interface exist — delete them, don't keep both.
- Write new tests at the deepened module's interface. **The interface is the test surface.**
- Tests assert on observable outcomes *through the interface*, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes (but behaviour didn't), it's testing past the interface.

> This is the input the `/guya-decision-refactor` hand-off needs: the dependency category tells that harness what the behaviour-preservation contract and the new test seam look like.
