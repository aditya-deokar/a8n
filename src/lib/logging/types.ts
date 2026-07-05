export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogComponent =
  | "api"
  | "trpc"
  | "auth"
  | "billing"
  | "database"
  | "workflow"
  | "webhook"
  | "mcp"
  | "deployment"
  | "system"
  | "client";

export type LogContext = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  route?: string;
  method?: string;
  component?: LogComponent;
  workflowId?: string;
  executionId?: string;
  inngestEventId?: string;
};

export type LogFields = Record<string, unknown> & {
  component?: LogComponent;
  event?: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
};

export type SerializedLogError = {
  name: string;
  message: string;
  code?: string;
  stack?: string;
};
