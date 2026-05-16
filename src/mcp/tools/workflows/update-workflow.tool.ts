/**
 * Tool: update_workflow
 * Scope: workflows:write
 *
 * Updates a workflow's nodes and connections in a single transaction.
 * Replaces all existing nodes/connections with the provided ones.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { NodeType } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import type { McpAuthInfo } from "@/mcp/auth/types";

export function registerUpdateWorkflow(server: McpServer) {
  server.tool(
    "update_workflow",
    "Update a workflow's nodes and connections. This replaces ALL existing nodes and connections with the ones provided (full replacement, not partial patch).",
    {
      id: z.string().describe("The workflow ID to update"),
      nodes: z
        .array(
          z.object({
            id: z.string().describe("Node ID"),
            type: z
              .string()
              .nullish()
              .describe("Node type (e.g., MANUAL_TRIGGER, HTTP_REQUEST, OPENAI)"),
            position: z.object({
              x: z.number().describe("X position"),
              y: z.number().describe("Y position"),
            }),
            data: z
              .record(z.string(), z.any())
              .optional()
              .describe("Node configuration data"),
          }),
        )
        .describe("Array of nodes to set on the workflow"),
      edges: z
        .array(
          z.object({
            source: z.string().describe("Source node ID"),
            target: z.string().describe("Target node ID"),
            sourceHandle: z
              .string()
              .nullish()
              .describe("Source output handle (default: 'main')"),
            targetHandle: z
              .string()
              .nullish()
              .describe("Target input handle (default: 'main')"),
          }),
        )
        .describe("Array of connections between nodes"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "update_workflow",
        input: { id: args.id, nodeCount: args.nodes.length, edgeCount: args.edges.length },
      });

      return withErrorBoundary("update_workflow", async () => {
        // Verify ownership
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.id, userId: auth.userId },
        });

        // Transaction for atomic update (matches tRPC update procedure)
        const result = await prisma.$transaction(async (tx) => {
          // Delete existing nodes (cascade deletes connections)
          await tx.node.deleteMany({ where: { workflowId: args.id } });

          // Create new nodes
          await tx.node.createMany({
            data: args.nodes.map((node) => ({
              id: node.id,
              workflowId: args.id,
              name: node.type || "unknown",
              type: (node.type as NodeType) || NodeType.INITIAL,
              position: node.position,
              data: node.data || {},
            })),
          });

          // Create new connections
          if (args.edges.length > 0) {
            await tx.connection.createMany({
              data: args.edges.map((edge) => ({
                workflowId: args.id,
                fromNodeId: edge.source,
                toNodeId: edge.target,
                fromOutput: edge.sourceHandle || "main",
                toInput: edge.targetHandle || "main",
              })),
            });
          }

          // Touch updated timestamp
          return tx.workflow.update({
            where: { id: args.id },
            data: { updatedAt: new Date() },
          });
        });

        audit.success();
        return mcpJsonResponse({
          message: `Workflow "${result.name}" updated with ${args.nodes.length} nodes and ${args.edges.length} connections.`,
          workflow: result,
        });
      });
    },
  );
}
