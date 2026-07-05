/**
 * Audit Logger Middleware
 *
 * Structured logging for every MCP tool invocation.
 * Logs who called what, with what inputs, and the result.
 * Credential values and other sensitive data are automatically sanitized.
 *
 * Enhanced in Phase 5 with:
 *   - IP address and User-Agent tracking
 *   - Request metrics aggregation
 *   - Structured JSON compatible with Datadog, Grafana, CloudWatch
 */

import { MCP_CONFIG } from "../config";
import type { Prisma } from "@/generated/prisma";
import {
  logger,
  normalizeError,
  redactLogFields,
} from "@/lib/logging";
import { getToolContract } from "@/mcp/contracts/tools.manifest";
import type { McpToolRisk } from "@/mcp/contracts/types";
import {
  inferRuntimeEventType,
  recordMcpRuntimeEvent,
} from "@/mcp/observability/runtime-guardrails";

/** A single audit log entry */
export interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  userId: string;
  apiKeyId?: string;
  authMethod: "api_key" | "session" | "oauth";
  oauthClientId?: string;
  tool: string;
  risk?: McpToolRisk;
  profile?: "default" | "chatgpt" | "unknown";
  input: Record<string, unknown>;
  durationMs: number;
  status: "success" | "error";
  error?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Deep-sanitize an object by redacting values of sensitive keys.
 */
function sanitizeInput(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return redactLogFields(obj);
}

/**
 * Generate a unique correlation ID for request tracing.
 */
function generateCorrelationId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Request Metrics (In-Memory) ────────────────────────────

interface RequestMetrics {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  toolCounts: Record<string, number>;
  riskCounts: Record<string, number>;
  profileCounts: Record<string, number>;
  lastRequestAt: string;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  avgDurationMs: 0,
  toolCounts: {},
  riskCounts: {},
  profileCounts: {},
  lastRequestAt: "",
};

let totalDurationMs = 0;

function updateMetrics(entry: AuditLogEntry) {
  metrics.totalRequests++;
  metrics.lastRequestAt = entry.timestamp;
  totalDurationMs += entry.durationMs;
  metrics.avgDurationMs = Math.round(totalDurationMs / metrics.totalRequests);

  if (entry.status === "success") {
    metrics.successCount++;
  } else {
    metrics.errorCount++;
  }

  metrics.toolCounts[entry.tool] = (metrics.toolCounts[entry.tool] || 0) + 1;
  if (entry.risk) metrics.riskCounts[entry.risk] = (metrics.riskCounts[entry.risk] || 0) + 1;
  if (entry.profile) {
    metrics.profileCounts[entry.profile] =
      (metrics.profileCounts[entry.profile] || 0) + 1;
  }
}

/**
 * Get current request metrics snapshot.
 * Used by the server_info tool and health endpoint.
 */
export function getRequestMetrics(): Readonly<RequestMetrics> {
  return { ...metrics };
}

export function isPersistentAuditEnabled(): boolean {
  return MCP_CONFIG.AUDIT_DB_ENABLED;
}

