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

/** A single audit log entry */
export interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  userId: string;
  apiKeyId?: string;
  authMethod: "api_key" | "session";
  tool: string;
  input: Record<string, unknown>;
  durationMs: number;
  status: "success" | "error";
  error?: string;
  ip?: string;
  userAgent?: string;
}

/** Keys that should be redacted from audit logs */
const SENSITIVE_KEYS = new Set([
  "value",
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
  "encryptionKey",
  "rawKey",
]);

/**
 * Deep-sanitize an object by redacting values of sensitive keys.
 */
function sanitizeInput(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeInput(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
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
  lastRequestAt: string;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  avgDurationMs: 0,
  toolCounts: {},
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
}

/**
 * Get current request metrics snapshot.
 * Used by the server_info tool and health endpoint.
 */
export function getRequestMetrics(): Readonly<RequestMetrics> {
  return { ...metrics };
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
  authMethod: "api_key" | "session";
  tool: string;
  input: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  const baseEntry: Omit<AuditLogEntry, "durationMs" | "status" | "error"> = {
    timestamp: new Date().toISOString(),
    correlationId,
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    authMethod: params.authMethod,
    tool: params.tool,
    input: sanitizeInput(params.input),
    ip: params.ip,
    userAgent: params.userAgent,
  };

  function logEntry(entry: AuditLogEntry) {
    // Always update metrics, regardless of logging setting
    updateMetrics(entry);

    if (!MCP_CONFIG.AUDIT_LOG_ENABLED) return;

    // Structured JSON logging — compatible with log aggregators
    // (Datadog, Grafana Loki, CloudWatch, etc.)
    if (entry.status === "error") {
      console.error("[MCP:AUDIT]", JSON.stringify(entry));
    } else {
      console.log("[MCP:AUDIT]", JSON.stringify(entry));
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
