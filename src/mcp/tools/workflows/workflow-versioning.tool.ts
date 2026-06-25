import { createId } from "@paralleldrive/cuid2";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { NodeType, type Prisma } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { requireActiveSubscription } from "@/mcp/middleware/subscription-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import {
  asGraphEdges,
  asGraphNodes,
  createWorkflowVersion,
  getWorkflowGraph,
  replaceWorkflowGraph,
  stableHash,
  validateWorkflowGraph,
  type WorkflowGraphEdge,
  type WorkflowGraphNode,
} from "./workflow-graph-utils";

type ApprovalArgs = {
  approved?: boolean;
  confirmationHash?: string;
};

function graphDiff(
  beforeNodes: WorkflowGraphNode[],
  beforeEdges: WorkflowGraphEdge[],
  afterNodes: WorkflowGraphNode[],
  afterEdges: WorkflowGraphEdge[],
) {
  const beforeById = new Map(beforeNodes.map((node) => [node.id, node]));
  const afterById = new Map(afterNodes.map((node) => [node.id, node]));
  const beforeEdgeKeys = new Set(beforeEdges.map((edge) => `${edge.source}->${edge.target}`));
  const afterEdgeKeys = new Set(afterEdges.map((edge) => `${edge.source}->${edge.target}`));

  return {
    addedNodes: afterNodes.filter((node) => !beforeById.has(node.id)),
    removedNodes: beforeNodes.filter((node) => !afterById.has(node.id)),
    changedNodes: afterNodes.filter((node) => {
      const before = beforeById.get(node.id);
      return before && JSON.stringify(before) !== JSON.stringify(node);
    }),
    addedEdges: afterEdges.filter((edge) => !beforeEdgeKeys.has(`${edge.source}->${edge.target}`)),
    removedEdges: beforeEdges.filter((edge) => !afterEdgeKeys.has(`${edge.source}->${edge.target}`)),
  };
}

async function previewOrApplyMutation(params: {
  userId: string;
  workflowId: string;
  toolName: string;
  approval: ApprovalArgs;
  input: Record<string, unknown>;
  mutate: (
    nodes: WorkflowGraphNode[],
    edges: WorkflowGraphEdge[],
  ) => { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] };
}) {
  const before = await getWorkflowGraph(params.workflowId, params.userId);
  const after = params.mutate(before.nodes, before.edges);
  const validation = await validateWorkflowGraph({
    userId: params.userId,
    nodes: after.nodes,
    edges: after.edges,
  });
  const diff = graphDiff(before.nodes, before.edges, after.nodes, after.edges);
  const confirmationSummary = {
    toolName: params.toolName,
    workflowId: params.workflowId,
    input: params.input,
    diff,
    validationValid: validation.valid,
  };
  const confirmationHash = stableHash(confirmationSummary);

  if (!validation.valid) {
    return mcpJsonResponse({
      applied: false,
      reason: "Proposed edit did not pass workflow validation. Nothing was saved.",
      diff,
      validation,
    });
  }

  if (!params.approval.approved || params.approval.confirmationHash !== confirmationHash) {
    return mcpJsonResponse({
      applied: false,
      approvalRequired: true,
      confirmationHash,
      diff,
      validation,
      instruction:
        "After user approval, call the same tool with approved: true and this confirmationHash.",
    });
  }

  await createWorkflowVersion({
    workflowId: params.workflowId,
    userId: params.userId,
    createdByTool: params.toolName,
    summary: `Before ${params.toolName}`,
  });

  await prisma.$transaction(async (tx) => {
    await replaceWorkflowGraph({
      workflowId: params.workflowId,
      nodes: after.nodes,
      edges: after.edges,
      tx,
    });
  });

  return mcpJsonResponse({
    applied: true,
    workflowId: params.workflowId,
    diff,
    validation,
  });
}

