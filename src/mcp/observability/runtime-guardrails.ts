import { MCP_CONFIG } from "@/mcp/config";
import { logger } from "@/lib/logging";
import { getToolContract } from "@/mcp/contracts/tools.manifest";
import type { McpToolContract, McpToolRisk } from "@/mcp/contracts/types";

export type McpRuntimeEventType =
  | "mcp_request"
  | "tool_call"
  | "auth_failure"
  | "scope_denial"
  | "oauth_token_error"
  | "rate_limit_denial"
  | "prompt_injection_warning"
  | "approval_requested"
  | "approval_accepted"
  | "approval_denied"
  | "execution_outcome"
  | "runtime_guardrail_denial"
  | "audit_persist_failure";

export type McpRuntimeEvent = {
  type: McpRuntimeEventType;
  timestamp?: string;
  correlationId?: string;
  userId?: string;
  authMethod?: "api_key" | "session" | "oauth" | "unknown";
  oauthClientId?: string;
  tool?: string;
  risk?: McpToolRisk;
  profile?: "default" | "chatgpt" | "unknown";
  status?: "success" | "error" | "denied" | "warning";
  durationMs?: number;
  error?: string;
  count?: number;
};

export type McpAlertSeverity = "info" | "warning" | "critical";

export type McpAlert = {
  id: string;
  severity: McpAlertSeverity;
  triggered: boolean;
  metric: string;
  value: number;
  threshold: number;
  runbook: string;
};

export type McpRuntimeFeatureFlags = {
  disableSideEffectTools: boolean;
  disableCredentialMutation: boolean;
  disableOAuthDynamicRegistration: boolean;
  forceReadOnlyChatGptProfile: boolean;
  strictSafetyMode: boolean;
};

type RuntimeMetrics = {
  eventCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  authFailureCount: number;
  scopeDenialCount: number;
  oauthTokenErrorCount: number;
  rateLimitDenialCount: number;
  promptInjectionWarningCount: number;
  approvalRequestedCount: number;
  approvalAcceptedCount: number;
  approvalDeniedCount: number;
  runtimeGuardrailDenialCount: number;
  auditPersistFailureCount: number;
  avgToolDurationMs: number;
  toolCounts: Record<string, number>;
  riskCounts: Record<string, number>;
  profileCounts: Record<string, number>;
  lastEventAt: string | null;
};

const RECENT_EVENT_LIMIT = 200;
const runtimeMetrics: RuntimeMetrics = {
  eventCount: 0,
  toolCallCount: 0,
  toolErrorCount: 0,
  authFailureCount: 0,
  scopeDenialCount: 0,
  oauthTokenErrorCount: 0,
  rateLimitDenialCount: 0,
  promptInjectionWarningCount: 0,
  approvalRequestedCount: 0,
  approvalAcceptedCount: 0,
  approvalDeniedCount: 0,
  runtimeGuardrailDenialCount: 0,
  auditPersistFailureCount: 0,
  avgToolDurationMs: 0,
  toolCounts: {},
  riskCounts: {},
  profileCounts: {},
  lastEventAt: null,
};

let totalToolDurationMs = 0;
const recentEvents: Array<McpRuntimeEvent & { type: McpRuntimeEventType; timestamp: string }> = [];

