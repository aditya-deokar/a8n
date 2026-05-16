/**
 * Prompt Registry
 *
 * Registers all MCP prompts — guided templates that help LLMs
 * walk users through complex multi-step operations.
 *
 * Prompts (3):
 *   - create_workflow     → Step-by-step workflow builder
 *   - debug_execution     → Execution failure diagnosis
 *   - setup_integration   → Integration setup guides
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateWorkflowPrompt } from "./create-workflow.prompt";
import { registerDebugExecutionPrompt } from "./debug-execution.prompt";
import { registerSetupIntegrationPrompt } from "./setup-integration.prompt";

export function registerAllPrompts(server: McpServer): void {
  registerCreateWorkflowPrompt(server);
  registerDebugExecutionPrompt(server);
  registerSetupIntegrationPrompt(server);

  console.log("[MCP] 3 prompts registered");
}
