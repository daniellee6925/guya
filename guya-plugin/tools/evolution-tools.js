/**
 * evolution-tools.js — Guya guideline evolution MCP tools
 *
 * CALLING SPEC:
 *   registerEvolutionTools(server) -> void
 *   Registers 3 tools onto the McpServer instance:
 *     evolve_consolidate({ dryRun?: boolean }) -> consolidation report text
 *     evolve_status()                          -> status summary text
 *     evolve_force_synthesize()                -> unclassified traces text
 *
 * Side effects: reads/writes to ~/.claude/guya/guidelines/strategic/ and
 *               .guya/evolution/ under process.cwd()
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  statSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import matter from "gray-matter";
import { z } from "zod";

// --- helpers ---

function strategicDir() {
  return join(homedir(), ".claude", "guya", "guidelines", "strategic");
}

function tacticalDir() {
  return join(process.cwd(), ".guya", "evolution", "guidelines", "tactical");
}

function tracesDir() {
  return join(process.cwd(), ".guya", "evolution", "traces");
}

function reflectionsDir() {
  return join(process.cwd(), ".guya", "memory", "reflections");
}

function nowISO() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function collectMdFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => join(dir, e.name));
}

function readGuideline(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    return { filePath, data: parsed.data, content: parsed.content, raw };
  } catch {
    return null;
  }
}

function writeGuideline(filePath, data, content) {
  const output = matter.stringify(content, data);
  ensureDir(join(filePath, ".."));
  writeFileSync(filePath, output, "utf8");
}

/** Word set from text for overlap calculation. */
function wordSet(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

/** Jaccard overlap between two word sets. */
function overlap(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared++;
  return shared / Math.min(setA.size, setB.size);
}

function daysSince(isoString) {
  if (!isoString) return 9999;
  const ms = Date.now() - new Date(isoString).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function recencyWeight(isoString) {
  const days = daysSince(isoString);
  // decays from 1.0 to 0.5 over 90 days
  return 0.5 + 0.5 * Math.max(0, 1 - days / 90);
}

// --- consolidation logic ---

function runConsolidation(strategicFiles, tacticalFiles, dryRun) {
  const strategic = strategicFiles.map(readGuideline).filter(Boolean);
  const tactical = tacticalFiles.map(readGuideline).filter(Boolean);

  const report = {
    merged: [],
    pruned: [],
    promoted: [],
    reranked: [],
    dryRun,
  };

  // --- Step 1: merge overlapping guidelines within strategic ---
  const strategicActive = [...strategic];
  const absorbed = new Set();

  for (let i = 0; i < strategicActive.length; i++) {
    if (absorbed.has(i)) continue;
    const a = strategicActive[i];
    const wordsA = wordSet(a.content);

    for (let j = i + 1; j < strategicActive.length; j++) {
      if (absorbed.has(j)) continue;
      const b = strategicActive[j];
      const wordsB = wordSet(b.content);

      if (overlap(wordsA, wordsB) > 0.5) {
        // keep higher confidence, absorb lower
        const confA = a.data.confidence ?? 0;
        const confB = b.data.confidence ?? 0;
        const [keeper, loser, loserIdx] =
          confA >= confB ? [a, b, j] : [b, a, i];

        const mergedSources = [
          ...(keeper.data.sources || []),
          ...(loser.data.sources || []),
        ].filter((v, idx, arr) => arr.indexOf(v) === idx);

        const absorbedIds = [
          ...(keeper.data.absorbedIds || []),
          loser.data.id || loser.filePath,
        ];

        report.merged.push({
          kept: keeper.filePath,
          absorbed: loser.filePath,
          overlapScore: overlap(wordsA, wordsB).toFixed(2),
        });

        if (!dryRun) {
          writeGuideline(keeper.filePath, {
            ...keeper.data,
            sources: mergedSources,
            absorbedIds,
            updatedAt: nowISO(),
          }, keeper.content);
          unlinkSync(loser.filePath);
        }

        absorbed.add(loserIdx);
      }
    }
  }

  // --- Step 2: prune low-confidence stale guidelines ---
  const allActive = [
    ...strategicActive.filter((_, i) => !absorbed.has(i)),
    ...tactical,
  ];

  for (const g of allActive) {
    const conf = g.data.confidence ?? 1;
    const stale = daysSince(g.data.lastValidated) > 30;
    if (conf < 0.5 && stale) {
      report.pruned.push({ file: g.filePath, confidence: conf });
      if (!dryRun) {
        unlinkSync(g.filePath);
      }
    }
  }

  const pruned = new Set(report.pruned.map((p) => p.file));

  // --- Step 3: promote high-confidence tactical guidelines ---
  for (const g of tactical) {
    if (pruned.has(g.filePath)) continue;
    const conf = g.data.confidence ?? 0;
    if (conf >= 0.85) {
      const basename = g.filePath.split("/").pop();
      const dest = join(strategicDir(), basename);
      report.promoted.push({ from: g.filePath, to: dest });
      if (!dryRun) {
        ensureDir(strategicDir());
        writeGuideline(dest, { ...g.data, promotedAt: nowISO() }, g.content);
        unlinkSync(g.filePath);
      }
    }
  }

  // --- Step 4: re-rank strategic guidelines by confidence * recency ---
  const remaining = strategicActive
    .filter((g, i) => !absorbed.has(i) && !pruned.has(g.filePath))
    .map((g) => ({
      ...g,
      score: (g.data.confidence ?? 0.5) * recencyWeight(g.data.lastValidated),
    }))
    .sort((a, b) => b.score - a.score);

  remaining.forEach((g, idx) => {
    const newRank = idx + 1;
    if (g.data.rank !== newRank) {
      report.reranked.push({ file: g.filePath, oldRank: g.data.rank, newRank });
      if (!dryRun) {
        writeGuideline(g.filePath, { ...g.data, rank: newRank }, g.content);
      }
    }
  });

  return report;
}

// --- registration ---

export function registerEvolutionTools(server) {

  // 1. evolve_consolidate
  server.tool(
    "evolve_consolidate",
    "Consolidate guidelines: merge overlapping, prune stale low-confidence, promote high-confidence tactical to strategic, re-rank by score.",
    {
      dryRun: z.boolean().optional().describe("If true, return what would happen without modifying files. Defaults to false."),
    },
    async ({ dryRun = false } = {}) => {
      const strategicFiles = collectMdFiles(strategicDir());
      const tacticalFiles = collectMdFiles(tacticalDir());
      const report = runConsolidation(strategicFiles, tacticalFiles, dryRun);

      const lines = [
        `evolve_consolidate — ${dryRun ? "DRY RUN" : "APPLIED"} — ${nowISO()}`,
        `Strategic guidelines: ${strategicFiles.length}`,
        `Tactical guidelines: ${tacticalFiles.length}`,
        "",
        `Merged: ${report.merged.length}`,
        ...report.merged.map(
          (m) => `  kept ${m.kept} | absorbed ${m.absorbed} (overlap ${m.overlapScore})`
        ),
        "",
        `Pruned: ${report.pruned.length}`,
        ...report.pruned.map((p) => `  ${p.file} (confidence ${p.confidence})`),
        "",
        `Promoted: ${report.promoted.length}`,
        ...report.promoted.map((p) => `  ${p.from} -> ${p.to}`),
        "",
        `Re-ranked: ${report.reranked.length}`,
        ...report.reranked.map(
          (r) => `  ${r.file}: rank ${r.oldRank ?? "?"} -> ${r.newRank}`
        ),
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 2. evolve_status
  server.tool(
    "evolve_status",
    "Return current evolution status: guideline counts, trace counts, last consolidation and reflection timestamps.",
    {},
    async () => {
      const strategicFiles = collectMdFiles(strategicDir());
      const tacticalFiles = collectMdFiles(tacticalDir());

      // count trace files and today's lines
      const tracesDirPath = tracesDir();
      let traceFileCount = 0;
      let todayTraceCount = 0;
      const today = new Date().toISOString().slice(0, 10);

      if (existsSync(tracesDirPath)) {
        const traceFiles = readdirSync(tracesDirPath, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
          .map((e) => join(tracesDirPath, e.name));
        traceFileCount = traceFiles.length;

        const todayFile = join(tracesDirPath, `${today}.jsonl`);
        if (existsSync(todayFile)) {
          const lines = readFileSync(todayFile, "utf8")
            .split("\n")
            .filter((l) => l.trim().length > 0);
          todayTraceCount = lines.length;
        }
      }

      // find most recent reflection
      let lastReflection = null;
      const refDir = reflectionsDir();
      if (existsSync(refDir)) {
        const refFiles = readdirSync(refDir, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith(".md"))
          .map((e) => ({ name: e.name, path: join(refDir, e.name) }))
          .sort((a, b) => b.name.localeCompare(a.name));
        if (refFiles.length > 0) {
          lastReflection = statSync(refFiles[0].path).mtime.toISOString();
        }
      }

      // find last consolidation from strategic frontmatter updatedAt
      let lastConsolidation = null;
      for (const f of strategicFiles) {
        const g = readGuideline(f);
        if (g?.data?.updatedAt) {
          if (!lastConsolidation || g.data.updatedAt > lastConsolidation) {
            lastConsolidation = g.data.updatedAt;
          }
        }
      }

      const status = {
        strategicCount: strategicFiles.length,
        tacticalCount: tacticalFiles.length,
        traceFileCount,
        todayTraceCount,
        lastConsolidation: lastConsolidation ?? "unknown",
        lastReflection: lastReflection ?? "unknown",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    }
  );

  // 3. evolve_force_synthesize
  server.tool(
    "evolve_force_synthesize",
    "Surface all unclassified traces from .guya/evolution/traces/*.jsonl so the agent can classify them manually.",
    {},
    async () => {
      const tracesDirPath = tracesDir();
      if (!existsSync(tracesDirPath)) {
        return {
          content: [{ type: "text", text: "No traces directory found at .guya/evolution/traces/" }],
        };
      }

      const jsonlFiles = readdirSync(tracesDirPath, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
        .map((e) => join(tracesDirPath, e.name))
        .sort();

      if (jsonlFiles.length === 0) {
        return {
          content: [{ type: "text", text: "No .jsonl trace files found." }],
        };
      }

      const unclassified = [];

      for (const filePath of jsonlFiles) {
        let raw;
        try {
          raw = readFileSync(filePath, "utf8");
        } catch {
          continue;
        }

        const lines = raw.split("\n").filter((l) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (!entry.classified) {
              unclassified.push({ file: filePath, entry });
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (unclassified.length === 0) {
        return {
          content: [{ type: "text", text: "All traces are classified." }],
        };
      }

      const text = [
        `Found ${unclassified.length} unclassified trace(s):`,
        "",
        ...unclassified.map(
          ({ file, entry }) =>
            `[${file.replace(process.cwd() + "/", "")}]\n${JSON.stringify(entry, null, 2)}`
        ),
      ].join("\n\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
