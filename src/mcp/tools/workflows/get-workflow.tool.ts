/**
 * Tool: get_workflow
 * Scope: workflows:read
 *
 * Retrieves a single workflow with its nodes and connections,
 * transformed into react-flow compatible format.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";

export function registerGetWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "get_workflow",
    "Get a single workflow by ID, including all its nodes and connections. Returns the full workflow graph structure.",
    {
      id: z.string().describe("The workflow ID to retrieve"),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "get_workflow",
        input: args,
      });

      return withErrorBoundary("get_workflow", async () => {
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: { id: args.id, userId: auth.userId },
          include: { nodes: true, connections: true },
        });

        // Transform to react-flow compatible format (matches tRPC getOne)
        const nodes = workflow.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position as { x: number; y: number },
          data: (node.data as Record<string, unknown>) || {},
          credentialId: node.credentialId,
        }));

        const edges = workflow.connections.map((conn) => ({
          id: conn.id,
          source: conn.fromNodeId,
          target: conn.toNodeId,
          sourceHandle: conn.fromOutput,
          targetHandle: conn.toInput,
        }));

        audit.success();
        return mcpJsonResponse({
          id: workflow.id,
          name: workflow.name,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
          nodes,
          edges,
        });
      });
    },
  );
}
