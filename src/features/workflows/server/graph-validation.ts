import { TRPCError } from "@trpc/server";
import { NodeType } from "@/generated/prisma";

export const TRIGGER_NODE_TYPES = new Set<NodeType>([
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
]);

type GraphNodeInput = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: Record<string, unknown> | null;
};

type GraphEdgeInput = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

const connectionKey = (edge: GraphEdgeInput) =>
  [
    edge.source,
    edge.target,
    edge.sourceHandle || "main",
    edge.targetHandle || "main",
  ].join("|");

/**
 * Validates a client-submitted workflow graph before it touches the database.
 * Throws TRPCError with a user-friendly message when the graph is invalid.
 */
export function validateWorkflowGraph(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
): void {
  if (!Array.isArray(nodes)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nodes must be an array.",
    });
  }

  // Node IDs must be unique.
  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Every node must have an id.",
      });
    }
    if (seenIds.has(node.id)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Duplicate node detected in the workflow.",
      });
    }
    seenIds.add(node.id);
  }

  // The INITIAL placeholder cannot coexist with real nodes.
  const hasInitial = nodes.some((n) => n.type === NodeType.INITIAL);
  const realNodes = nodes.filter((n) => n.type !== NodeType.INITIAL);
  if (hasInitial && realNodes.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "The placeholder node cannot be combined with configured steps. Replace it by adding your first step.",
    });
  }

  // Every non-placeholder workflow needs at least one trigger.
  if (realNodes.length > 0) {
    const hasTrigger = realNodes.some((n) =>
      TRIGGER_NODE_TYPES.has(n.type as NodeType),
    );
    if (!hasTrigger) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "A workflow needs at least one trigger (Manual, Google Form or Stripe) before it can be saved.",
      });
    }
  }

  const nodeIds = new Set(realNodes.map((n) => n.id));

  // Edges must reference existing nodes and be unique / non-self-looping.
  const seenConnections = new Set<string>();
  for (const edge of edges ?? []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "A connection references a node that no longer exists. Refresh the editor and try again.",
      });
    }
    if (edge.source === edge.target) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A node cannot connect to itself.",
      });
    }
    const key = connectionKey(edge);
    if (seenConnections.has(key)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Duplicate connection between the same nodes is not allowed.",
      });
    }
    seenConnections.add(key);
  }

  assertAcyclic(realNodes.map((n) => n.id), edges ?? []);
}

function assertAcyclic(nodeIds: string[], edges: GraphEdgeInput[]): void {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  // Iterative depth-first search with three-colour marking.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(nodeIds.map((id) => [id, WHITE]));

  for (const start of nodeIds) {
    if (color.get(start) !== WHITE) continue;
    const stack: Array<{ node: string; edgeIndex: number }> = [
      { node: start, edgeIndex: 0 },
    ];
    color.set(start, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.node) ?? [];

      if (frame.edgeIndex >= neighbors.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }

      const next = neighbors[frame.edgeIndex];
      frame.edgeIndex += 1;

      const nextColor = color.get(next) ?? BLACK;
      if (nextColor === GRAY) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This workflow contains a circular connection. Loops are not supported yet.",
        });
      }
      if (nextColor === WHITE) {
        color.set(next, GRAY);
        stack.push({ node: next, edgeIndex: 0 });
      }
    }
  }
}
