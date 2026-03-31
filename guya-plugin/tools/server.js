/**
 * guya-plugin MCP server entry point
 *
 * CALLING SPEC:
 *   Start: node tools/server.js   (stdio transport)
 *   Tools registered:
 *     - guya_status()  -> { status: "ok", version: "0.1.0" }
 *     - (memory-tools and introspection-tools loaded conditionally when present)
 *     - evolution-tools: evolve_consolidate, evolve_status, evolve_force_synthesize
 *     - identity-tools: identity_propose_change, identity_read
 *
 * Side effects: writes to stdout (MCP protocol messages)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerEvolutionTools } from "./evolution-tools.js";
import { registerIdentityTools } from "./identity-tools.js";

const SERVER_NAME = "guya-tools";
const SERVER_VERSION = "0.1.0";

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// --- Core status tool ---
server.tool(
  "guya_status",
  "Returns the current status and version of the Guya plugin MCP server.",
  {},
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ status: "ok", version: SERVER_VERSION }),
      },
    ],
  })
);

// --- Conditionally load memory-tools ---
try {
  const { registerMemoryTools } = await import("./memory-tools.js");
  registerMemoryTools(server);
} catch {
  // memory-tools.js not yet present — skipping
}

// --- Conditionally load introspection-tools ---
try {
  const { registerIntrospectionTools } = await import(
    "./introspection-tools.js"
  );
  registerIntrospectionTools(server);
} catch {
  // introspection-tools.js not yet present — skipping
}

// --- Load evolution-tools ---
registerEvolutionTools(server);

// --- Load identity-tools ---
registerIdentityTools(server);

// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);
