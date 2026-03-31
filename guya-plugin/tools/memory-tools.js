/**
 * memory-tools.js — Guya memory self-editing MCP tools
 *
 * CALLING SPEC:
 *   registerMemoryTools(server) -> void
 *   Registers 6 tools onto the McpServer instance:
 *     memory_core_update(block, content)    -> success text
 *     memory_core_append(block, content)    -> success text
 *     memory_recall_note(note)              -> success text
 *     memory_archival_store(domain, title, content) -> success text
 *     memory_archival_search(query)         -> matching lines text
 *     memory_reflect(reflection)            -> success text
 *
 * Side effects: reads/writes to .guya/ under process.cwd()
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, renameSync, existsSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

// --- helpers ---

function guyaDir() {
  return join(process.cwd(), ".guya");
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function atomicWrite(filePath, content) {
  ensureDir(dirname(filePath));
  const tmp = join(tmpdir(), `guya-${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

function nowISO() {
  return new Date().toISOString();
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function collectMdFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// --- registration ---

export function registerMemoryTools(server) {

  // 1. memory_core_update
  server.tool(
    "memory_core_update",
    "Overwrite a core memory block with new content (atomic write).",
    {
      block: { type: "string", description: "Block name, e.g. 'active-projects'" },
      content: { type: "string", description: "New full content for the block" },
    },
    async ({ block, content }) => {
      const filePath = join(guyaDir(), "memory", "core", `${block}.md`);
      atomicWrite(filePath, content);
      return { content: [{ type: "text", text: `Updated core/${block}.md` }] };
    }
  );

  // 2. memory_core_append
  server.tool(
    "memory_core_append",
    "Append content to a core memory block, creating it if it does not exist.",
    {
      block: { type: "string", description: "Block name, e.g. 'active-projects'" },
      content: { type: "string", description: "Content to append" },
    },
    async ({ block, content }) => {
      const filePath = join(guyaDir(), "memory", "core", `${block}.md`);
      ensureDir(dirname(filePath));
      appendFileSync(filePath, content, "utf8");
      return { content: [{ type: "text", text: `Appended to core/${block}.md` }] };
    }
  );

  // 3. memory_recall_note
  server.tool(
    "memory_recall_note",
    "Append a timestamped note to the session-context core block.",
    {
      note: { type: "string", description: "The note to record" },
    },
    async ({ note }) => {
      const filePath = join(guyaDir(), "memory", "core", "session-context.md");
      ensureDir(dirname(filePath));
      const line = `\n<!-- ${nowISO()} -->\n${note}\n`;
      appendFileSync(filePath, line, "utf8");
      return { content: [{ type: "text", text: `Note recorded in core/session-context.md` }] };
    }
  );

  // 4. memory_archival_store
  server.tool(
    "memory_archival_store",
    "Store a titled section in an archival domain file.",
    {
      domain: { type: "string", description: "Domain name, e.g. 'typescript-patterns'" },
      title: { type: "string", description: "Section title" },
      content: { type: "string", description: "Section content" },
    },
    async ({ domain, title, content }) => {
      const filePath = join(guyaDir(), "memory", "archival", `${domain}.md`);
      ensureDir(dirname(filePath));
      const section = `\n## ${title}\n\n_Stored: ${nowISO()}_\n\n${content}\n`;
      appendFileSync(filePath, section, "utf8");
      return { content: [{ type: "text", text: `Stored in archival/${domain}.md under "${title}"` }] };
    }
  );

  // 5. memory_archival_search
  server.tool(
    "memory_archival_search",
    "Search all archival memory files for a substring (case-insensitive). Returns up to 20 matching lines with file and line number.",
    {
      query: { type: "string", description: "Search term" },
    },
    async ({ query }) => {
      const archivalDir = join(guyaDir(), "memory", "archival");
      const files = collectMdFiles(archivalDir);
      const lowerQuery = query.toLowerCase();
      const matches = [];

      for (const file of files) {
        if (matches.length >= 20) break;
        let lines;
        try {
          lines = readFileSync(file, "utf8").split("\n");
        } catch {
          continue;
        }
        const rel = file.replace(process.cwd() + "/", "");
        for (let i = 0; i < lines.length && matches.length < 20; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            matches.push(`${rel}:${i + 1}: ${lines[i]}`);
          }
        }
      }

      const text = matches.length
        ? matches.join("\n")
        : `No matches found for "${query}" in archival memory.`;

      return { content: [{ type: "text", text }] };
    }
  );

  // 6. memory_reflect
  server.tool(
    "memory_reflect",
    "Write a timestamped reflection file to the reflections directory.",
    {
      reflection: { type: "string", description: "The reflection text" },
    },
    async ({ reflection }) => {
      const ts = Date.now();
      const date = todayYMD();
      const fileName = `${date}-${ts}.md`;
      const filePath = join(guyaDir(), "memory", "reflections", fileName);
      ensureDir(dirname(filePath));
      const body = `# Reflection — ${nowISO()}\n\n${reflection}\n`;
      writeFileSync(filePath, body, "utf8");
      return { content: [{ type: "text", text: `Reflection written to memory/reflections/${fileName}` }] };
    }
  );
}