export function registerListWorkflowVersions(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "list_workflow_versions",
    "List saved workflow version snapshots for rollback. Snapshots are created before MCP graph mutations.",
    {
      workflowId: z.string().describe("Workflow ID."),
      limit: z.number().min(1).max(50).default(10).describe("Maximum versions to return."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("list_workflow_versions", async () => {
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });
        const versions = await prisma.workflowVersion.findMany({
          where: { workflowId: args.workflowId, userId: auth.userId },
          orderBy: { createdAt: "desc" },
          take: args.limit,
          select: {
            id: true,
            workflowId: true,
            name: true,
            summary: true,
            createdByTool: true,
            createdAt: true,
          },
        });

        return mcpJsonResponse({ versions, count: versions.length });
      });
    },
  );
}

export function registerDuplicateWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "duplicate_workflow",
    "Create a copy of an existing workflow with new node IDs and the same graph structure.",
    {
      workflowId: z.string().describe("Workflow ID to duplicate."),
      name: z.string().optional().describe("Optional name for the duplicate."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "duplicate_workflow",
        input: args,
      });

      return withErrorBoundary("duplicate_workflow", async () => {
        await requireActiveSubscription(auth.userId);
        const { workflow, nodes, edges } = await getWorkflowGraph(args.workflowId, auth.userId);
        const idMap = new Map(nodes.map((node) => [node.id, createId()]));
        const duplicateNodes = nodes.map((node) => ({
          ...node,
          id: idMap.get(node.id)!,
        }));
        const duplicateEdges = edges.map((edge) => ({
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
          sourceHandle: edge.sourceHandle || "main",
          targetHandle: edge.targetHandle || "main",
        }));

        const created = await prisma.workflow.create({
          data: {
            name: args.name || `${workflow.name} copy`,
            userId: auth.userId,
          },
        });
        await replaceWorkflowGraph({
          workflowId: created.id,
          nodes: duplicateNodes,
          edges: duplicateEdges,
        });

        audit.success();
        return mcpJsonResponse({
          workflowId: created.id,
          name: created.name,
          nodeCount: duplicateNodes.length,
          edgeCount: duplicateEdges.length,
        });
      });
    },
  );
}

export function registerRollbackWorkflowVersion(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "rollback_workflow_version",
    "Restore a workflow from a saved version snapshot. Requires approved: true and the confirmation hash returned by this tool.",
    {
      workflowId: z.string().describe("Workflow ID to restore."),
      versionId: z.string().describe("Version snapshot ID."),
      approved: z.boolean().default(false).describe("Must be true after explicit user approval."),
      confirmationHash: z.string().optional().describe("Hash returned by the approval preview."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("rollback_workflow_version", async () => {
        const current = await getWorkflowGraph(args.workflowId, auth.userId);
        const version = await prisma.workflowVersion.findUniqueOrThrow({
          where: { id: args.versionId, workflowId: args.workflowId, userId: auth.userId },
        });
        const versionNodes = asGraphNodes(version.nodes);
        const versionEdges = asGraphEdges(version.edges);
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes: versionNodes,
          edges: versionEdges,
        });
        const diff = graphDiff(current.nodes, current.edges, versionNodes, versionEdges);
        const confirmationSummary = {
          toolName: "rollback_workflow_version",
          workflowId: args.workflowId,
          versionId: args.versionId,
          diff,
          validationValid: validation.valid,
        };
        const expectedHash = stableHash(confirmationSummary);

        if (!validation.valid) {
          return mcpJsonResponse({
            applied: false,
            reason: "Stored version no longer validates. Nothing was saved.",
            validation,
          });
        }

        if (!args.approved || args.confirmationHash !== expectedHash) {
          return mcpJsonResponse({
            applied: false,
            approvalRequired: true,
            confirmationHash: expectedHash,
            diff,
            validation,
          });
        }

        await createWorkflowVersion({
          workflowId: args.workflowId,
          userId: auth.userId,
          createdByTool: "rollback_workflow_version",
          summary: `Before rollback to version ${args.versionId}`,
        });
        await replaceWorkflowGraph({
          workflowId: args.workflowId,
          nodes: versionNodes,
          edges: versionEdges,
        });

        return mcpJsonResponse({
          applied: true,
          workflowId: args.workflowId,
          restoredVersionId: args.versionId,
          diff,
          validation,
        });
      });
    },
  );
}

