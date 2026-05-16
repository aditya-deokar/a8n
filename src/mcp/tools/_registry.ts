/**
 * Tool Registry
 *
 * Central registration point for all MCP tools. Each domain module
 * exports a `registerXTools(server)` function that registers its tools.
 *
 * To add a new tool domain:
 *   1. Create a folder in /tools/ (e.g., /tools/billing/)
 *   2. Add tool files and an index.ts barrel export
 *   3. Import and call the register function here
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkflowTools } from "./workflows";
import { registerCredentialTools } from "./credentials";
import { registerExecutionTools } from "./executions";
import { registerNodeTools } from "./nodes";
import { registerSystemTools } from "./system";
import { registerApiKeyTools } from "./api-keys";

/**
 * Register all MCP tools from all domains.
 *
 * Tool count: 22
 *   - Workflows:   7 (list, get, create, update, rename, delete, execute)
 *   - Credentials: 6 (list, get, create, update, delete, list-by-type)
 *   - Executions:  2 (list, get)
 *   - Nodes:       1 (list-node-types)
 *   - System:      3 (whoami, server-info, health-check)
 *   - API Keys:    3 (create, list, revoke)
 */
export function registerAllTools(server: McpServer): void {
  registerWorkflowTools(server);
  registerCredentialTools(server);
  registerExecutionTools(server);
  registerNodeTools(server);
  registerSystemTools(server);
  registerApiKeyTools(server);

  console.log("[MCP] 22 tools registered across 6 domains");
}
