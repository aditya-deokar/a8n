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
import { registerIntegrationTools } from "./integrations";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { isChatGptAppProfile } from "@/mcp/app-profile";
import { CHATGPT_APP_TOOL_COUNT } from "@/mcp/safety/app-tool-policy";
import { registerChatGptAppTools } from "./chatgpt-profile";

/**
 * Register all MCP tools from all domains.
 *
 * Tool count: 53
 *   - Workflows:   23 (CRUD, execution, drafts, safe partial edits, versions)
 *   - Credentials: 6 (list, get, create, update, delete, list-by-type)
 *   - Executions:  8 (list, get, wait, tests, timeline, diagnosis, repair)
 *   - Nodes:       2 (list-node-types, search-capabilities)
 *   - System:      5 (whoami, server-info, health-check, security, audit)
 *   - API Keys:    3 (create, list, revoke)
 *   - Integrations: 6 (setup checklists, guides, webhooks, credential tests)
 */
export function registerAllTools(
  server: McpServer,
  context: McpToolContext = {},
): void {
  if (isChatGptAppProfile(context.appProfile)) {
    registerChatGptAppTools(server, context);
    console.log(`[MCP] ${CHATGPT_APP_TOOL_COUNT} ChatGPT app tools registered`);
    return;
  }

  registerWorkflowTools(server, context);
  registerCredentialTools(server, context);
  registerExecutionTools(server, context);
  registerNodeTools(server, context);
  registerSystemTools(server, context);
  registerApiKeyTools(server, context);
  registerIntegrationTools(server, context);

  console.log("[MCP] 53 tools registered across 7 domains");
}
