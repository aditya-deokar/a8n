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
  registerGetWorkflowSetupChecklist,
  registerTestCredential,
} from "./integrations/integration-tools";
import { getMcpRuntimeFeatureFlags } from "@/mcp/observability/runtime-guardrails";
import { logger } from "@/lib/logging";

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
  const flags = getMcpRuntimeFeatureFlags();
  registerWhoami(server, context);
  registerServerInfo(server, context);
  registerHealthCheck(server, context);

  registerListNodeTypes(server, context);
  registerSearchCapabilities(server, context);

  registerListWorkflows(server, context);
  registerGetWorkflow(server, context);
  registerPlanWorkflowFromGoal(server, context);
  registerExplainWorkflow(server, context);
  registerPreviewWorkflowDiff(server, context);

  registerGetExecutionTimeline(server, context);
  registerDiagnoseExecution(server, context);

  registerGetWorkflowSetupChecklist(server, context);

  registerChatGptRenderTools(server, context);

  if (flags.forceReadOnlyChatGptProfile) {
    logger.warn(
      {
        component: "mcp",
        event: "mcp_runtime_guardrail_applied",
        profile: "chatgpt",
        guardrail: "force_read_only_chatgpt_profile",
      },
      "MCP ChatGPT app profile forced read-only by runtime guardrail.",
    );
    return;
  }

  registerCreateWorkflowDraft(server, context);
  registerAnswerWorkflowDraftQuestions(server, context);
  registerValidateWorkflowDraft(server, context);
  registerApplyWorkflowDraft(server, context);

  registerExecuteWorkflowAndWait(server, context);
  registerRunWorkflowTest(server, context);
  registerSuggestWorkflowFix(server, context);
  registerApplyWorkflowFix(server, context);

  registerTestCredential(server, context);
}
