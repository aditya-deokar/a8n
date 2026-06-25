import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { registerChatGptRenderTools } from "@/mcp/apps/render-tools";
import {
  registerHealthCheck,
  registerServerInfo,
  registerWhoami,
} from "./system/system-tools";
import { registerListNodeTypes, registerSearchCapabilities } from "./nodes/node-tools";
import { registerListWorkflows } from "./workflows/list-workflows.tool";
import { registerGetWorkflow } from "./workflows/get-workflow.tool";
import {
  registerAnswerWorkflowDraftQuestions,
  registerApplyWorkflowDraft,
  registerCreateWorkflowDraft,
  registerExplainWorkflow,
  registerPlanWorkflowFromGoal,
  registerPreviewWorkflowDiff,
  registerValidateWorkflowDraft,
} from "./workflows/workflow-drafts.tool";
import {
  registerApplyWorkflowFix,
  registerDiagnoseExecution,
  registerExecuteWorkflowAndWait,
  registerGetExecutionTimeline,
  registerRunWorkflowTest,
  registerSuggestWorkflowFix,
} from "./executions/execution-runtime-tools";
import {
  registerGetIntegrationSetupGuide,
  registerGetWorkflowSetupChecklist,
  registerTestCredential,
  registerTestWebhookSetup,
} from "./integrations/integration-tools";
import { CHATGPT_APP_TOOL_COUNT } from "@/mcp/safety/app-tool-policy";

/**
 * Register the app-facing tool profile used by ChatGPT Apps.
 *
 * This profile intentionally excludes broad/admin tools such as API key
 * management, raw credential CRUD, destructive workflow deletion, audit logs,
 * and full graph replacement.
 */
export function registerChatGptAppTools(
  server: McpServer,
  context: McpToolContext = {},
): void {
  registerWhoami(server, context);
  registerServerInfo(server, context);
  registerHealthCheck(server, context);

  registerListNodeTypes(server, context);
  registerSearchCapabilities(server, context);

  registerListWorkflows(server, context);
  registerGetWorkflow(server, context);
  registerPlanWorkflowFromGoal(server, context);
  registerCreateWorkflowDraft(server, context);
  registerAnswerWorkflowDraftQuestions(server, context);
  registerValidateWorkflowDraft(server, context);
  registerExplainWorkflow(server, context);
  registerPreviewWorkflowDiff(server, context);
  registerApplyWorkflowDraft(server, context);

  registerExecuteWorkflowAndWait(server, context);
  registerRunWorkflowTest(server, context);
  registerGetExecutionTimeline(server, context);
  registerDiagnoseExecution(server, context);
  registerSuggestWorkflowFix(server, context);
  registerApplyWorkflowFix(server, context);

  registerGetWorkflowSetupChecklist(server, context);
  registerGetIntegrationSetupGuide(server, context);
  registerTestCredential(server, context);
  registerTestWebhookSetup(server, context);

  registerChatGptRenderTools(server, context);
}
