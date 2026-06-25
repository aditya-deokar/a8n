/**
 * Execution Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { registerListExecutions, registerGetExecution } from "./execution-tools";
import {
  registerApplyWorkflowFix,
  registerDiagnoseExecution,
  registerExecuteWorkflowAndWait,
  registerGetExecutionTimeline,
  registerRunWorkflowTest,
  registerSuggestWorkflowFix,
} from "./execution-runtime-tools";

export function registerExecutionTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerListExecutions(server, context);
  registerGetExecution(server, context);
  registerExecuteWorkflowAndWait(server, context);
  registerRunWorkflowTest(server, context);
  registerGetExecutionTimeline(server, context);
  registerDiagnoseExecution(server, context);
  registerSuggestWorkflowFix(server, context);
  registerApplyWorkflowFix(server, context);
}