function configuredThreshold(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function eventAgeWithinWindow(event: McpRuntimeEvent, windowMs: number) {
  const timestamp = event.timestamp ? Date.parse(event.timestamp) : Date.now();
  return Date.now() - timestamp <= windowMs;
}

function redactEventString(value: string): string {
  return value
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(token|secret|authorization)(["':=\s]+)[^\s<>"']{8,}/gi, "$1$2[REDACTED]");
}

function sanitizeRuntimeEvent(event: McpRuntimeEvent): McpRuntimeEvent {
  return {
    ...event,
    userId: event.userId ? redactEventString(event.userId) : undefined,
    oauthClientId: event.oauthClientId ? redactEventString(event.oauthClientId) : undefined,
    error: event.error ? redactEventString(event.error) : undefined,
  };
}

function increment(map: Record<string, number>, key: string | undefined) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function logRuntimeEvent(event: McpRuntimeEvent & { type: McpRuntimeEventType; timestamp: string }) {
  const fields = {
    component: "mcp" as const,
    event: "mcp_runtime_event",
    mcpEventType: event.type,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
    userId: event.userId,
    authMethod: event.authMethod,
    oauthClientId: event.oauthClientId,
    tool: event.tool,
    risk: event.risk,
    profile: event.profile,
    status: event.status,
    durationMs: event.durationMs,
    error: event.error,
    count: event.count,
  };

  if (event.type === "audit_persist_failure" || event.status === "error") {
    logger.error(fields, "MCP runtime event recorded.");
  } else if (event.status === "warning" || event.status === "denied") {
    logger.warn(fields, "MCP runtime event recorded.");
  } else {
    logger.info(fields, "MCP runtime event recorded.");
  }
}

export function getMcpRuntimeFeatureFlags(): McpRuntimeFeatureFlags {
  return {
    disableSideEffectTools: MCP_CONFIG.DISABLE_SIDE_EFFECT_TOOLS,
    disableCredentialMutation: MCP_CONFIG.DISABLE_CREDENTIAL_MUTATION,
    disableOAuthDynamicRegistration:
      !MCP_CONFIG.OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION,
    forceReadOnlyChatGptProfile: MCP_CONFIG.FORCE_READ_ONLY_CHATGPT_PROFILE,
    strictSafetyMode: MCP_CONFIG.SAFETY_STRICT_MODE,
  };
}

export function inferToolContract(toolName: string): McpToolContract | undefined {
  const normalized = toolName.split(".")[0] || toolName;
  return getToolContract(normalized);
}

export function inferRuntimeEventType(toolName: string): McpRuntimeEventType {
  if (toolName === "mcp_request") return "mcp_request";
  if (toolName.endsWith(".approval_requested")) return "approval_requested";
  if (toolName.endsWith(".approval_accepted")) return "approval_accepted";
  if (toolName.endsWith(".approval_denied")) return "approval_denied";
  return "tool_call";
}

export function recordMcpRuntimeEvent(event: McpRuntimeEvent): McpRuntimeEvent {
  const timestamp = event.timestamp || nowIso();
  const safeEvent = sanitizeRuntimeEvent({ ...event, timestamp }) as McpRuntimeEvent & {
    type: McpRuntimeEventType;
    timestamp: string;
  };
  runtimeMetrics.eventCount++;
  runtimeMetrics.lastEventAt = timestamp;

  if (safeEvent.tool) runtimeMetrics.toolCounts[safeEvent.tool] = (runtimeMetrics.toolCounts[safeEvent.tool] || 0) + 1;
  increment(runtimeMetrics.riskCounts, safeEvent.risk);
  increment(runtimeMetrics.profileCounts, safeEvent.profile);

  switch (safeEvent.type) {
    case "tool_call":
      runtimeMetrics.toolCallCount++;
      if (safeEvent.status === "error") runtimeMetrics.toolErrorCount++;
      if (typeof safeEvent.durationMs === "number") {
        totalToolDurationMs += safeEvent.durationMs;
        runtimeMetrics.avgToolDurationMs = Math.round(
          totalToolDurationMs / Math.max(runtimeMetrics.toolCallCount, 1),
        );
      }
      break;
    case "auth_failure":
      runtimeMetrics.authFailureCount++;
      break;
    case "scope_denial":
      runtimeMetrics.scopeDenialCount++;
      break;
    case "oauth_token_error":
      runtimeMetrics.oauthTokenErrorCount++;
      break;
    case "rate_limit_denial":
      runtimeMetrics.rateLimitDenialCount++;
      break;
    case "prompt_injection_warning":
      runtimeMetrics.promptInjectionWarningCount += safeEvent.count || 1;
      break;
    case "approval_requested":
      runtimeMetrics.approvalRequestedCount++;
      if (safeEvent.status === "denied") runtimeMetrics.approvalDeniedCount++;
      break;
    case "approval_accepted":
      runtimeMetrics.approvalAcceptedCount++;
      break;
    case "approval_denied":
      runtimeMetrics.approvalDeniedCount++;
      break;
    case "runtime_guardrail_denial":
      runtimeMetrics.runtimeGuardrailDenialCount++;
      break;
    case "audit_persist_failure":
      runtimeMetrics.auditPersistFailureCount++;
      break;
    default:
      break;
  }

  recentEvents.push(safeEvent as McpRuntimeEvent & { type: McpRuntimeEventType; timestamp: string });
  if (recentEvents.length > RECENT_EVENT_LIMIT) recentEvents.shift();

  if (MCP_CONFIG.OBSERVABILITY_LOG_ENABLED) logRuntimeEvent(safeEvent);

  return safeEvent;
}

function recentCount(type: McpRuntimeEventType, windowMs: number) {
  return recentEvents.filter(
    (event) => event.type === type && eventAgeWithinWindow(event, windowMs),
  ).length;
}

export function evaluateMcpAlertRules(): McpAlert[] {
  const windowMs = configuredThreshold(MCP_CONFIG.ALERT_WINDOW_MS, 300_000);
  const recentToolCalls = Math.max(recentCount("tool_call", windowMs), 1);
  const recentToolErrors = recentEvents.filter(
    (event) =>
      event.type === "tool_call" &&
      event.status === "error" &&
      eventAgeWithinWindow(event, windowMs),
  ).length;
  const toolErrorRate = Math.round((recentToolErrors / recentToolCalls) * 100);

  const alerts: McpAlert[] = [
    {
      id: "mcp-auth-failure-spike",
      severity: "warning",
      metric: "authFailures",
      value: recentCount("auth_failure", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_AUTH_FAILURE_THRESHOLD, 20),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-auth-failure-spike",
      triggered: false,
    },
    {
      id: "mcp-scope-denial-spike",
      severity: "warning",
      metric: "scopeDenials",
      value: recentCount("scope_denial", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_SCOPE_DENIAL_THRESHOLD, 20),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-scope-denial-spike",
      triggered: false,
    },
    {
      id: "mcp-prompt-injection-spike",
      severity: "critical",
      metric: "promptInjectionWarnings",
      value: recentCount("prompt_injection_warning", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_PROMPT_INJECTION_THRESHOLD, 5),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-prompt-injection-spike",
      triggered: false,
    },
    {
      id: "mcp-approval-bypass-attempts",
      severity: "critical",
      metric: "approvalRequests",
      value: recentCount("approval_requested", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_APPROVAL_BYPASS_THRESHOLD, 3),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-approval-bypass-attempts",
      triggered: false,
    },
    {
      id: "mcp-tool-error-rate",
      severity: "warning",
      metric: "toolErrorRatePercent",
      value: toolErrorRate,
      threshold: configuredThreshold(MCP_CONFIG.ALERT_TOOL_ERROR_RATE_PERCENT, 10),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-tool-error-rate",
      triggered: false,
    },
    {
      id: "mcp-rate-limit-saturation",
      severity: "warning",
      metric: "rateLimitDenials",
      value: recentCount("rate_limit_denial", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_RATE_LIMIT_DENIAL_THRESHOLD, 25),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-rate-limit-saturation",
      triggered: false,
    },
    {
      id: "mcp-oauth-token-errors",
      severity: "warning",
      metric: "oauthTokenErrors",
      value: recentCount("oauth_token_error", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_OAUTH_TOKEN_ERROR_THRESHOLD, 10),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-oauth-token-errors",
      triggered: false,
    },
    {
      id: "mcp-audit-persistence-failed",
      severity: "critical",
      metric: "auditPersistFailures",
      value: recentCount("audit_persist_failure", windowMs),
      threshold: configuredThreshold(MCP_CONFIG.ALERT_AUDIT_PERSIST_FAILURE_THRESHOLD, 1),
      runbook: "docs/mcp/observability/alert-rules.md#mcp-audit-persistence-failed",
      triggered: false,
    },
  ];

  return alerts.map((alert) => ({
    ...alert,
    triggered: alert.value >= alert.threshold && alert.threshold > 0,
  }));
}

export function getMcpDashboardSpecs() {
  return [
    {
      id: "mcp-health",
      title: "MCP health",
      panels: ["request volume", "tool error rate", "p95 latency", "rate-limit denials"],
    },
    {
      id: "mcp-auth-oauth",
      title: "Auth and OAuth health",
      panels: ["401/403 count", "OAuth token errors", "resource mismatch", "client id"],
    },
    {
      id: "mcp-tool-usage",
      title: "Tool usage and latency",
      panels: ["top tools", "risk mix", "profile mix", "duration by tool"],
    },
    {
      id: "mcp-safety",
      title: "Safety events",
      panels: ["prompt-injection warnings", "approval bypass attempts", "guardrail denials"],
    },
    {
      id: "mcp-evals",
      title: "Evals trend",
      panels: ["offline pass rate", "live eval pass rate", "adversarial corpus failures"],
    },
    {
      id: "mcp-incidents",
      title: "Incident regression coverage",
      panels: ["open incidents", "severity", "linked regression eval ids"],
    },
  ];
}

export function getMcpObservabilitySnapshot() {
  const alerts = evaluateMcpAlertRules();
  return {
    enabled: MCP_CONFIG.OBSERVABILITY_LOG_ENABLED,
    windowMs: MCP_CONFIG.ALERT_WINDOW_MS,
    metrics: {
      ...runtimeMetrics,
      topTools: Object.entries(runtimeMetrics.toolCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tool, count]) => ({ tool, count })),
    },
    alerts,
    activeAlerts: alerts.filter((alert) => alert.triggered),
    featureFlags: getMcpRuntimeFeatureFlags(),
    dashboards: getMcpDashboardSpecs(),
  };
}

export function assertMcpRuntimeGuardrailForTool(toolName: string): void {
  const contract = inferToolContract(toolName);
  if (!contract) return;

  const flags = getMcpRuntimeFeatureFlags();
  const deniedReasons: string[] = [];

  if (flags.disableSideEffectTools && contract.externalSideEffect) {
    deniedReasons.push("side-effect tools are disabled");
  }

  if (
    flags.disableCredentialMutation &&
    contract.domain === "credentials" &&
    contract.risk !== "read_only"
  ) {
    deniedReasons.push("credential mutation is disabled");
  }

  if (deniedReasons.length === 0) return;

  recordMcpRuntimeEvent({
    type: "runtime_guardrail_denial",
    tool: contract.name,
    risk: contract.risk,
    profile: contract.profiles.includes("chatgpt") ? "chatgpt" : "default",
    status: "denied",
    error: deniedReasons.join("; "),
  });

  throw new Error(
    `MCP runtime guardrail blocked ${contract.name}: ${deniedReasons.join("; ")}.`,
  );
}

export function resetMcpObservabilityForTests(): void {
  runtimeMetrics.eventCount = 0;
  runtimeMetrics.toolCallCount = 0;
  runtimeMetrics.toolErrorCount = 0;
  runtimeMetrics.authFailureCount = 0;
  runtimeMetrics.scopeDenialCount = 0;
  runtimeMetrics.oauthTokenErrorCount = 0;
  runtimeMetrics.rateLimitDenialCount = 0;
  runtimeMetrics.promptInjectionWarningCount = 0;
  runtimeMetrics.approvalRequestedCount = 0;
  runtimeMetrics.approvalAcceptedCount = 0;
  runtimeMetrics.approvalDeniedCount = 0;
  runtimeMetrics.runtimeGuardrailDenialCount = 0;
  runtimeMetrics.auditPersistFailureCount = 0;
  runtimeMetrics.avgToolDurationMs = 0;
  runtimeMetrics.toolCounts = {};
  runtimeMetrics.riskCounts = {};
  runtimeMetrics.profileCounts = {};
  runtimeMetrics.lastEventAt = null;
  totalToolDurationMs = 0;
  recentEvents.splice(0, recentEvents.length);
}
