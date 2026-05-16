/**
 * Tool: list_workflows
 * Scope: workflows:read
 *
 * Lists all workflows for the authenticated user with
 * pagination and optional search filtering.
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

const inputSchema = {
  page: z.number().min(1).default(1).describe("Page number (1-indexed)"),
  pageSize: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .describe("Results per page (1-100)"),
  search: z
    .string()
    .default("")
    .describe("Filter workflows by name (case-insensitive substring match)"),
};

export function registerListWorkflows(server: McpServer) {
  server.tool(
    "list_workflows",
    "List all workflows for the authenticated user with pagination and search. Returns workflow id, name, and timestamps.",
    inputSchema,
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "workflows:read");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "list_workflows",
        input: args as Record<string, unknown>,
      });

      return withErrorBoundary("list_workflows", async () => {
        const { page, pageSize, skip, take } = normalizePagination(args);

        const [items, totalCount] = await Promise.all([
          prisma.workflow.findMany({
            skip,
            take,
            where: {
              userId: auth.userId,
              name: {
                contains: args.search || "",
                mode: "insensitive",
              },
            },
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.workflow.count({
            where: {
              userId: auth.userId,
              name: {
                contains: args.search || "",
                mode: "insensitive",
              },
            },
          }),
        ]);

        const pagination = buildPaginationOutput(page, pageSize, totalCount);
        audit.success();
        return mcpJsonResponse({ workflows: items, ...pagination });
      });
    },
  );
}
