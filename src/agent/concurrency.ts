/**
 * Per-user concurrent run limiter.
 *
 * Uses a database-backed count of active runs to enforce concurrency
 * limits. This prevents a single user from overwhelming the agent
 * system with parallel requests.
 */

import prisma from "@/lib/db";
import { AgentError } from "@/agent/errors";
import { AGENT_CONFIG } from "@/agent/config";
import { recordAgentMetric, AGENT_METRICS } from "@/agent/observability/metrics";

/**
 * Acquire a run slot for the given user.
 *
 * Checks that the user has not exceeded the maximum number of
 * concurrent runs. Does not hold a lock — uses a point-in-time
 * count which is sufficient for rate limiting.
 *
 * @throws {AgentError} with code AGENT_RUN_LIMIT_EXCEEDED if the limit is hit.
 */
export async function acquireRunSlot(userId: string): Promise<void> {
  const activeRunCount = await prisma.agentRun.count({
    where: {
      userId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeRunCount >= AGENT_CONFIG.maxConcurrentRunsPerUser) {
    recordAgentMetric(AGENT_METRICS.CONCURRENCY_LIMIT_HIT, 1, { userId });

    throw new AgentError(
      "AGENT_RUN_LIMIT_EXCEEDED",
      `You have ${activeRunCount} active agent runs. The maximum is ${AGENT_CONFIG.maxConcurrentRunsPerUser}. Please wait for a run to complete before starting another.`,
    );
  }
}

/**
 * Release a run slot. This is a no-op since we use count-based limiting,
 * but it serves as a documentation marker in the run lifecycle.
 */
export function releaseRunSlot(_userId: string): void {
  // Count-based limiting — nothing to release.
  // The slot is freed when the run status changes from RUNNING/QUEUED.
}
