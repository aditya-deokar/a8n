/**
 * Execution Tools — list_executions, get_execution
 * Scope: executions:read
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import {
  normalizePagination,
  buildPaginationOutput,
} from "@/mcp/shared/pagination";
import type { McpAuthInfo } from "@/mcp/auth/types";

export function registerListExecutions(server: McpServer) {
  server.tool(
    "list_executions",
    "List workflow execution history with pagination. Shows execution status (RUNNING, SUCCESS, FAILED), timestamps, and associated workflow.",
    {
      page: z.number().min(1).default(1).describe("Page number"),
      pageSize: z.number().min(1).max(100).default(10).describe("Results per page"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "executions:read");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "list_executions", input: args as Record<string, unknown>,
      });

      return withErrorBoundary("list_executions", async () => {
        const { page, pageSize, skip, take } = normalizePagination(args);
        const where = { workflow: { userId: auth.userId } };

        const [items, totalCount] = await Promise.all([
          prisma.execution.findMany({
            skip, take, where,
            orderBy: { startedAt: "desc" },
            include: {
              workflow: { select: { id: true, name: true } },
            },
          }),
          prisma.execution.count({ where }),
        ]);

        audit.success();
        return mcpJsonResponse({
          executions: items.map((e) => ({
            id: e.id,
            status: e.status,
            workflowId: e.workflowId,
            workflowName: e.workflow.name,
            startedAt: e.startedAt,
            completedAt: e.completedAt,
            error: e.error,
          })),
          ...buildPaginationOutput(page, pageSize, totalCount),
        });
      });
    },
  );
}

export function registerGetExecution(server: McpServer) {
  server.tool(
    "get_execution",
    "Get a single execution's full details by ID, including status, output, errors, and the associated workflow.",
    {
      id: z.string().describe("The execution ID"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "executions:read");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "get_execution", input: args,
      });

      return withErrorBoundary("get_execution", async () => {
        const execution = await prisma.execution.findUniqueOrThrow({
          where: {
            id: args.id,
            workflow: { userId: auth.userId },
          },
          include: {
            workflow: { select: { id: true, name: true } },
          },
        });

        audit.success();
        return mcpJsonResponse({
          id: execution.id,
          status: execution.status,
          workflowId: execution.workflowId,
          workflowName: execution.workflow.name,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          output: execution.output,
          error: execution.error,
          errorStack: execution.errorStack,
        });
      });
    },
  );
}
