/**
 * Workflow Tools — Barrel Export
 *
 * Registers all workflow-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { registerListWorkflows } from "./list-workflows.tool";
import { registerGetWorkflow } from "./get-workflow.tool";
import { registerCreateWorkflow } from "./create-workflow.tool";
import { registerUpdateWorkflow } from "./update-workflow.tool";
import {
  registerRenameWorkflow,
  registerDeleteWorkflow,
  registerExecuteWorkflow,
} from "./workflow-mutations.tool";
import {
  registerPlanWorkflowFromGoal,
  registerCreateWorkflowDraft,
  registerAnswerWorkflowDraftQuestions,
  registerValidateWorkflowDraft,
  registerExplainWorkflow,
  registerPreviewWorkflowDiff,
  registerApplyWorkflowDraft,
} from "./workflow-drafts.tool";
import {
  registerListWorkflowVersions,
  registerDuplicateWorkflow,
  registerRollbackWorkflowVersion,
  registerAddWorkflowNode,
  registerUpdateNodeConfig,
  registerConnectWorkflowNodes,
  registerDisconnectWorkflowNodes,
  registerRemoveWorkflowNode,
  registerMoveWorkflowNode,
} from "./workflow-versioning.tool";

export function registerWorkflowTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerListWorkflows(server, context);
  registerGetWorkflow(server, context);
  registerCreateWorkflow(server, context);
  registerUpdateWorkflow(server, context);
  registerRenameWorkflow(server, context);
  registerDeleteWorkflow(server, context);
  registerExecuteWorkflow(server, context);
  registerPlanWorkflowFromGoal(server, context);
  registerCreateWorkflowDraft(server, context);
  registerAnswerWorkflowDraftQuestions(server, context);
  registerValidateWorkflowDraft(server, context);
  registerExplainWorkflow(server, context);
  registerPreviewWorkflowDiff(server, context);
  registerApplyWorkflowDraft(server, context);
  registerListWorkflowVersions(server, context);
  registerDuplicateWorkflow(server, context);
  registerRollbackWorkflowVersion(server, context);
  registerAddWorkflowNode(server, context);
  registerUpdateNodeConfig(server, context);
  registerConnectWorkflowNodes(server, context);
  registerDisconnectWorkflowNodes(server, context);
  registerRemoveWorkflowNode(server, context);
  registerMoveWorkflowNode(server, context);
}
