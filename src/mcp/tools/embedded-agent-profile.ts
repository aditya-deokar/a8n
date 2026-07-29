import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerGetIntegrationSetupGuide,
  registerGetWorkflowSetupChecklist,
  registerGenerateGoogleFormScript,
  registerGetWebhookUrl,
} from "./integrations/integration-tools";
import { registerListNodeTypes, registerSearchCapabilities } from "./nodes/node-tools";
import { registerGetExecution, registerListExecutions } from "./executions/execution-tools";
import {
  registerDiagnoseExecution,
  registerGetExecutionTimeline,
  registerSuggestWorkflowFix,
} from "./executions/execution-runtime-tools";
import { registerGetWorkflow } from "./workflows/get-workflow.tool";
import { registerListWorkflows } from "./workflows/list-workflows.tool";
import {
  registerAnswerWorkflowDraftQuestions,
  registerApplyWorkflowDraft,
  registerCreateWorkflowDraft,
  registerExplainWorkflow,
  registerPlanWorkflowFromGoal,
  registerPreviewWorkflowDiff,
  registerValidateWorkflowDraft,
} from "./workflows/workflow-drafts.tool";
import { registerListWorkflowVersions } from "./workflows/workflow-versioning.tool";
import {
  registerGetCredential,
  registerListCredentials,
  registerListCredentialsByType,
} from "./credentials/credential-tools";
import {
  registerHealthCheck,
  registerServerInfo,
  registerWhoami,
} from "./system/system-tools";

/**
 * Narrow, first-party profile for the embedded agent.
 *
 * This profile deliberately excludes credential mutation, API-key management,
 * destructive workflow operations, live execution, and operator-only tools.
 * Draft creation remains discoverable for Phase 4, while the agent gateway can
 * enforce read-only mode until the apply phase is enabled.
 */
export function registerEmbeddedAgentTools(
  server: McpServer,
  context: McpToolContext = {},
): void {
  registerWhoami(server, context);
  registerServerInfo(server, context);
  registerHealthCheck(server, context);

  registerListWorkflows(server, context);
  registerGetWorkflow(server, context);
  registerListWorkflowVersions(server, context);

  registerListNodeTypes(server, context);
  registerSearchCapabilities(server, context);

  registerListCredentials(server, context);
  registerGetCredential(server, context);
  registerListCredentialsByType(server, context);

  registerListExecutions(server, context);
  registerGetExecution(server, context);
  registerGetExecutionTimeline(server, context);
  registerDiagnoseExecution(server, context);
  registerSuggestWorkflowFix(server, context);

  registerGetWorkflowSetupChecklist(server, context);
  registerGetIntegrationSetupGuide(server, context);
  registerGetWebhookUrl(server, context);
  registerGenerateGoogleFormScript(server, context);

  registerPlanWorkflowFromGoal(server, context);
  registerExplainWorkflow(server, context);
  registerCreateWorkflowDraft(server, context);
  registerAnswerWorkflowDraftQuestions(server, context);
  registerValidateWorkflowDraft(server, context);
  registerPreviewWorkflowDiff(server, context);
  registerApplyWorkflowDraft(server, context);
}
