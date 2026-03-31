/**
 * introspection-tools.js — Guya self-inspection MCP tools
 *
 * CALLING SPEC:
 *   registerIntrospectionTools(server) -> void
 *   Registers 3 tools onto the McpServer instance:
 *     guya_status()              -> formatted status summary text
 *     guya_guidelines()          -> list of strategic guidelines text
 *     guya_traces({ date? })     -> last 20 trace entries text
 *
 * Side effects: reads from ~/.claude/guya/ and .guya/ under process.cwd()
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import matter from "gray-matter";

// --- helpers ---

function globalGuyaDir() {
  return join(homedir(), ".claude", "guya");
}

function projectGuyaDir() {
  return join(process.cwd(), ".guya");
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => !f.startsWith(".")).length;
  } catch {
    return 0;
  }
}

function countMdFiles(dir) {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function readFileSafe(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function listMdFiles(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function countTodayTraceLines(tracesDir) {
  const today = todayYMD();
  const filePath = join(tracesDir, `${today}.jsonl`);
  const raw = readFileSafe(filePath);
  if (!raw) return 0;
  return raw.split("\n").filter((l) => l.trim()).length;
}

// --- registration ---

export function registerIntrospectionTools(server) {

  // 1. guya_status
  server.tool(
    "guya_status",
    "Show Guya's current memory and identity status across global and project-local stores.",
    {},
    async () => {
      const globalDir = globalGuyaDir();
      const projectDir = projectGuyaDir();

      const identityCount = countFiles(globalDir);
      const coreBlockCount = countMdFiles(join(projectDir, "memory", "core"));
      const guidelineCount = countMdFiles(join(globalDir, "guidelines", "strategic"));
      const tracesDir = join(projectDir, "evolution", "traces");
      const traceFileCount = countFiles(tracesDir);
      const todayTraceLines = countTodayTraceLines(tracesDir);

      const lines = [
        `Guya Status — ${new Date().toISOString()}`,
        ``,
        `Global identity (~/.claude/guya/)`,
        `  Files:       ${identityCount}`,
        `  Guidelines:  ${guidelineCount} strategic`,
        ``,
        `Project local (.guya/)`,
        `  Core blocks: ${coreBlockCount}`,
        `  Trace files: ${traceFileCount}`,
        `  Today lines: ${todayTraceLines}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 2. guya_guidelines
  server.tool(
    "guya_guidelines",
    "List all strategic guidelines with their domain, confidence, rank, and first line of body.",
    {},
    async () => {
      const strategicDir = join(globalGuyaDir(), "guidelines", "strategic");
      const files = listMdFiles(strategicDir);

      if (files.length === 0) {
        return { content: [{ type: "text", text: "No strategic guidelines found." }] };
      }

      const entries = [];
      for (const filePath of files) {
        const raw = readFileSafe(filePath);
        if (!raw) continue;

        let fm = {};
        let body = raw;
        try {
          const parsed = matter(raw);
          fm = parsed.data || {};
          body = parsed.content || raw;
        } catch {
          // no frontmatter — use raw as body
        }

        const firstLine = body.trim().split("\n").find((l) => l.trim()) || "";
        const rel = filePath.replace(homedir(), "~");

        const parts = [
          `File:       ${rel}`,
          `Domain:     ${fm.domain ?? "(unset)"}`,
          `Confidence: ${fm.confidence ?? "(unset)"}`,
          `Rank:       ${fm.rank ?? "(unset)"}`,
          `Preview:    ${firstLine.slice(0, 120)}`,
        ];
        entries.push(parts.join("\n"));
      }

      return { content: [{ type: "text", text: entries.join("\n\n---\n\n") }] };
    }
  );

  // 3. guya_traces
  server.tool(
    "guya_traces",
    "Show the last 20 trace entries for a given date (defaults to today).",
    {
      date: { type: "string", description: "Date in YYYY-MM-DD format (optional, defaults to today)" },
    },
    async ({ date } = {}) => {
      const targetDate = date || todayYMD();
      const filePath = join(projectGuyaDir(), "evolution", "traces", `${targetDate}.jsonl`);
      const raw = readFileSafe(filePath);

      if (!raw) {
        return { content: [{ type: "text", text: `No trace file found for ${targetDate}.` }] };
      }

      const lines = raw.split("\n").filter((l) => l.trim());
      const last20 = lines.slice(-20);

      const formatted = last20.map((line, i) => {
        try {
          const obj = JSON.parse(line);
          return `[${lines.length - last20.length + i + 1}] ${JSON.stringify(obj, null, 2)}`;
        } catch {
          return `[${lines.length - last20.length + i + 1}] ${line}`;
        }
      });

      const header = `Traces for ${targetDate} (showing last ${last20.length} of ${lines.length} entries)`;
      return { content: [{ type: "text", text: `${header}\n\n${formatted.join("\n\n")}` }] };
    }
  );
}
