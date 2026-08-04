/**
 * Agent observability tracing.
 *
 * Wraps agent operations in structured observability spans using the
 * project's existing observability layer. Each span records userId,
 * threadId, runId, workflowId, duration, status, and error info.
 */

import {
  emitObservabilityEvent,
  captureException,
  type ObservabilityEvent,
} from "@/lib/observability";

export type AgentSpanAttributes = {
  userId?: string;
  threadId?: string;
  runId?: string;
  workflowId?: string;
  correlationId?: string;
  modelProvider?: string;
  modelName?: string;
  graphNode?: string;
  toolName?: string;
  safetyLabel?: string;
  approvalState?: string;
  tokenCount?: number;
  estimatedCostUsd?: number;
  [key: string]: unknown;
};

/**
 * Wrap an async operation in an agent observability span.
 *
 * Automatically records duration, status (success/error), and
 * redacted attributes. Uses the existing emitObservabilityEvent
 * and captureException utilities.
 */
export async function agentSpan<T>(
  name: string,
  attributes: AgentSpanAttributes,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await operation();
    const durationMs = Date.now() - startedAt;

    emitObservabilityEvent({
      name: `agent.${name}`,
      component: "mcp",
      severity: "info",
      message: `Agent span completed: ${name}`,
      correlationId: attributes.correlationId,
      userId: attributes.userId,
      durationMs,
      attributes: {
        ...redactSpanAttributes(attributes),
        status: "success",
      },
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    captureException(error, {
      name: `agent.${name}`,
      component: "mcp",
      correlationId: attributes.correlationId,
      userId: attributes.userId,
      durationMs,
      attributes: {
        ...redactSpanAttributes(attributes),
        status: "error",
      },
    });

    throw error;
  }
}

/**
 * Emit a fire-and-forget agent event (no wrapping, just log it).
 */
export function emitAgentEvent(
  name: string,
  attributes: AgentSpanAttributes = {},
): void {
  emitObservabilityEvent({
    name: `agent.${name}`,
    component: "mcp",
    severity: "info",
    correlationId: attributes.correlationId,
    userId: attributes.userId,
    attributes: redactSpanAttributes(attributes),
  });
}

/**
 * Strip sensitive fields from span attributes before logging.
 */
function redactSpanAttributes(
  attributes: AgentSpanAttributes,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attributes)) {
    // Skip any keys that might contain sensitive data
    if (
      key.toLowerCase().includes("prompt") ||
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("password") ||
      key.toLowerCase().includes("credential") ||
      key.toLowerCase().includes("token") && key !== "tokenCount" ||
      key.toLowerCase().includes("authorization") ||
      key.toLowerCase().includes("apikey")
    ) {
      safe[key] = "[REDACTED]";
      continue;
    }

    // Truncate long string values
    if (typeof value === "string" && value.length > 500) {
      safe[key] = value.slice(0, 500) + "...[truncated]";
      continue;
    }

    safe[key] = value;
  }

  return safe;
}