async function persistAuditEntry(entry: AuditLogEntry) {
  if (!MCP_CONFIG.AUDIT_DB_ENABLED) return;

  try {
    const prisma = (await import("@/lib/db")).default;
    await prisma.mcpAuditLog.create({
      data: {
        timestamp: new Date(entry.timestamp),
        correlationId: entry.correlationId,
        userId: entry.userId || null,
        apiKeyId: entry.apiKeyId || null,
        authMethod: entry.authMethod,
        tool: entry.tool,
        input: entry.input as Prisma.InputJsonValue,
        durationMs: entry.durationMs,
        status: entry.status,
        error: entry.error || null,
        ip: entry.ip || null,
        userAgent: entry.userAgent || null,
      },
    });
  } catch (error) {
    recordMcpRuntimeEvent({
      type: "audit_persist_failure",
      tool: entry.tool,
      risk: entry.risk,
      profile: entry.profile,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (MCP_CONFIG.AUDIT_LOG_ENABLED) {
      logger.error(
        {
          component: "mcp",
          event: "mcp_audit_persist_failed",
          correlationId: entry.correlationId,
          userId: entry.userId,
          authMethod: entry.authMethod,
          oauthClientId: entry.oauthClientId,
          tool: entry.tool,
          risk: entry.risk,
          profile: entry.profile,
          error: normalizeError(error),
        },
        "MCP audit persistence failed.",
      );
    }
  }
}

export async function listPersistedAuditEvents(params: {
  userId: string;
  limit: number;
  tool?: string;
  status?: "success" | "error";
}) {
  if (!MCP_CONFIG.AUDIT_DB_ENABLED) return [];

  const prisma = (await import("@/lib/db")).default;
  return prisma.mcpAuditLog.findMany({
    where: {
      userId: params.userId,
      tool: params.tool,
      status: params.status,
    },
    orderBy: { timestamp: "desc" },
    take: params.limit,
  });
}

// ─── Audit Context Factory ──────────────────────────────────

/**
 * Extract client IP and User-Agent from an HTTP request.
 */
export function extractRequestMeta(request: Request): {
  ip: string;
  userAgent: string;
} {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ip, userAgent };
}

/**
 * Create an audit logger instance for a single MCP tool call.
 *
 * Usage:
 *   const audit = createAuditContext({ userId, apiKeyId, tool, input });
 *   // ... execute tool ...
 *   audit.success();  // or audit.fail(error);
 */
export function createAuditContext(params: {
  userId: string;
  apiKeyId?: string;
  authMethod: "api_key" | "session" | "oauth";
  oauthClientId?: string;
  risk?: McpToolRisk;
  profile?: "default" | "chatgpt" | "unknown";
  tool: string;
  input: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  const contractToolName = params.tool.split(".")[0] || params.tool;
  const contract = getToolContract(contractToolName);
  const risk = params.risk || contract?.risk;
  const profile =
    params.profile ||
    (contract?.profiles.includes("chatgpt")
      ? "chatgpt"
      : contract
        ? "default"
        : "unknown");

  const baseEntry: Omit<AuditLogEntry, "durationMs" | "status" | "error"> = {
    timestamp: new Date().toISOString(),
    correlationId,
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    authMethod: params.authMethod,
    oauthClientId: params.oauthClientId,
    tool: params.tool,
    risk,
    profile,
    input: sanitizeInput(params.input),
    ip: params.ip,
    userAgent: params.userAgent,
  };

  function logEntry(entry: AuditLogEntry) {
    // Always update metrics, regardless of logging setting
    updateMetrics(entry);
    recordMcpRuntimeEvent({
      type: inferRuntimeEventType(entry.tool),
      correlationId: entry.correlationId,
      userId: entry.userId,
      authMethod: entry.authMethod,
      oauthClientId: entry.oauthClientId,
      tool: contractToolName,
      risk: entry.risk,
      profile: entry.profile,
      status: entry.status,
      durationMs: entry.durationMs,
      error: entry.error,
    });
    void persistAuditEntry(entry);

    if (!MCP_CONFIG.AUDIT_LOG_ENABLED) return;

    // Structured JSON logging — compatible with log aggregators
    // (Datadog, Grafana Loki, CloudWatch, etc.)
    const fields = redactLogFields({
      component: "mcp" as const,
      event: entry.status === "error" ? "mcp_tool_failed" : "mcp_tool_completed",
      correlationId: entry.correlationId,
      userId: entry.userId,
      apiKeyId: entry.apiKeyId,
      authMethod: entry.authMethod,
      oauthClientId: entry.oauthClientId,
      tool: entry.tool,
      risk: entry.risk,
      profile: entry.profile,
      durationMs: entry.durationMs,
      status: entry.status,
      ip: entry.ip,
      userAgent: entry.userAgent,
      auditInput: entry.input,
      error: entry.error ? normalizeError(entry.error) : undefined,
    });

    if (entry.status === "error") {
      logger.error(fields, "MCP tool invocation failed.");
    } else {
      logger.info(fields, "MCP tool invocation completed.");
    }
  }

  return {
    correlationId,

    /** Log a successful tool execution */
    success() {
      logEntry({
        ...baseEntry,
        durationMs: Date.now() - startTime,
        status: "success",
      });
    },

    /** Log a failed tool execution */
    fail(error: string) {
      logEntry({
        ...baseEntry,
        durationMs: Date.now() - startTime,
        status: "error",
        error,
      });
    },
  };
}
