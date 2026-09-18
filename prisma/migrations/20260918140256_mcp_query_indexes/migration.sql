-- MCP query indexes
--
-- Postgres does not index foreign keys automatically, so every relation read in
-- the MCP surface ("Node"/"Connection" by workflow, "Execution" by workflow) was
-- a sequential scan. This migration adds the missing access-path indexes and
-- drops three redundant B-trees that duplicate an existing UNIQUE constraint.
--
-- Index creation is NOT wrapped in CONCURRENTLY because Prisma runs each
-- migration inside a transaction. On a large production database, apply the
-- CONCURRENTLY variant in docs/mcp/evidence/db-optimization/concurrent-indexes.sql
-- out of band first, then mark this migration as applied with
-- `prisma migrate resolve --applied 20260918140256_mcp_query_indexes`.

-- ── Drop indexes that duplicate a UNIQUE constraint ───────────────────────────
-- Each of these columns already has a unique B-tree from @unique; the extra
-- index only added write cost on tables that are written on every MCP request.
DROP INDEX IF EXISTS "api_key_keyHash_idx";
DROP INDEX IF EXISTS "mcp_oauth_access_token_tokenHash_idx";
DROP INDEX IF EXISTS "mcp_oauth_refresh_token_tokenHash_idx";
DROP INDEX IF EXISTS "mcp_oauth_client_clientId_idx";

-- ── Workflow graph reads ──────────────────────────────────────────────────────
-- getWorkflowGraph / get_workflow / replaceWorkflowGraph / cascade deletes.
CREATE INDEX IF NOT EXISTS "Node_workflowId_idx" ON "Node"("workflowId");
-- FK target checked on every credential delete.
CREATE INDEX IF NOT EXISTS "Node_credentialId_idx" ON "Node"("credentialId");
-- The existing UNIQUE(fromNodeId, toNodeId, ...) leads with fromNodeId, so
-- neither workflowId lookups nor toNodeId cascade deletes could use it.
CREATE INDEX IF NOT EXISTS "Connection_workflowId_idx" ON "Connection"("workflowId");
CREATE INDEX IF NOT EXISTS "Connection_toNodeId_idx" ON "Connection"("toNodeId");

-- ── Paginated list tools ──────────────────────────────────────────────────────
-- list_executions filters by workflow and sorts by startedAt desc.
CREATE INDEX IF NOT EXISTS "Execution_workflowId_startedAt_idx" ON "Execution"("workflowId", "startedAt");
-- list_workflows / list_credentials sort by updatedAt desc within a user.
CREATE INDEX IF NOT EXISTS "Workflow_userId_updatedAt_idx" ON "Workflow"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Credential_userId_updatedAt_idx" ON "Credential"("userId", "updatedAt");
-- list_workflow_versions sorts by createdAt desc within a workflow.
CREATE INDEX IF NOT EXISTS "WorkflowVersion_workflowId_createdAt_idx" ON "WorkflowVersion"("workflowId", "createdAt");

-- ── Audit log ─────────────────────────────────────────────────────────────────
-- Retention sweep and the global latest-event lookup filter on timestamp alone,
-- which the existing (userId, timestamp) index cannot serve.
CREATE INDEX IF NOT EXISTS "mcp_audit_log_timestamp_idx" ON "mcp_audit_log"("timestamp");
-- Failed-events-in-24h count and status-filtered audit listings.
CREATE INDEX IF NOT EXISTS "mcp_audit_log_userId_status_timestamp_idx" ON "mcp_audit_log"("userId", "status", "timestamp");

-- ── OAuth connection summary ──────────────────────────────────────────────────
-- Active-token counts and latest-usage lookups, grouped per client.
CREATE INDEX IF NOT EXISTS "mcp_oauth_access_token_userId_clientId_expiresAt_idx" ON "mcp_oauth_access_token"("userId", "clientId", "expiresAt");
CREATE INDEX IF NOT EXISTS "mcp_oauth_access_token_userId_clientId_lastUsedAt_idx" ON "mcp_oauth_access_token"("userId", "clientId", "lastUsedAt");
CREATE INDEX IF NOT EXISTS "mcp_oauth_refresh_token_userId_clientId_expiresAt_idx" ON "mcp_oauth_refresh_token"("userId", "clientId", "expiresAt");
CREATE INDEX IF NOT EXISTS "mcp_oauth_refresh_token_userId_clientId_lastUsedAt_idx" ON "mcp_oauth_refresh_token"("userId", "clientId", "lastUsedAt");
-- Consent listing: where userId + revokedAt IS NULL, order by createdAt desc.
CREATE INDEX IF NOT EXISTS "mcp_oauth_consent_userId_revokedAt_createdAt_idx" ON "mcp_oauth_consent"("userId", "revokedAt", "createdAt");
