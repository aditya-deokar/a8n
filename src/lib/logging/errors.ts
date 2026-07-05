import { redactLogString } from "@/lib/logging/redaction";
import type { SerializedLogError } from "@/lib/logging/types";

function includeErrorStack() {
  return process.env.OBSERVABILITY_INCLUDE_ERROR_STACK === "true";
}

function errorCode(error: Error): string | undefined {
  const candidate = error as Error & { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

export function normalizeError(error: unknown): SerializedLogError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: redactLogString(error.message),
      code: errorCode(error),
      stack: includeErrorStack() && error.stack ? redactLogString(error.stack) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactLogString(String(error)),
  };
}
