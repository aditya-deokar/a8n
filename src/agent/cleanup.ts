/**
 * Agent cleanup jobs.
 *
 * Background-callable functions that clean up expired approvals,
 * stale runs, and expired memories. Each function returns a count
 * for metrics and logging.
 */

import prisma from "@/lib/db";
import { AGENT_CONFIG } from "@/agent/config";
import { agentMemoryStore } from "@/agent/memory/store";
import { recordAgentMetric, AGENT_METRICS } from "@/agent/observability/metrics";
import { emitAgentEvent } from "@/agent/observability/tracing";

/**
 * Mark expired pending approvals as EXPIRED.
 *
 * Approvals that have passed their expiresAt without being resolved
 * are marked as expired so they no longer block any paused runs.
 */
export async function cleanupExpiredApprovals(): Promise<number> {
  const now = new Date();

  const result = await prisma.agentApproval.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      resolvedAt: now,
    },
  });

  const count = result.count;

  if (count > 0) {
    recordAgentMetric(AGENT_METRICS.CLEANUP_APPROVALS_EXPIRED, count);
    emitAgentEvent("cleanup.approvals.expired", { expiredCount: count });
  }

  return count;
}

/**
 * Mark stale runs as FAILED.
 *
 * Runs stuck in RUNNING status for longer than the configured timeout
 * are assumed to have crashed and are marked as failed.
 */
export async function cleanupStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - AGENT_CONFIG.staleRunTimeoutMs);

  const result = await prisma.agentRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lte: cutoff },
    },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: "AGENT_INTERNAL_ERROR",
      errorMessage: "Run was marked as stale after exceeding the timeout.",
    },
  });

  const count = result.count;

  if (count > 0) {
    recordAgentMetric(AGENT_METRICS.CLEANUP_RUNS_STALE, count);
    emitAgentEvent("cleanup.runs.stale", { staleCount: count });
  }

  return count;
}

/**
 * Purge expired long-term memories.
 *
 * Delegates to the AgentMemoryStore's purgeExpired method which
 * soft-deletes memories past their TTL.
 */
export async function cleanupExpiredMemories(): Promise<number> {
  const count = await agentMemoryStore.purgeExpired();

  if (count > 0) {
    recordAgentMetric(AGENT_METRICS.CLEANUP_MEMORIES_EXPIRED, count);
    emitAgentEvent("cleanup.memories.expired", { expiredCount: count });
  }

  return count;
}

/**
 * Run all cleanup jobs and return a summary.
 */
export async function runAllCleanupJobs(): Promise<{
  expiredApprovals: number;
  staleRuns: number;
  expiredMemories: number;
}> {
  const [expiredApprovals, staleRuns, expiredMemories] = await Promise.all([
    cleanupExpiredApprovals(),
    cleanupStaleRuns(),
    cleanupExpiredMemories(),
  ]);

  emitAgentEvent("cleanup.all.completed", {
    expiredApprovals,
    staleRuns,
    expiredMemories,
  });

  return { expiredApprovals, staleRuns, expiredMemories };
}
