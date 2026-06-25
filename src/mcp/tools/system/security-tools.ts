import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MCP_CONFIG } from "@/mcp/config";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import {
  isPersistentAuditEnabled,
  listPersistedAuditEvents,
} from "@/mcp/middleware/audit-logger";

export function registerSecurityStatus(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "security_status",
    "Return MCP security posture: CORS mode, rate-limit mode, audit persistence, API-key hashing mode, webhook verification, and remaining production hardening recommendations.",
    {},
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("security_status", async () => {
        const corsOrigins = MCP_CONFIG.CORS_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean);
        const webhookSecurity = {
          sharedSecretConfigured: MCP_CONFIG.WEBHOOK_SHARED_SECRET_CONFIGURED,
          googleFormSecretConfigured:
            MCP_CONFIG.GOOGLE_FORM_WEBHOOK_SECRET_CONFIGURED ||
            MCP_CONFIG.WEBHOOK_SHARED_SECRET_CONFIGURED,
          stripeSignatureConfigured: MCP_CONFIG.STRIPE_WEBHOOK_SECRET_CONFIGURED,
          stripeSharedSecretConfigured:
            MCP_CONFIG.STRIPE_WEBHOOK_SHARED_SECRET_CONFIGURED ||
            MCP_CONFIG.WEBHOOK_SHARED_SECRET_CONFIGURED,
        };

        return mcpJsonResponse({
          cors: {
            origins: corsOrigins,
            wildcard: corsOrigins.includes("*"),
            recommendation: corsOrigins.includes("*")
              ? "Set MCP_CORS_ORIGINS to explicit production origins."
              : "CORS origins are restricted.",
          },
          apiKeys: {
            prefix: MCP_CONFIG.API_KEY_PREFIX,
            hashing: MCP_CONFIG.API_KEY_HMAC_ENABLED
              ? "hmac-sha256"
              : "sha256-legacy-compatible",
            recommendation: MCP_CONFIG.API_KEY_HMAC_ENABLED
              ? "API keys are hashed with a server-side HMAC secret."
              : "Set MCP_API_KEY_HMAC_SECRET to add a server-side pepper for new keys.",
          },
          audit: {
            consoleEnabled: MCP_CONFIG.AUDIT_LOG_ENABLED,
            databaseEnabled: isPersistentAuditEnabled(),
            listTool: "list_mcp_audit_events",
          },
          rateLimit: {
            mode: "in-memory",
            windowMs: MCP_CONFIG.RATE_LIMIT.WINDOW_MS,
            freeTierLimit: MCP_CONFIG.RATE_LIMIT.FREE_TIER,
            proTierLimit: MCP_CONFIG.RATE_LIMIT.PRO_TIER,
            recommendation:
              "Use Redis/Upstash or platform rate limiting for multi-instance production deployments.",
          },
          webhooks: webhookSecurity,
          redaction: {
            structuredOutput: true,
            auditInput: true,
            sensitiveStringPatterns: [
              "provider API keys",
              "Bearer tokens",
              "private key blocks",
              "authorization and webhook-secret fields",
            ],
          },
          remainingHardening: [
            "Add Redis-backed distributed rate limiting.",
            "Add OAuth-native connection flows for Slack and Google.",
            "Add live execution streaming once per-node telemetry exists.",
            "Add per-tool persisted audit dashboards in the product UI.",
          ],
        });
      });
    },
  );
}

export function registerListMcpAuditEvents(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "list_mcp_audit_events",
    "List recent persisted MCP audit events for the authenticated user's tenant. Returns an empty disabled response when MCP_AUDIT_DB_ENABLED=false.",
    {
      limit: z.number().min(1).max(100).default(25),
      tool: z.string().optional(),
      status: z.enum(["success", "error"]).optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("list_mcp_audit_events", async () => {
        if (!isPersistentAuditEnabled()) {
          return mcpJsonResponse({
            enabled: false,
            events: [],
            instruction:
              "Set MCP_AUDIT_DB_ENABLED=true and apply the mcp_audit_log migration to persist audit events.",
          });
        }

        const events = await listPersistedAuditEvents({
          userId: auth.userId,
          limit: args.limit,
          tool: args.tool,
          status: args.status,
        });

        return mcpJsonResponse({
          enabled: true,
          events: events.map((event) => ({
            id: event.id,
            timestamp: event.timestamp,
            correlationId: event.correlationId,
            apiKeyId: event.apiKeyId,
            authMethod: event.authMethod,
            tool: event.tool,
            input: event.input,
            durationMs: event.durationMs,
            status: event.status,
            error: event.error,
            ip: event.ip,
            userAgent: event.userAgent,
          })),
        });
      });
    },
  );
}
