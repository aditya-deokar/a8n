/**
 * Tools: rename_workflow, delete_workflow, execute_workflow
 * Scopes: workflows:write, workflows:execute
 *
 * Remaining workflow mutation tools bundled together.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse, mcpTextResponse } from "@/mcp/shared/sanitize";
import { sendWorkflowExecution } from "@/inngest/utils";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { createWorkflowVersion } from "./workflow-graph-utils";
import { requireToolApproval } from "@/mcp/safety/approval-guard";

export function registerRenameWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "rename_workflow",
    "Rename a workflow by its ID.",
    {
      id: z.string().describe("The workflow ID to rename"),
      name: z.string().min(1).describe("The new name for the workflow"),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "rename_workflow", input: args,
      });

      return withErrorBoundary("rename_workflow", async () => {
        await createWorkflowVersion({
          workflowId: args.id,
          userId: auth.userId,
          createdByTool: "rename_workflow",
          summary: `Before rename to "${args.name}"`,
        });

        const workflow = await prisma.workflow.update({
          where: { id: args.id, userId: auth.userId },
          data: { name: args.name },
        });

        audit.success();
        return mcpJsonResponse({ message: `Workflow renamed to "${workflow.name}".`, workflow });
      });
    },
  );
}

export function registerDeleteWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "delete_workflow",
    "Permanently delete a workflow and all its nodes, connections, and execution history.",
    {
      id: z.string().describe("The workflow ID to delete"),
      approved: z.boolean().default(false).describe("Must be true after explicit user approval."),
      confirmationHash: z.string().optional().describe("Hash returned by the approval preview."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "delete_workflow", input: args,
      });

      return withErrorBoundary("delete_workflow", async () => {
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: { id: args.id, userId: auth.userId },
        });
        const approval = requireToolApproval({
          toolName: "delete_workflow",
          auth,
          approved: args.approved,
          confirmationHash: args.confirmationHash,
          requiresConfirmation: true,
          confirmationPayload: {
            toolName: "delete_workflow",
            workflowId: workflow.id,
            workflowName: workflow.name,
            irreversible: true,
          },
          preview: {
            deleted: false,
            workflowId: workflow.id,
            workflowName: workflow.name,
            irreversible: true,
          },
          warning:
            "Deleting a workflow permanently removes its graph and execution history. This action cannot be undone.",
          auditInput: { workflowId: workflow.id },
        });
        if (!approval.approved) return approval.response;

        await prisma.workflow.delete({
          where: { id: args.id, userId: auth.userId },
        });

        audit.success();
        return mcpTextResponse(`Workflow ${args.id} has been permanently deleted.`);
      });
    },
  );
}

export function registerExecuteWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "execute_workflow",
    "Trigger a workflow asynchronously via Inngest. Returns an event correlation ID; use execute_workflow_and_wait or get_execution_timeline with inngestEventId for follow-up.",
    {
      id: z.string().describe("The workflow ID to execute"),
      approved: z.boolean().default(false).describe("Must be true after explicit user approval."),
      confirmationHash: z.string().optional().describe("Optional confirmation hash from the approval preview."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:execute");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "execute_workflow", input: args,
      });

      return withErrorBoundary("execute_workflow", async () => {
        // Verify ownership
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: { id: args.id, userId: auth.userId },
        });
        const approval = requireToolApproval({
          toolName: "execute_workflow",
          auth,
          approved: args.approved,
          confirmationHash: args.confirmationHash,
          requiresConfirmation: false,
          preview: {
            triggered: false,
            workflowId: workflow.id,
            workflowName: workflow.name,
          },
          warning:
            "Executing a workflow may send messages, call external APIs, write to connected services, or create other side effects.",
          auditInput: { workflowId: workflow.id },
        });
        if (!approval.approved) return approval.response;

        // Send execution event to Inngest
        const executionEvent = await sendWorkflowExecution({ workflowId: args.id });

        audit.success();
        return mcpJsonResponse({
          message: `Workflow "${workflow.name}" execution triggered. Use execute_workflow_and_wait for synchronous chat UX or get_execution_timeline with the returned inngestEventId.`,
          workflowId: workflow.id,
          workflowName: workflow.name,
          inngestEventId: executionEvent.eventId,
          executionLookup: {
            by: "inngestEventId",
            value: executionEvent.eventId,
          },
        });
      });
    },
  );
}
