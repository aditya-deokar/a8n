/**
 * System Tools — whoami, server_info, health_check
 * Scope: system:read
 *
 * Enhanced in Phase 5 with request metrics in server_info
 * and a health_check tool for MCP Inspector verification.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { MCP_CONFIG } from "@/mcp/config";
import { MCP_SCOPES, type McpScope } from "@/mcp/auth/scopes";
import { getRequestMetrics } from "@/mcp/middleware/audit-logger";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { isChatGptAppProfile } from "@/mcp/app-profile";

export function registerWhoami(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "whoami",
    "Get information about the currently authenticated user, including user ID, name, email, authentication method, and granted permission scopes.",
    {},
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("whoami", async () => {
        return mcpJsonResponse({
          userId: auth.userId,
          userName: auth.userName,
          userEmail: auth.userEmail,
          authMethod: auth.method,
          apiKeyId: auth.apiKeyId || null,
          scopes: auth.scopes,
          scopeDescriptions: auth.scopes.map((s: McpScope) => ({
            scope: s,
            description: MCP_SCOPES[s] || "Unknown scope",
          })),
        });
      });
    },
  );
}

export function registerServerInfo(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "server_info",
    "Get information about this MCP server — name, version, available scopes, endpoint configuration, and live request metrics.",
    {},
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("server_info", async () => {
        const metrics = getRequestMetrics();
        const chatGptProfile = isChatGptAppProfile(context.appProfile);

        return mcpJsonResponse({
          name: MCP_CONFIG.SERVER_NAME,
          version: MCP_CONFIG.SERVER_VERSION,
          description: MCP_CONFIG.SERVER_DESCRIPTION,
          endpoint: MCP_CONFIG.ENDPOINT_PATH,
          transport: "streamable-http (Web Standard)",
          appProfile: chatGptProfile ? "chatgpt" : "default",
          capabilities: {
            tools: chatGptProfile ? 28 : 53,
            resources: chatGptProfile ? 21 : 17,
            resourceTemplates: 5,
            prompts: 3,
          },
          rateLimiting: {
            windowMs: MCP_CONFIG.RATE_LIMIT.WINDOW_MS,
            freeTierLimit: MCP_CONFIG.RATE_LIMIT.FREE_TIER,
            proTierLimit: MCP_CONFIG.RATE_LIMIT.PRO_TIER,
          },
          availableScopes: Object.entries(MCP_SCOPES).map(([key, desc]) => ({
            scope: key,
            description: desc,
          })),
          metrics: {
            totalRequests: metrics.totalRequests,
            successCount: metrics.successCount,
            errorCount: metrics.errorCount,
            avgDurationMs: metrics.avgDurationMs,
            lastRequestAt: metrics.lastRequestAt || null,
            topTools: Object.entries(metrics.toolCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([tool, count]) => ({ tool, count })),
          },
        });
      });
    },
  );
}

export function registerHealthCheck(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "health_check",
    "Server health check — verifies the MCP server, authentication, database, and all subsystems are operational. Use this to verify your connection is working.",
    {},
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("health_check", async () => {
        const checks: Record<string, { status: string; detail?: string }> = {};

        // Auth check (always passes if we got here)
        checks.auth = {
          status: "ok",
          detail: `Authenticated as ${auth.userName} (${auth.method})`,
        };

        // Database check
        try {
          const prisma = (await import("@/lib/db")).default;
          await prisma.$queryRaw`SELECT 1`;
          checks.database = { status: "ok" };
        } catch (err) {
          checks.database = {
            status: "error",
            detail: err instanceof Error ? err.message : "Connection failed",
          };
        }

        // Server metrics
        const metrics = getRequestMetrics();
        checks.metrics = {
          status: "ok",
          detail: `${metrics.totalRequests} total requests, avg ${metrics.avgDurationMs}ms`,
        };

        const allOk = Object.values(checks).every((c) => c.status === "ok");

        return mcpJsonResponse({
          status: allOk ? "healthy" : "degraded",
          server: MCP_CONFIG.SERVER_NAME,
          version: MCP_CONFIG.SERVER_VERSION,
          timestamp: new Date().toISOString(),
          checks,
        });
      });
    },
  );
}
