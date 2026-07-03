import prisma from "@/lib/db";
import { MCP_CONFIG } from "@/mcp/config";

export type McpOAuthConnectionSummary = {
  consentId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  redirectUri: string;
  resource: string;
  connectedAt: Date;
  activeAccessTokens: number;
  activeRefreshTokens: number;
  lastUsedAt: Date | null;
};

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current = error;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const record = current as Record<string, unknown>;
    if (typeof record.code === "string") parts.push(record.code);
    if (typeof record.message === "string") parts.push(record.message);
    if (record.meta) {
      try {
        parts.push(JSON.stringify(record.meta));
      } catch {
        // Ignore non-serializable error metadata.
      }
    }
    current = record.cause;
  }

  if (error instanceof Error) parts.push(error.message);
  return parts.join(" ");
}

function isMissingMcpDatabaseObjectError(error: unknown): boolean {
  const text = errorText(error);
  const hasMissingObjectCode = /\b(P2021|P2022|42P01|42703)\b/.test(text);
  const looksMissing = /does not exist|not found|unknown field|missing column/i.test(text);
  const referencesMcpSchema =
    /mcp_|api_key|Mcp|ApiKey|lastUsedAt|revokedAt|scopes|clientId/i.test(text);

  return referencesMcpSchema && (hasMissingObjectCode || looksMissing);
}

