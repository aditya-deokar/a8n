import "server-only";
import { currentEnvironment, currentRelease, logger, normalizeError, redactLogValue } from "@/lib/logging";

type ObservabilitySeverity = "debug" | "info" | "warn" | "error" | "critical";
type ObservabilityComponent =
  | "api"
  | "auth"
  | "billing"
  | "database"
  | "workflow"
  | "webhook"
  | "mcp"
  | "deployment"
  | "system";

type ObservabilityAttributes = Record<string, unknown>;

export type ObservabilityEvent = {
  name: string;
  component: ObservabilityComponent;
  severity?: ObservabilitySeverity;
  message?: string;
  correlationId?: string;
  userId?: string;
  durationMs?: number;
  attributes?: ObservabilityAttributes;
};

function shouldLog() {
  return process.env.OBSERVABILITY_LOG_ENABLED !== "false";
}

export function redactObservabilityValue(value: unknown): unknown {
  return redactLogValue(value);
}

export function emitObservabilityEvent(event: ObservabilityEvent) {
  if (!shouldLog()) return;

  const severity = event.severity || "info";
  const payload = {
    type: "observability_event",
    environment: currentEnvironment(),
    release: currentRelease(),
    provider: process.env.OBSERVABILITY_PROVIDER || "console",
    event: event.name,
    ...event,
    severity,
  };

  const level = severity === "critical" ? "fatal" : severity;
  logger[level](payload, event.message || event.name);
}

export function recordMetric(
  name: string,
  value: number,
  attributes: ObservabilityAttributes = {},
) {
  emitObservabilityEvent({
    name,
    component: "system",
    severity: "info",
    attributes: {
      metricValue: value,
      ...attributes,
    },
  });
}

export function captureException(
  error: unknown,
  event: Omit<ObservabilityEvent, "severity" | "message"> & { message?: string },
) {
  const normalizedError = normalizeError(error);

  emitObservabilityEvent({
    ...event,
    severity: "error",
    message: event.message || normalizedError.message,
    attributes: {
      ...event.attributes,
      error: normalizedError,
      errorName: normalizedError.name,
      errorMessage: normalizedError.message,
    },
  });
}

export async function observeDuration<T>(
  event: Omit<ObservabilityEvent, "durationMs">,
  operation: () => Promise<T>,
): Promise<T> {
  const started = Date.now();

  try {
    const result = await operation();
    emitObservabilityEvent({
      ...event,
      severity: event.severity || "info",
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    captureException(error, {
      ...event,
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
