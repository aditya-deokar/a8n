/**
 * Workflow Tools — Barrel Export
 *
 * Registers all 7 workflow-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListWorkflows } from "./list-workflows.tool";
import { registerGetWorkflow } from "./get-workflow.tool";
import { registerCreateWorkflow } from "./create-workflow.tool";
import { registerUpdateWorkflow } from "./update-workflow.tool";
import {
  registerRenameWorkflow,
  registerDeleteWorkflow,
  registerExecuteWorkflow,
} from "./workflow-mutations.tool";

export function registerWorkflowTools(server: McpServer) {
  registerListWorkflows(server);
  registerGetWorkflow(server);
  registerCreateWorkflow(server);
  registerUpdateWorkflow(server);
  registerRenameWorkflow(server);
  registerDeleteWorkflow(server);
  registerExecuteWorkflow(server);
}
