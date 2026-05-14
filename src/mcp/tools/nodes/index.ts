/**
 * Node Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListNodeTypes } from "./node-tools";

export function registerNodeTools(server: McpServer) {
  registerListNodeTypes(server);
}