export function registerAddWorkflowNode(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "add_workflow_node",
    "Safely add one node to a workflow. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      nodeType: z.enum(NodeType),
      data: z.record(z.string(), z.unknown()).optional(),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
      connectFromNodeId: z.string().optional(),
      connectToNodeId: z.string().optional(),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("add_workflow_node", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "add_workflow_node",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => {
            const node: WorkflowGraphNode = {
              id: createId(),
              type: args.nodeType,
              position: args.position || { x: nodes.length * 320, y: 0 },
              data: args.data || {},
            };
            const nextEdges = [...edges];
            if (args.connectFromNodeId) {
              nextEdges.push({
                source: args.connectFromNodeId,
                target: node.id,
                sourceHandle: "main",
                targetHandle: "main",
              });
            }
            if (args.connectToNodeId) {
              nextEdges.push({
                source: node.id,
                target: args.connectToNodeId,
                sourceHandle: "main",
                targetHandle: "main",
              });
            }
            return { nodes: [...nodes, node], edges: nextEdges };
          },
        }),
      );
    },
  );
}

export function registerUpdateNodeConfig(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "update_node_config",
    "Safely update one node's configuration. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      nodeId: z.string(),
      data: z.record(z.string(), z.unknown()),
      replace: z.boolean().default(false).describe("Replace all config instead of merging."),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("update_node_config", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "update_node_config",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => ({
            nodes: nodes.map((node) =>
              node.id === args.nodeId
                ? { ...node, data: args.replace ? args.data : { ...node.data, ...args.data } }
                : node,
            ),
            edges,
          }),
        }),
      );
    },
  );
}

export function registerConnectWorkflowNodes(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "connect_workflow_nodes",
    "Safely connect two existing workflow nodes. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("connect_workflow_nodes", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "connect_workflow_nodes",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => ({
            nodes,
            edges: [
              ...edges,
              {
                source: args.sourceNodeId,
                target: args.targetNodeId,
                sourceHandle: args.sourceHandle || "main",
                targetHandle: args.targetHandle || "main",
              },
            ],
          }),
        }),
      );
    },
  );
}

export function registerDisconnectWorkflowNodes(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "disconnect_workflow_nodes",
    "Safely remove connections between two nodes. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("disconnect_workflow_nodes", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "disconnect_workflow_nodes",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => ({
            nodes,
            edges: edges.filter(
              (edge) => !(edge.source === args.sourceNodeId && edge.target === args.targetNodeId),
            ),
          }),
        }),
      );
    },
  );
}

export function registerRemoveWorkflowNode(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "remove_workflow_node",
    "Safely remove one workflow node and its connected edges. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      nodeId: z.string(),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("remove_workflow_node", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "remove_workflow_node",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => ({
            nodes: nodes.filter((node) => node.id !== args.nodeId),
            edges: edges.filter(
              (edge) => edge.source !== args.nodeId && edge.target !== args.nodeId,
            ),
          }),
        }),
      );
    },
  );
}

export function registerMoveWorkflowNode(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "move_workflow_node",
    "Safely move one workflow node. Validates the whole graph and saves only after approval.",
    {
      workflowId: z.string(),
      nodeId: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("move_workflow_node", async () =>
        previewOrApplyMutation({
          userId: auth.userId,
          workflowId: args.workflowId,
          toolName: "move_workflow_node",
          approval: args,
          input: { ...args, approved: undefined, confirmationHash: undefined },
          mutate: (nodes, edges) => ({
            nodes: nodes.map((node) =>
              node.id === args.nodeId ? { ...node, position: args.position } : node,
            ),
            edges,
          }),
        }),
      );
    },
  );
}
