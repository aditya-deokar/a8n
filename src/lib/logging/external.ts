import { normalizeError } from "@/lib/logging/errors";
import { logger } from "@/lib/logging/logger";
import { safeUrl } from "@/lib/logging/redaction";
import type { LogComponent, LogFields } from "@/lib/logging/types";

type ExternalProviderLogContext = {
  provider: string;
  operation: string;
  component?: LogComponent;
  nodeId?: string;
  nodeType?: string;
  workflowId?: string;
  executionId?: string;
  inngestEventId?: string;
  userId?: string;
  model?: string;
  method?: string;
  host?: string;
  retryable?: boolean;
  fields?: LogFields;
};

type ObserveExternalProviderOptions<T> = ExternalProviderLogContext & {
  statusCode?: (result: T) => number | undefined;
  successFields?: (result: T) => LogFields;
};

function statusCodeFromError(error: unknown): number | undefined {
  const candidate = error as {
    response?: { status?: unknown };
    status?: unknown;
    statusCode?: unknown;
  } | null;

  const status =
    candidate?.response?.status ||
    candidate?.status ||
    candidate?.statusCode;

  return typeof status === "number" ? status : undefined;
}

function retryableFromStatus(statusCode?: number) {
  if (!statusCode) return undefined;
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function providerFields(
  context: ExternalProviderLogContext,
  fields: LogFields = {},
): LogFields {
  return {
    component: context.component || "workflow",
    provider: context.provider,
    operation: context.operation,
    nodeId: context.nodeId,
    nodeType: context.nodeType,
    workflowId: context.workflowId,
    executionId: context.executionId,
    inngestEventId: context.inngestEventId,
    userId: context.userId,
    model: context.model,
    method: context.method,
    host: context.host,
    ...context.fields,
    ...fields,
  };
}

export function safeProviderHost(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(safeUrl(url)).host;
  } catch {
    return undefined;
  }
}

export function aiTelemetryOptions() {
  const canRecordPayloads =
    process.env.NODE_ENV !== "production" &&
    process.env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED === "true";

  return {
    isEnabled: true,
    recordInputs: canRecordPayloads,
    recordOutputs: canRecordPayloads,
  };
}

export async function observeExternalProvider<T>(
  options: ObserveExternalProviderOptions<T>,
  operation: () => Promise<T>,
): Promise<T> {
  const started = Date.now();

  try {
    const result = await operation();
    const statusCode = options.statusCode?.(result);

    logger.info(
      providerFields(options, {
        event: "external_provider_request_completed",
        statusCode,
        durationMs: Date.now() - started,
        retryable: options.retryable ?? retryableFromStatus(statusCode),
        ...options.successFields?.(result),
      }),
      "External provider request completed.",
    );

    return result;
  } catch (error) {
    const statusCode = statusCodeFromError(error);

    logger.error(
      providerFields(options, {
        event: "external_provider_request_failed",
        statusCode,
        durationMs: Date.now() - started,
        retryable: options.retryable ?? retryableFromStatus(statusCode),
        error: normalizeError(error),
      }),
      "External provider request failed.",
    );

    throw error;
  }
}
