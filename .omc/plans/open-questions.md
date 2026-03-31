# Open Questions

## guya-architecture - 2026-03-30

- [ ] **soul.md authoring**: Should Daniel write soul.md from scratch, or should Guya propose a draft during bootstrap that Daniel edits? — Affects Phase 1 vs Phase 6 ordering and the bootstrap experience.
- [ ] **Token budget for identity vs guidelines**: The 4K token budget is split across identity files, core memory, and guidelines. What is the right ratio? — Too many guidelines crowd out identity; too much identity leaves no room for learned behavior.
- [ ] **Correction detection heuristics**: The trace capture hook uses keyword matching ("no", "wrong", "actually") to detect corrections. This will produce false positives. Should classification handle denoising, or should the heuristics be more sophisticated? — Affects learning quality and noise in the SCOPE pipeline.
- [ ] **Cross-project memory**: Should Guya's memory be project-scoped or global? user.md and strategic guidelines should be global, but some context is project-specific. — Affects file placement (project dir vs ~/.guya/) and context assembly logic.
- [ ] **Hook timeout for synthesis**: SessionEnd has 30s timeout. LLM-based synthesis (sonnet-tier) may exceed this for large trace batches. Should synthesis move to the MCP server as an async call? — Affects Phase 4 architecture.
- [ ] **Guideline cap**: What is the maximum number of strategic guidelines before consolidation is forced? 100 is proposed but arbitrary. — Affects context window usage and consolidation frequency.
- [ ] **Chroma dependency**: claude-mem's Chroma is used for archival semantic search. If Chroma is not running, should Guya degrade gracefully to keyword search on markdown files? — Affects robustness of archival memory tier.
- [ ] **MCP server runtime**: Should the Guya MCP server use Bun (matching claude-mem) or Node.js? — Affects deployment consistency and available libraries.
