# Last Session Context

## Gaps to Fix
- **Guya agents should be real agents, not prompt templates.** Currently guya-observer, guya-synthesizer, guya-reflector, guya-consolidator are just markdown prompts read by the SessionEnd hook for API calls. They should be real spawnable OMC agents with isolated contexts so they can be invoked manually (e.g., "run the observer on today's traces") and composed into workflows.
- **Trace JSONL has no auto-pruning.** Files grow forever. Should prune after classification and cap file size at 5MB.
- **Trace capture was writing "Tool: unknown"** — fixed with snake_case field names, but needs verification in a live session.
- **Intent detection hook (UserPromptSubmit)** — when Daniel mentions a project or topic, preload relevant context from archival memory before Claude responds. Anticipatory, not reactive. E.g., "sdf optimizer" → inject SDF project context + optimizer phase details automatically. **BLOCKED: no archival memory exists yet. Build this after archival memory has real content.**
