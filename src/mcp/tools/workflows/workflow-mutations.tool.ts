/**
 * Tools: rename_workflow, delete_workflow
 * Scopes: workflows:write
 *
 * Note: execute_workflow removed in Phase 1 (2026-08-26) — merged into
 * execute_workflow_and_wait / run_workflow_test. See integration-tools.ts
 * and execution-runtime-tools.ts for the retained execution triggers.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse, mcpTextResponse } from "@/mcp/shared/sanitize";
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

/**
 * execute_workflow — REMOVED in Phase 1 (2026-08-26)
 * Fire-and-forget trigger merged into execute_workflow_and_wait and
 * run_workflow_test(wait=false). Callers should use:
 *   execute_workflow_and_wait({ workflowId, approved: true }) or
 *   run_workflow_test({ workflowId, trigger, approved: true, wait: false })
 * Tool is NOT registered, so it no longer appears in tools/list.
 */
