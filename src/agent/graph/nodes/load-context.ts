import prisma from "@/lib/db";
import type { AgentGraphState } from "../state";
import { agentMemoryEnabled } from "@/agent/feature-policy";
import { agentMemoryStore } from "@/agent/memory/store";
import { MEMORY_CATEGORIES, buildMemoryNamespace } from "@/agent/memory/namespaces";

/**
 * Extract the latest user message text for memory search query.
 */
function extractUserQuery(state: AgentGraphState): string | null {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const msg = state.messages[i];
    if (msg._getType?.() === "human" || (msg as any).role === "human") {
      const content = msg.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textPart = content.find(
          (p) => typeof p === "string" || (p && typeof p === "object" && "text" in p),
        );
        if (typeof textPart === "string") return textPart;
        if (textPart && typeof textPart === "object" && "text" in textPart) {
          return String(textPart.text);
        }
      }
    }
  }
  return null;
}

/**
 * Load thread metadata, sanitized workflow summary, and recalled
 * long-term memories into graph state.
 * This node runs at the start of every agent turn.
 */
export async function loadContextNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const { userId, workflowId } = state;

  // --- Retrieve long-term memories ---
  let retrievedMemories: AgentGraphState["retrievedMemories"] = [];

  const memoryEnabled = agentMemoryEnabled({ userId });
  if (memoryEnabled && userId) {
    const query = extractUserQuery(state);
    if (query && query.length >= 3) {
      try {
        const allResults = await Promise.all(
          MEMORY_CATEGORIES.map((category) =>
            agentMemoryStore
              .search({
                userId,
                namespace: buildMemoryNamespace(userId, category),
                query,
                limit: 3,
              })
              .catch(() => []),
          ),
        );

        retrievedMemories = allResults
          .flat()
          .filter((item) => (item.score ?? 0) > 0.3)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 5)
          .map((item) => ({
            content: item.content,
            score: item.score ?? 0,
            namespace: item.namespace,
          }));
      } catch {
        // Memory retrieval is best-effort — don't block the run
      }
    }
  }

  // --- Load workflow context ---
  if (!workflowId) {
    return {
      workflowContext: null,
      retrievedMemories,
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
    return { workflowContext: null, retrievedMemories };
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
    retrievedMemories,
  };
}


