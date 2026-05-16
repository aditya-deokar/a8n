/**
 * Execution Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListExecutions, registerGetExecution } from "./execution-tools";

export function registerExecutionTools(server: McpServer) {
  registerListExecutions(server);
  registerGetExecution(server);
}
