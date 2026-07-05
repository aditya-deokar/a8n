import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";
import { baseLogFields } from "@/lib/logging/fields";
import { getLogContext } from "@/lib/logging/context";
import { redactLogFields } from "@/lib/logging/redaction";
import { serializers } from "@/lib/logging/serializers";
import type { LogFields, LogLevel } from "@/lib/logging/types";

type LogMethodInput = LogFields | string;

export type AppLogger = {
  debug: (fieldsOrMessage: LogMethodInput, message?: string) => void;
  info: (fieldsOrMessage: LogMethodInput, message?: string) => void;
  warn: (fieldsOrMessage: LogMethodInput, message?: string) => void;
  error: (fieldsOrMessage: LogMethodInput, message?: string) => void;
  fatal: (fieldsOrMessage: LogMethodInput, message?: string) => void;
  child: (bindings: LogFields) => AppLogger;
  raw: PinoLogger;
};

function logLevel() {
  if (process.env.OBSERVABILITY_LOG_ENABLED === "false") return "silent";
  if (
    process.env.NODE_ENV === "test" &&
    process.env.OBSERVABILITY_LOG_ENABLED === undefined
  ) {
    return "silent";
  }

  return process.env.OBSERVABILITY_LOG_LEVEL || "info";
}

function shouldPrettyPrint() {
  return (
    process.env.OBSERVABILITY_LOG_FORMAT === "pretty" &&
    process.env.NODE_ENV !== "production"
  );
}

function rootLoggerOptions(): LoggerOptions {
  return {
    level: logLevel(),
    base: baseLogFields(),
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    mixin() {
      const context = getLogContext();
      return {
        ...context,
        trace_id: context.traceId,
        span_id: context.spanId,
        "dd.trace_id": context.traceId,
        "dd.span_id": context.spanId,
      };
    },
    serializers,
    transport: shouldPrettyPrint()
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        }
      : undefined,
  };
}

const rootPinoLogger = pino(rootLoggerOptions());

function normalizeArgs(fieldsOrMessage: LogMethodInput, message?: string) {
  if (typeof fieldsOrMessage === "string") {
    return [{}, fieldsOrMessage] as const;
  }

  return [redactLogFields(fieldsOrMessage), message] as const;
}

function wrapLogger(raw: PinoLogger): AppLogger {
  const write = (level: LogLevel, fieldsOrMessage: LogMethodInput, message?: string) => {
    const [fields, normalizedMessage] = normalizeArgs(fieldsOrMessage, message);
    if (normalizedMessage) {
      raw[level](fields, normalizedMessage);
    } else {
      raw[level](fields);
    }
  };

  return {
    debug: (fieldsOrMessage, message) => write("debug", fieldsOrMessage, message),
    info: (fieldsOrMessage, message) => write("info", fieldsOrMessage, message),
    warn: (fieldsOrMessage, message) => write("warn", fieldsOrMessage, message),
    error: (fieldsOrMessage, message) => write("error", fieldsOrMessage, message),
    fatal: (fieldsOrMessage, message) => write("fatal", fieldsOrMessage, message),
    child: (bindings) => wrapLogger(raw.child(redactLogFields(bindings))),
    raw,
  };
}

export const logger = wrapLogger(rootPinoLogger);

export function createLogger(bindings: LogFields = {}) {
  return logger.child(bindings);
}
