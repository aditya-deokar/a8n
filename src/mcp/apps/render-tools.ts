import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { sanitizeOutput } from "@/mcp/shared/sanitize";
import {
  approvalPreview,
  draftPreview,
  executionTimeline,
  setupChecklist,
} from "@/mcp/resources/app-resources.resource";
import { CHATGPT_WIDGET_URIS, widgetToolMeta } from "./widget-resources";

const renderOutputSchema = {
  kind: z.string(),
  resourceUri: z.string(),
  title: z.string(),
  summary: z.object({}).passthrough(),
};

function renderToolResult(params: {
  kind:
    | "workflowDraftPreview"
    | "workflowSetupChecklist"
    | "executionTimeline"
    | "workflowApproval";
  resourceUri: string;
  title: string;
  summary: Record<string, unknown>;
  details: unknown;
  message: string;
}): CallToolResult {
  const details = sanitizeOutput(params.details);

  return {
    structuredContent: {
      kind: params.kind,
      resourceUri: params.resourceUri,
      title: params.title,
      summary: sanitizeOutput(params.summary),
    },
    content: [{ type: "text", text: params.message }],
    _meta: {
      widget: {
        resourceUri: params.resourceUri,
        generatedAt: new Date().toISOString(),
      },
      details,
    },
  };
}

export function registerRenderWorkflowDraftPreview(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "render_workflow_draft_preview",
    {
      title: "Render workflow draft preview",
      description:
        "Render a ChatGPT widget preview for a workflow draft, including planned steps and validation status.",
      inputSchema: {
        draftId: z.string().describe("Workflow draft ID."),
      },
      outputSchema: renderOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta(
        CHATGPT_WIDGET_URIS.workflowDraftPreview,
        "Preparing workflow preview...",
        "Workflow preview ready",
      ),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("render_workflow_draft_preview", async () => {
        const data = await draftPreview(args.draftId, auth.userId);

        return renderToolResult({
          kind: "workflowDraftPreview",
          resourceUri: CHATGPT_WIDGET_URIS.workflowDraftPreview,
          title: data.draft.name,
          summary: {
            draftId: data.draft.id,
            status: data.draft.status,
            valid: data.validation.valid,
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
          },
          details: data,
          message: `Workflow draft preview ready for ${data.draft.name}.`,
        });
      });
    },
  );
}

export function registerRenderWorkflowSetupChecklist(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "render_workflow_setup_checklist",
    {
      title: "Render workflow setup checklist",
      description:
        "Render a ChatGPT widget checklist for credentials, missing fields, webhook setup, and test steps.",
      inputSchema: {
        workflowId: z.string().describe("Saved workflow ID."),
      },
      outputSchema: renderOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta(
        CHATGPT_WIDGET_URIS.workflowSetupChecklist,
        "Preparing setup checklist...",
        "Setup checklist ready",
      ),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("render_workflow_setup_checklist", async () => {
        const data = await setupChecklist(args.workflowId, auth.userId);

        return renderToolResult({
          kind: "workflowSetupChecklist",
          resourceUri: CHATGPT_WIDGET_URIS.workflowSetupChecklist,
          title: `Setup: ${data.workflow.name}`,
          summary: {
            workflowId: data.workflow.id,
            ready: data.ready,
            credentialChecks: data.credentialChecks.length,
            webhookSteps: data.webhookSteps.length,
            missingFields: data.validation.missingFields.length,
          },
          details: data,
          message: `Setup checklist ready for ${data.workflow.name}.`,
        });
      });
    },
  );
}

export function registerRenderExecutionTimeline(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "render_execution_timeline",
    {
      title: "Render execution timeline",
      description:
        "Render a ChatGPT widget timeline for a workflow execution, including status, duration, and node order.",
      inputSchema: {
        executionId: z.string().describe("Execution ID."),
      },
      outputSchema: renderOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta(
        CHATGPT_WIDGET_URIS.executionTimeline,
        "Preparing execution timeline...",
        "Execution timeline ready",
      ),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "executions:read");

      return withErrorBoundary("render_execution_timeline", async () => {
        const data = await executionTimeline(args.executionId, auth.userId);

        return renderToolResult({
          kind: "executionTimeline",
          resourceUri: CHATGPT_WIDGET_URIS.executionTimeline,
          title: `Execution: ${data.execution.workflowName}`,
          summary: {
            executionId: data.execution.id,
            workflowId: data.execution.workflowId,
            status: data.execution.status,
            durationMs: data.execution.durationMs,
            timelineSteps: data.timeline.length,
            hasError: Boolean(data.execution.error),
          },
          details: data,
          message: `Execution timeline ready for ${data.execution.workflowName}.`,
        });
      });
    },
  );
}

export function registerRenderWorkflowApproval(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "render_workflow_approval",
    {
      title: "Render workflow approval",
      description:
        "Render a ChatGPT approval widget for applying a workflow draft after the user reviews the diff and confirmation hash.",
      inputSchema: {
        draftId: z.string().describe("Workflow draft ID."),
      },
      outputSchema: renderOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta(
        CHATGPT_WIDGET_URIS.workflowApproval,
        "Preparing approval screen...",
        "Approval screen ready",
      ),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("render_workflow_approval", async () => {
        const data = await approvalPreview(args.draftId, auth.userId);

        return renderToolResult({
          kind: "workflowApproval",
          resourceUri: CHATGPT_WIDGET_URIS.workflowApproval,
          title: `Approve: ${data.draft.name}`,
          summary: {
            draftId: data.draft.id,
            workflowId: data.draft.workflowId || null,
            valid: data.validation.valid,
            confirmationHash: data.approval.confirmationHash,
            addedNodes: data.diff.addedNodes.length,
            changedNodes: data.diff.changedNodes.length,
            removedNodes: data.diff.removedNodes.length,
          },
          details: data,
          message: `Approval screen ready for ${data.draft.name}.`,
        });
      });
    },
  );
}

export function registerChatGptRenderTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerRenderWorkflowDraftPreview(server, context);
  registerRenderWorkflowSetupChecklist(server, context);
  registerRenderExecutionTimeline(server, context);
  registerRenderWorkflowApproval(server, context);
}
