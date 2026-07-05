export type { AppLogger } from "@/lib/logging/logger";
export type {
  LogComponent,
  LogContext,
  LogFields,
  LogLevel,
  SerializedLogError,
} from "@/lib/logging/types";
export {
  buildRequestLogContext,
  getLogContext,
  requestIdFromHeaders,
  runWithLogContext,
  traceContextFromHeaders,
} from "@/lib/logging/context";
export { normalizeError } from "@/lib/logging/errors";
export {
  aiTelemetryOptions,
  observeExternalProvider,
  safeProviderHost,
} from "@/lib/logging/external";
export { baseLogFields, currentEnvironment, currentRelease } from "@/lib/logging/fields";
export { createLogger, logger } from "@/lib/logging/logger";
export {
  isSensitiveLogKey,
  redactLogFields,
  redactLogString,
  redactLogValue,
  safeHeaders,
  safeUrl,
} from "@/lib/logging/redaction";
export { serializeRequest, serializeResponse, serializers } from "@/lib/logging/serializers";
export { withRequestLogging, type RequestLoggingOptions } from "@/lib/logging/http";