async function withMcpSchemaFallback<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T,
  onSchemaMissing?: () => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingMcpDatabaseObjectError(error)) {
      throw error;
    }

    onSchemaMissing?.();
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[mcp] ${label} is unavailable because the database schema is missing MCP tables or columns. Run pending Prisma migrations.`,
      );
    }
    return fallback;
  }
}

export async function listMcpOAuthConnectionsForUser(
  userId: string,
  options: { onSchemaMissing?: () => void } = {},
): Promise<McpOAuthConnectionSummary[]> {
  const now = new Date();
  const consents = await withMcpSchemaFallback(
    "MCP OAuth consent lookup",
    () =>
      prisma.mcpOAuthConsent.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              clientName: true,
              clientId: true,
            },
          },
        },
      }),
    [],
    options.onSchemaMissing,
  );

  return Promise.all(
    consents.map(async (consent) => {
      const [activeAccessTokens, activeRefreshTokens, latestAccess, latestRefresh] =
        await Promise.all([
          withMcpSchemaFallback(
            "MCP OAuth access-token count",
            () =>
              prisma.mcpOAuthAccessToken.count({
                where: {
                  userId,
                  clientId: consent.clientId,
                  revokedAt: null,
                  expiresAt: { gt: now },
                },
              }),
            0,
            options.onSchemaMissing,
          ),
          withMcpSchemaFallback(
            "MCP OAuth refresh-token count",
            () =>
              prisma.mcpOAuthRefreshToken.count({
                where: {
                  userId,
                  clientId: consent.clientId,
                  revokedAt: null,
                  expiresAt: { gt: now },
                },
              }),
            0,
            options.onSchemaMissing,
          ),
          withMcpSchemaFallback(
            "MCP OAuth latest access-token usage",
            () =>
              prisma.mcpOAuthAccessToken.findFirst({
                where: { userId, clientId: consent.clientId, lastUsedAt: { not: null } },
                orderBy: { lastUsedAt: "desc" },
                select: { lastUsedAt: true },
              }),
            null,
            options.onSchemaMissing,
          ),
          withMcpSchemaFallback(
            "MCP OAuth latest refresh-token usage",
            () =>
              prisma.mcpOAuthRefreshToken.findFirst({
                where: { userId, clientId: consent.clientId, lastUsedAt: { not: null } },
                orderBy: { lastUsedAt: "desc" },
                select: { lastUsedAt: true },
              }),
            null,
            options.onSchemaMissing,
          ),
        ]);

      const lastUsedTimes = [latestAccess?.lastUsedAt, latestRefresh?.lastUsedAt]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime());

      return {
        consentId: consent.id,
        clientId: consent.clientId,
        clientName: consent.client?.clientName || consent.client?.clientId || consent.clientId,
        scopes: consent.scopes || [],
        redirectUri: consent.redirectUri || "",
        resource: consent.resource || "",
        connectedAt: consent.createdAt,
        activeAccessTokens,
        activeRefreshTokens,
        lastUsedAt: lastUsedTimes[0] || null,
      };
    }),
  );
}

export async function getMcpUserSecuritySummary(userId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  let schemaReady = true;
  const markSchemaMissing = () => {
    schemaReady = false;
  };

  const [
    apiKeys,
    oauthConnections,
    auditEventsLast24h,
    latestAuditEvent,
    failedAuditEventsLast24h,
  ] = await Promise.all([
    withMcpSchemaFallback(
      "MCP API key summary",
      () =>
        prisma.apiKey.findMany({
          where: { userId, revokedAt: null },
          select: {
            id: true,
            scopes: true,
            expiresAt: true,
            lastUsedAt: true,
          },
        }),
      [],
      markSchemaMissing,
    ),
    listMcpOAuthConnectionsForUser(userId, { onSchemaMissing: markSchemaMissing }),
    withMcpSchemaFallback(
      "MCP audit event count",
      () =>
        prisma.mcpAuditLog.count({
          where: {
            userId,
            timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
      0,
      markSchemaMissing,
    ),
    withMcpSchemaFallback(
      "MCP latest audit event",
      () =>
        prisma.mcpAuditLog.findFirst({
          where: { userId },
          orderBy: { timestamp: "desc" },
          select: {
            timestamp: true,
            tool: true,
            status: true,
          },
        }),
      null,
      markSchemaMissing,
    ),
    withMcpSchemaFallback(
      "MCP failed audit event count",
      () =>
        prisma.mcpAuditLog.count({
          where: {
            userId,
            status: "error",
            timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
      0,
      markSchemaMissing,
    ),
  ]);

  const wildcardKeys = apiKeys.filter((key) => key.scopes.includes("*")).length;
  const expiringSoonKeys = apiKeys.filter(
    (key) => key.expiresAt && key.expiresAt <= soon,
  ).length;
  const neverUsedKeys = apiKeys.filter((key) => !key.lastUsedAt).length;
  const activeOAuthTokens = oauthConnections.reduce(
    (total, connection) =>
      total + connection.activeAccessTokens + connection.activeRefreshTokens,
    0,
  );
  const corsOrigins = MCP_CONFIG.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const recommendations = [
    !schemaReady ? "Apply pending MCP Prisma migrations before relying on production MCP telemetry." : null,
    wildcardKeys > 0 ? "Replace wildcard API keys with scoped keys." : null,
    expiringSoonKeys > 0 ? "Rotate API keys that expire within 14 days." : null,
    process.env.MCP_RATE_LIMIT_BACKEND !== "database"
      ? "Use database-backed MCP rate limiting in multi-instance production."
      : null,
    corsOrigins.includes("*") ? "Set explicit MCP CORS origins before production." : null,
    !MCP_CONFIG.API_KEY_HMAC_ENABLED
      ? "Set MCP_API_KEY_HMAC_SECRET before issuing production keys."
      : null,
    process.env.MCP_SAFE_FETCH_ALLOWLIST_MODE !== "true"
      ? "Enable MCP_SAFE_FETCH_ALLOWLIST_MODE for production egress control."
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    generatedAt: now.toISOString(),
    apiKeys: {
      active: apiKeys.length,
      wildcard: wildcardKeys,
      expiringSoon: expiringSoonKeys,
      neverUsed: neverUsedKeys,
    },
    oauth: {
      connectedClients: oauthConnections.length,
      activeTokens: activeOAuthTokens,
      connections: oauthConnections,
    },
    audit: {
      databaseEnabled: MCP_CONFIG.AUDIT_DB_ENABLED,
      schemaReady,
      eventsLast24h: auditEventsLast24h,
      failedEventsLast24h: failedAuditEventsLast24h,
      latestEvent: latestAuditEvent,
    },
    guardrails: {
      auditLogEnabled: MCP_CONFIG.AUDIT_LOG_ENABLED,
      auditDatabaseEnabled: MCP_CONFIG.AUDIT_DB_ENABLED,
      rateLimitBackend: MCP_CONFIG.RATE_LIMIT.BACKEND,
      corsWildcard: corsOrigins.includes("*"),
      safeFetchAllowlistMode: process.env.MCP_SAFE_FETCH_ALLOWLIST_MODE === "true",
      disableSideEffectTools: MCP_CONFIG.DISABLE_SIDE_EFFECT_TOOLS,
      disableCredentialMutation: MCP_CONFIG.DISABLE_CREDENTIAL_MUTATION,
      forceReadOnlyChatGptProfile: MCP_CONFIG.FORCE_READ_ONLY_CHATGPT_PROFILE,
      strictSafetyMode: MCP_CONFIG.SAFETY_STRICT_MODE,
    },
    recommendations,
  };
}
