import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { context as otelContext, trace } from "@opentelemetry/api";
import type { LogContext } from "@/lib/logging/types";

const storage = new AsyncLocalStorage<LogContext>();

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return undefined;
}

export function activeTraceContext(): Pick<LogContext, "traceId" | "spanId"> {
  const span = trace.getSpan(otelContext.active());
  const spanContext = span?.spanContext();

  return {
    traceId: spanContext?.traceId,
    spanId: spanContext?.spanId,
  };
}

export function traceContextFromHeaders(headers: Headers): Pick<LogContext, "traceId" | "spanId"> {
  const traceparent = headers.get("traceparent");
  if (!traceparent) return {};

  const [, traceId, spanId] = traceparent.split("-");
  if (!traceId || !spanId) return {};

  return { traceId, spanId };
}

export function requestIdFromHeaders(headers: Headers) {
  return firstHeader(headers, ["x-request-id", "x-correlation-id", "x-vercel-id"]) || randomUUID();
}

export function getLogContext(): LogContext {
  return storage.getStore() || {};
}

export function runWithLogContext<T>(
  context: LogContext,
  callback: () => T,
): T {
  const parent = getLogContext();
  return storage.run(
    {
      ...parent,
      ...context,
      correlationId: context.correlationId || context.requestId || parent.correlationId,
    },
    callback,
  );
}

export function buildRequestLogContext(
  request: Request,
  context: Partial<LogContext> = {},
): LogContext {
  const requestId = context.requestId || requestIdFromHeaders(request.headers);
  const headerTrace = traceContextFromHeaders(request.headers);
  const activeTrace = activeTraceContext();

  return {
    ...context,
    traceId: context.traceId || headerTrace.traceId || activeTrace.traceId,
    spanId: context.spanId || headerTrace.spanId || activeTrace.spanId,
    requestId,
    correlationId: context.correlationId || requestId,
    method: context.method || request.method,
  };
}
