/**
 * System Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWhoami, registerServerInfo, registerHealthCheck } from "./system-tools";

export function registerSystemTools(server: McpServer) {
  registerWhoami(server);
  registerServerInfo(server);
  registerHealthCheck(server);
}
