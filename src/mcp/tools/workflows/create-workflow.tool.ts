/**
 * Tool: create_workflow
 * Scope: workflows:write
 *
 * Creates a new workflow with an auto-generated slug name
 * and an INITIAL node at position (0, 0).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSlug } from "random-word-slugs";
import prisma from "@/lib/db";
import { NodeType } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import type { McpAuthInfo } from "@/mcp/auth/types";

export function registerCreateWorkflow(server: McpServer) {
  server.tool(
    "create_workflow",
    "Create a new workflow. A random 3-word slug name is auto-generated, and an INITIAL node is created at position (0,0). Returns the created workflow.",
    {
      name: z
        .string()
        .optional()
        .describe(
          "Optional custom name. If not provided, a random 3-word slug is generated.",
        ),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "create_workflow",
        input: args,
      });

      return withErrorBoundary("create_workflow", async () => {
        const workflow = await prisma.workflow.create({
          data: {
            name: args.name || generateSlug(3),
            userId: auth.userId,
            nodes: {
              create: {
                type: NodeType.INITIAL,
                position: { x: 0, y: 0 },
                name: NodeType.INITIAL,
              },
            },
          },
          include: { nodes: true },
        });

        audit.success();
        return mcpJsonResponse(workflow);
      });
    },
  );
}
