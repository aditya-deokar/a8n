/**
 * Node Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { registerListNodeTypes, registerSearchCapabilities } from "./node-tools";

export function registerNodeTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerListNodeTypes(server, context);
  registerSearchCapabilities(server, context);
}
