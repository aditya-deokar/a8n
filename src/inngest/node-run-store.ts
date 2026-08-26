import prisma from "@/lib/db";
import type { NodeType } from "@/generated/prisma";

/**
 * Persists per-node execution records so execution history can show exactly
 * which node failed, when, and why. Writes are idempotent (upsert on the
 * [executionId, nodeId] pair) because Inngest retries re-run this code.
 */
export async function recordNodeRunStart(params: {
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
}): Promise<void> {
  try {
    await prisma.executionNodeRun.upsert({
      where: {
        executionId_nodeId: {
          executionId: params.executionId,
          nodeId: params.nodeId,
        },
      },
      create: {
        executionId: params.executionId,
        nodeId: params.nodeId,
        nodeType: params.nodeType,
        status: "RUNNING",
      },
      update: {
        status: "RUNNING",
        startedAt: new Date(),
        completedAt: null,
        durationMs: null,
        error: null,
      },
    });
  } catch {
    // Observability must never break execution.
  }
}

export async function recordNodeRunSuccess(params: {
  executionId: string;
  nodeId: string;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.executionNodeRun.updateMany({
      where: {
        executionId: params.executionId,
        nodeId: params.nodeId,
      },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        durationMs: params.durationMs,
        error: null,
      },
    });
  } catch {
    // Observability must never break execution.
  }
}

export async function recordNodeRunFailure(params: {
  executionId: string;
  nodeId: string;
  durationMs: number;
  errorMessage: string;
}): Promise<void> {
  try {
    await prisma.executionNodeRun.updateMany({
      where: {
        executionId: params.executionId,
        nodeId: params.nodeId,
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs: params.durationMs,
        // Truncate to keep the column bounded; full stack lives in logs.
        error: params.errorMessage.slice(0, 4000),
      },
    });
  } catch {
    // Observability must never break execution.
  }
}
