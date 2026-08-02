/**
 * Typed agent metrics.
 *
 * Pre-defined metric names for all agent subsystems, emitted through
 * the project's existing recordMetric utility.
 */

import { recordMetric } from "@/lib/observability";

/**
 * All agent metric names. Using a const object for type safety.
 */
export const AGENT_METRICS = {
  // Run lifecycle
  RUN_STARTED: "agent.run.started",
  RUN_COMPLETED: "agent.run.completed",
  RUN_FAILED: "agent.run.failed",
  RUN_CANCELLED: "agent.run.cancelled",

  // Tool calls
  TOOL_CALL_STARTED: "agent.tool.call.started",
  TOOL_CALL_COMPLETED: "agent.tool.call.completed",
  TOOL_CALL_FAILED: "agent.tool.call.failed",

  // Model usage
  MODEL_TOKENS_INPUT: "agent.model.tokens.input",
  MODEL_TOKENS_OUTPUT: "agent.model.tokens.output",
  MODEL_COST_ESTIMATED: "agent.model.cost.estimated",
  MODEL_FALLBACK_USED: "agent.model.fallback.used",

  // Draft lifecycle
  DRAFT_CREATED: "agent.draft.created",
  DRAFT_VALIDATED: "agent.draft.validated",
  DRAFT_APPLIED: "agent.draft.applied",

  // Approval lifecycle
  APPROVAL_REQUESTED: "agent.approval.requested",
  APPROVAL_APPROVED: "agent.approval.approved",
  APPROVAL_REJECTED: "agent.approval.rejected",
  APPROVAL_EXPIRED: "agent.approval.expired",

  // Memory operations
  MEMORY_WRITE: "agent.memory.write",
  MEMORY_SEARCH: "agent.memory.search",
  MEMORY_DELETE: "agent.memory.delete",
  MEMORY_EXTRACTION_REJECTED: "agent.memory.extraction.rejected",

  // Safety
  SAFETY_BLOCKED: "agent.safety.blocked",
  SAFETY_SECRET_DETECTED: "agent.safety.secret.detected",

  // Concurrency
  CONCURRENCY_LIMIT_HIT: "agent.concurrency.limit.hit",

  // Cleanup
  CLEANUP_APPROVALS_EXPIRED: "agent.cleanup.approvals.expired",
  CLEANUP_RUNS_STALE: "agent.cleanup.runs.stale",
  CLEANUP_MEMORIES_EXPIRED: "agent.cleanup.memories.expired",
} as const;

export type AgentMetricName = (typeof AGENT_METRICS)[keyof typeof AGENT_METRICS];

type MetricAttributes = Record<string, unknown>;

/**
 * Record a typed agent metric.
 */
export function recordAgentMetric(
  name: AgentMetricName,
  value: number = 1,
  attributes: MetricAttributes = {},
): void {
  recordMetric(name, value, attributes);
}

/**
 * Record a run start metric with standard attributes.
 */
export function recordRunStart(attrs: {
  userId: string;
  threadId: string;
  runId: string;
  modelProvider: string;
  modelName: string;
  workflowId?: string;
}): void {
  recordAgentMetric(AGENT_METRICS.RUN_STARTED, 1, attrs);
}

/**
 * Record a run completion metric with duration and token info.
 */
export function recordRunComplete(attrs: {
  userId: string;
  threadId: string;
  runId: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  status: "succeeded" | "failed" | "cancelled";
}): void {
  const metricName =
    attrs.status === "succeeded"
      ? AGENT_METRICS.RUN_COMPLETED
      : attrs.status === "cancelled"
        ? AGENT_METRICS.RUN_CANCELLED
        : AGENT_METRICS.RUN_FAILED;

  recordAgentMetric(metricName, 1, attrs);

  if (attrs.inputTokens) {
    recordAgentMetric(AGENT_METRICS.MODEL_TOKENS_INPUT, attrs.inputTokens, {
      userId: attrs.userId,
      runId: attrs.runId,
    });
  }
  if (attrs.outputTokens) {
    recordAgentMetric(AGENT_METRICS.MODEL_TOKENS_OUTPUT, attrs.outputTokens, {
      userId: attrs.userId,
      runId: attrs.runId,
    });
  }
  if (attrs.estimatedCostUsd) {
    recordAgentMetric(AGENT_METRICS.MODEL_COST_ESTIMATED, attrs.estimatedCostUsd, {
      userId: attrs.userId,
      runId: attrs.runId,
    });
  }
}

/**
 * Record a tool call metric.
 */
export function recordToolCall(attrs: {
  userId: string;
  runId: string;
  toolName: string;
  durationMs: number;
  status: "completed" | "failed";
}): void {
  const metricName =
    attrs.status === "completed"
      ? AGENT_METRICS.TOOL_CALL_COMPLETED
      : AGENT_METRICS.TOOL_CALL_FAILED;

  recordAgentMetric(metricName, 1, attrs);
}
