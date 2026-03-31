/**
 * identity-tools.js — Guya identity file read/propose MCP tools
 *
 * CALLING SPEC:
 *   registerIdentityTools(server) -> void
 *   Registers 2 tools onto the McpServer instance:
 *     identity_propose_change(file, proposedContent, reason) -> confirmation text
 *     identity_read(file)                                    -> file contents text
 *
 * Side effects:
 *   identity_propose_change: writes to .guya/evolution/proposals/ under process.cwd()
 *   identity_read: reads from ~/.claude/guya/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- helpers ---

const ALLOWED_PROPOSE_FILES = new Set(["soul.md", "creed.md", "identity.md"]);
const ALLOWED_READ_FILES = new Set(["soul.md", "creed.md", "identity.md", "user.md"]);

function guyaGlobalDir() {
  return join(homedir(), ".claude", "guya");
}

function proposalsDir() {
  return join(process.cwd(), ".guya", "evolution", "proposals");
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function nowISO() {
  return new Date().toISOString();
}

function safeTimestamp() {
  return nowISO().replace(/[:.]/g, "-");
}

// --- registration ---

export function registerIdentityTools(server) {

  // 1. identity_propose_change
  server.tool(
    "identity_propose_change",
    "Propose a change to a core identity file (soul.md, creed.md, identity.md). Writes a proposal file for Daniel's review — does not modify the identity file directly.",
    {
      file: {
        type: "string",
        description: "Identity file to propose changing. Must be one of: soul.md, creed.md, identity.md",
      },
      proposedContent: {
        type: "string",
        description: "The full proposed new content for the file",
      },
      reason: {
        type: "string",
        description: "Why this change is being proposed",
      },
    },
    async ({ file, proposedContent, reason }) => {
      if (!ALLOWED_PROPOSE_FILES.has(file)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: file must be one of: ${[...ALLOWED_PROPOSE_FILES].join(", ")}. Got: "${file}"`,
            },
          ],
        };
      }

      const ts = safeTimestamp();
      const stem = file.replace(".md", "");
      const proposalName = `${stem}-${ts}.md`;
      const dir = proposalsDir();
      ensureDir(dir);

      const proposalPath = join(dir, proposalName);
      const body = [
        `# Proposed change to ${file}`,
        "",
        "## Reason",
        reason,
        "",
        "## Proposed content",
        proposedContent,
        "",
        "## Status",
        "Pending Daniel's review",
        "",
        `_Proposed at: ${nowISO()}_`,
      ].join("\n");

      writeFileSync(proposalPath, body, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `Proposal saved to .guya/evolution/proposals/${proposalName}`,
          },
        ],
      };
    }
  );

  // 2. identity_read
  server.tool(
    "identity_read",
    "Read a core identity file from ~/.claude/guya/. Allowed files: soul.md, creed.md, identity.md, user.md",
    {
      file: {
        type: "string",
        description: "Identity file to read. Must be one of: soul.md, creed.md, identity.md, user.md",
      },
    },
    async ({ file }) => {
      if (!ALLOWED_READ_FILES.has(file)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: file must be one of: ${[...ALLOWED_READ_FILES].join(", ")}. Got: "${file}"`,
            },
          ],
        };
      }

      const filePath = join(guyaGlobalDir(), file);

      if (!existsSync(filePath)) {
        return {
          content: [
            {
              type: "text",
              text: `File not found: ${filePath}`,
            },
          ],
        };
      }

      let contents;
      try {
        contents = readFileSync(filePath, "utf8");
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading ${filePath}: ${err.message}`,
            },
          ],
        };
      }

      return { content: [{ type: "text", text: contents }] };
    }
  );
}
