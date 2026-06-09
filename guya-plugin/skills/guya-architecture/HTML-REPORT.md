# HTML Report Format

The architectural review is rendered as a single self-contained HTML file in the OS temp directory — nothing lands in the repo. Tailwind and Mermaid both come from CDNs. Mermaid handles graph-shaped diagrams reliably; hand-built divs and inline SVG handle the more editorial visuals (mass diagrams, cross-sections). Mix the two — don't lean on Mermaid for everything, it starts to look generic.

The diagrams carry the weight. If a diagram needs a paragraph to be understood, redraw the diagram.

## Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* small custom layer for things Tailwind doesn't cover cleanly:
         dashed seam lines, hand-drawn-feeling arrow heads, etc. */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header

Repo name, date, and a compact legend: solid box = module, dashed line = seam, red arrow = leakage, thick dark box = deep module. No introduction paragraph — straight into the candidates.

## Candidate card

Each candidate is one `<article>`:

- **Title** — short, names the deepening (e.g. "Collapse the Order intake pipeline").
- **Badge row** — recommendation strength (`Strong` = emerald, `Worth exploring` = amber, `Speculative` = slate), plus a tag for the dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock` — see DEEPENING.md).
- **Files** — monospaced list, `font-mono text-sm`. Use the names the code uses.
- **Before / After diagram** — the centrepiece. Two columns, side by side. Patterns below.
- **Problem** — one sentence. What hurts.
- **Solution** — one sentence. What changes.
- **Wins** — bullets, ≤6 words each, in glossary terms. e.g. "locality: bugs land in one module", "leverage: one interface, 4 call sites", "interface shrinks; implementation absorbs the wrappers".
- **ADR callout** (if applicable) — one line in an amber-tinted box: *"contradicts ADR-0NN — worth reopening because…"*. Only when the friction genuinely warrants reopening the ADR.

No paragraphs of explanation. If a sentence could be a bullet, make it a bullet.

## Diagram patterns

Pick the pattern that fits each candidate. Mix them — don't make every diagram look the same.

### Mermaid graph (the workhorse for dependencies / call flow)
Use a `flowchart` / `graph` when the point is "X calls Y calls Z, look at the mess." Wrap it in a Tailwind card. Use `classDef` to colour leakage edges red and the deep module dark. Sequence diagrams work well for "before: 6 round-trips; after: 1."

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### Hand-built boxes-and-arrows (when Mermaid's layout fights you)
Modules as `<div>`s with borders and labels; arrows as inline SVG `<line>`/`<path>` over a relative container. Reach for this when the "after" should feel like one thick-bordered deep module with greyed-out internals — Mermaid won't render that with the right weight.

### Cross-section (good for layered shallowness)
Stack horizontal bands (`h-12 border-l-4`) to show layers a call passes through. Before: 6 thin layers each doing nothing. After: 1 thick band labelled with the consolidated responsibility.

### Mass diagram (good for "interface as wide as implementation")
Two rectangles per module — interface surface area vs implementation. Before: interface rectangle nearly as tall as implementation (shallow). After: interface short, implementation tall (deep). This is the single clearest picture of depth — favour it.

### Call-graph collapse
Before: a tree of function calls as nested boxes. After: the same tree collapsed into one box, the now-internal calls shown faded inside it.

## Style guidance

- Lean editorial, not corporate-dashboard. Generous whitespace. Serif optional for headings (`font-serif` with stone/slate).
- Colour sparingly: one accent (emerald or indigo) plus red for leakage and amber for warnings.
- Keep diagrams ~320px tall so before/after sits side by side without scrolling.
- `text-xs uppercase tracking-wider` for module labels inside diagrams — schematic, not UI.
- Only scripts are the Tailwind CDN and the Mermaid import. Otherwise static — no app code, no interactivity beyond Mermaid.

## Top recommendation section

One larger card. Candidate name, one sentence on why, anchor link to its card. That's it.

## Tone — glossary discipline

Plain English, concise — but the architectural nouns and verbs come straight from [LANGUAGE.md](LANGUAGE.md).

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings that fit:**
- "Order intake module is shallow — interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

Don't write *"easier to maintain"* or *"cleaner code"* — those aren't in the glossary and don't earn their place. No hedging, no "it's worth noting that…". If a term isn't in [LANGUAGE.md](LANGUAGE.md), reach for one that is before inventing a new one.

> Provenance: HTML-report format adapted from Matt Pocock's `improve-codebase-architecture` skill.
