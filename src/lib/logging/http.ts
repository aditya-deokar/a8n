import { buildRequestLogContext, runWithLogContext } from "@/lib/logging/context";
import { normalizeError } from "@/lib/logging/errors";
import { logger } from "@/lib/logging/logger";
import { safeUrl } from "@/lib/logging/redaction";
import type { LogComponent, LogFields } from "@/lib/logging/types";

type HandlerResult = Response | Promise<Response>;

export type RequestLoggingOptions = {
  component: LogComponent;
  route?: string;
  eventPrefix?: string;
  fields?: LogFields;
};

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

function addRequestIdHeader(response: Response, requestId?: string) {
  if (!requestId) return response;

  const headers = new Headers(response.headers);
  if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function routeFromRequest(request: Request, explicitRoute?: string) {
  if (explicitRoute) return explicitRoute;
  return new URL(request.url).pathname;
}

function completionEvent(prefix?: string) {
  return prefix ? `${prefix}_completed` : "http_request_completed";
}

function failureEvent(prefix?: string) {
  return prefix ? `${prefix}_failed` : "http_request_failed";
}

function logCompletion(fields: LogFields, statusCode: number) {
  const message = statusCode >= 500
    ? "HTTP request failed."
    : "HTTP request completed.";

  if (statusCode >= 500) {
    logger.error(fields, message);
  } else if (statusCode >= 400) {
    logger.warn(fields, message);
  } else {
    logger.info(fields, message);
  }
}

export function withRequestLogging<TRequest extends Request, TArgs extends unknown[]>(
  handler: (request: TRequest, ...args: TArgs) => HandlerResult,
  options: RequestLoggingOptions,
) {
  return async (request: TRequest, ...args: TArgs): Promise<Response> => {
    const started = Date.now();
    const route = routeFromRequest(request, options.route);
    const requestContext = buildRequestLogContext(request, {
      component: options.component,
      route,
    });

    return runWithLogContext(requestContext, async () => {
      try {
        const response = await handler(request, ...args);
        const responseWithRequestId = addRequestIdHeader(response, requestContext.requestId);
        const statusCode = responseWithRequestId.status;

        logCompletion(
          {
            ...options.fields,
            component: options.component,
            event: statusCode >= 500
              ? failureEvent(options.eventPrefix)
              : completionEvent(options.eventPrefix),
            route,
            method: request.method,
            statusCode,
            durationMs: Date.now() - started,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            traceId: requestContext.traceId,
            spanId: requestContext.spanId,
            ip: requestIp(request),
            userAgent: request.headers.get("user-agent") || undefined,
            url: safeUrl(request.url),
          },
          statusCode,
        );

        return responseWithRequestId;
      } catch (error) {
        logger.error(
          {
            ...options.fields,
            component: options.component,
            event: failureEvent(options.eventPrefix),
            route,
            method: request.method,
            durationMs: Date.now() - started,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            traceId: requestContext.traceId,
            spanId: requestContext.spanId,
            ip: requestIp(request),
            userAgent: request.headers.get("user-agent") || undefined,
            url: safeUrl(request.url),
            error: normalizeError(error),
          },
          "HTTP request failed.",
        );
        throw error;
      }
    });
  };
}
