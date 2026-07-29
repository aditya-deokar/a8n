export type AgentErrorCode =
  | "AGENT_UNAUTHORIZED"
  | "AGENT_FEATURE_DISABLED"
  | "AGENT_KILL_SWITCHED"
  | "AGENT_THREAD_NOT_FOUND"
  | "AGENT_WORKFLOW_NOT_FOUND"
  | "AGENT_MODEL_UNAVAILABLE"
  | "AGENT_TOOL_NOT_ALLOWED"
  | "AGENT_TOOL_VALIDATION_FAILED"
  | "AGENT_SAFETY_BLOCKED"
  | "AGENT_APPROVAL_REQUIRED"
  | "AGENT_APPROVAL_EXPIRED"
  | "AGENT_STALE_WORKFLOW"
  | "AGENT_MEMORY_UNAVAILABLE"
  | "AGENT_RUN_LIMIT_EXCEEDED"
  | "AGENT_INTERNAL_ERROR";

export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AgentError";
  }
}
