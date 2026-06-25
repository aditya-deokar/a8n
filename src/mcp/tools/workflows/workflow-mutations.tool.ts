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
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "delete_workflow", input: args,
      });

      return withErrorBoundary("delete_workflow", async () => {
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
