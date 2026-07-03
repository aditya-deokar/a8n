export type McpMaintenanceOptions = {
  now?: Date;
  auditRetentionDays?: number;
  dryRun?: boolean;
};

export const MCP_BACKUP_RESTORE_TABLES = [
  "user",
  "Workflow",
  "Node",
  "Connection",
  "WorkflowDraft",
  "WorkflowDraftRevision",
  "WorkflowVersion",
  "Credential",
  "ApiKey",
  "mcp_oauth_client",
  "mcp_oauth_authorization_code",
  "mcp_oauth_access_token",
  "mcp_oauth_refresh_token",
  "mcp_oauth_consent",
  "mcp_audit_log",
  "mcp_rate_limit_bucket",
] as const;

function retentionDaysFromEnv() {
  const value = Number(process.env.MCP_AUDIT_RETENTION_DAYS || 90);
  return Number.isFinite(value) && value > 0 ? value : 90;
}

export function getMcpBackupRestoreManifest() {
  return {
    version: "2026.07.phase12",
    tables: [...MCP_BACKUP_RESTORE_TABLES],
    encryptedDataTables: ["Credential"],
    oauthTables: [
      "mcp_oauth_client",
      "mcp_oauth_authorization_code",
      "mcp_oauth_access_token",
      "mcp_oauth_refresh_token",
      "mcp_oauth_consent",
    ],
    requiredRestoreChecks: [
      "Prisma validate passes after restore.",
      "Workflow graph can be loaded with nodes and connections.",
      "Workflow drafts and versions preserve JSON snapshots.",
      "Credential metadata exists and encrypted values remain non-empty.",
      "OAuth clients/tokens/consents are present or intentionally purged.",
      "Audit logs are retained according to MCP_AUDIT_RETENTION_DAYS.",
    ],
  };
}

export async function getMcpAuditHealth() {
  const prisma = (await import("@/lib/db")).default;
  const [total, latest] = await Promise.all([
    prisma.mcpAuditLog.count(),
    prisma.mcpAuditLog.findFirst({
      orderBy: { timestamp: "desc" },
      select: { timestamp: true, status: true, tool: true },
    }),
  ]);

  return {
    databaseEnabled: process.env.MCP_AUDIT_DB_ENABLED !== "false",
    totalAuditEvents: total,
    latestAuditEvent: latest || null,
    healthy: process.env.MCP_AUDIT_DB_ENABLED !== "false",
  };
}

export async function cleanupMcpAuditLogs(options: McpMaintenanceOptions = {}) {
  const retentionDays = options.auditRetentionDays ?? retentionDaysFromEnv();
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  if (options.dryRun) {
    return { auditLogsDeleted: 0, cutoff, dryRun: true };
  }

  const prisma = (await import("@/lib/db")).default;
  const deleted = await prisma.mcpAuditLog.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  return { auditLogsDeleted: deleted.count, cutoff, dryRun: false };
}

export async function runMcpProductionMaintenance(
  options: McpMaintenanceOptions = {},
) {
  const now = options.now ?? new Date();

  if (options.dryRun) {
    return {
      dryRun: true,
      generatedAt: now.toISOString(),
      auditRetentionDays: options.auditRetentionDays ?? retentionDaysFromEnv(),
      backupRestoreManifest: getMcpBackupRestoreManifest(),
    };
  }

  const [{ cleanupExpiredOAuthArtifacts }, { cleanupExpiredRateLimitBuckets }] =
    await Promise.all([
      import("@/mcp/auth/oauth.service"),
      import("@/mcp/middleware/rate-limiter"),
    ]);

  const [oauth, audit, rateLimit] = await Promise.all([
    cleanupExpiredOAuthArtifacts(now),
    cleanupMcpAuditLogs({ ...options, now }),
    cleanupExpiredRateLimitBuckets(now),
  ]);

  return {
    dryRun: false,
    generatedAt: now.toISOString(),
    oauth,
    audit,
    rateLimit,
    auditHealth: await getMcpAuditHealth(),
  };
}
