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

/** A single audit log entry */
export interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  userId: string;
  apiKeyId?: string;
  authMethod: "api_key" | "session" | "oauth";
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

const SENSITIVE_KEY_FRAGMENTS = [
  "authorization",
  "cookie",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
  "webhooksecret",
  "webhook_secret",
  "stripe-signature",
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return (
    SENSITIVE_KEYS.has(key) ||
    SENSITIVE_KEYS.has(normalized) ||
    SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  );
}

function redactSensitiveString(value: string): string {
  return value
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_API_KEY]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b/gi, "$1[REDACTED_TOKEN]");
}

/**
 * Deep-sanitize an object by redacting values of sensitive keys.
 */
function sanitizeInput(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeInput(value as Record<string, unknown>);
    } else if (typeof value === "string") {
      sanitized[key] = redactSensitiveString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "string"
          ? redactSensitiveString(item)
          : typeof item === "object" && item !== null
            ? sanitizeInput(item as Record<string, unknown>)
            : item,
      );
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
    if (MCP_CONFIG.AUDIT_LOG_ENABLED) {
      console.error(
        "[MCP:AUDIT:PERSIST_FAILED]",
        error instanceof Error ? error.message : "Unknown error",
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
    void persistAuditEntry(entry);

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
