import prisma from "@/lib/db";
import type { AgentGraphState } from "../state";

/**
 * Load thread metadata and a sanitized workflow summary into graph state.
 * This node runs at the start of every agent turn.
 */
export async function loadContextNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const { userId, workflowId } = state;

  if (!workflowId) {
    return {
      workflowContext: null,
    };
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId, userId },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      nodes: { select: { id: true, name: true, type: true } },
      _count: { select: { connections: true } },
      drafts: {
        where: { status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, name: true, status: true, goal: true },
      },
    },
  });

  if (!workflow) {
    return { workflowContext: null };
  }

  return {
    workflowContext: {
      id: workflow.id,
      name: workflow.name,
      updatedAt: workflow.updatedAt.toISOString(),
      nodeTypes: [...new Set(workflow.nodes.map((n) => n.type))],
      nodeCount: workflow.nodes.length,
      connectionCount: workflow._count.connections,
      nodes: workflow.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
      })),
      activeDraft: workflow.drafts[0] || null,
    },
    // If there's an active draft, carry its ID forward
    draftId: state.draftId || workflow.drafts[0]?.id || null,
  };
}
