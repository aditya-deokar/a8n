-- Zero-downtime variant of migration 20260918140256_mcp_query_indexes.
--
-- Prisma wraps each migration in a transaction, and CREATE INDEX CONCURRENTLY
-- cannot run inside one. On a database large enough for the plain migration's
-- ACCESS EXCLUSIVE locks to matter, run this file first (outside any
-- transaction, one statement at a time), then mark the migration as applied:
--
--   prisma migrate resolve --applied 20260918140256_mcp_query_indexes
--
-- Every statement is idempotent, so a partial run can be repeated.
--
-- After an interrupted CONCURRENTLY build Postgres leaves an INVALID index
-- behind. Check for them before repeating:
--
--   SELECT c.relname FROM pg_class c
--   JOIN pg_index i ON i.indexrelid = c.oid
--   WHERE NOT i.indisvalid;
--
-- and DROP INDEX CONCURRENTLY each one first.

-- ── Drop indexes that duplicate a UNIQUE constraint ───────────────────────────
DROP INDEX CONCURRENTLY IF EXISTS "api_key_keyHash_idx";
DROP INDEX CONCURRENTLY IF EXISTS "mcp_oauth_access_token_tokenHash_idx";
DROP INDEX CONCURRENTLY IF EXISTS "mcp_oauth_refresh_token_tokenHash_idx";
DROP INDEX CONCURRENTLY IF EXISTS "mcp_oauth_client_clientId_idx";

-- ── Workflow graph reads ──────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Node_workflowId_idx" ON "Node"("workflowId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Node_credentialId_idx" ON "Node"("credentialId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Connection_workflowId_idx" ON "Connection"("workflowId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Connection_toNodeId_idx" ON "Connection"("toNodeId");

-- ── Paginated list tools ──────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Execution_workflowId_startedAt_idx" ON "Execution"("workflowId", "startedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Workflow_userId_updatedAt_idx" ON "Workflow"("userId", "updatedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Credential_userId_updatedAt_idx" ON "Credential"("userId", "updatedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WorkflowVersion_workflowId_createdAt_idx" ON "WorkflowVersion"("workflowId", "createdAt");

-- ── Audit log ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_audit_log_timestamp_idx" ON "mcp_audit_log"("timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_audit_log_userId_status_timestamp_idx" ON "mcp_audit_log"("userId", "status", "timestamp");

-- ── OAuth connection summary ──────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_oauth_access_token_userId_clientId_expiresAt_idx" ON "mcp_oauth_access_token"("userId", "clientId", "expiresAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_oauth_access_token_userId_clientId_lastUsedAt_idx" ON "mcp_oauth_access_token"("userId", "clientId", "lastUsedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_oauth_refresh_token_userId_clientId_expiresAt_idx" ON "mcp_oauth_refresh_token"("userId", "clientId", "expiresAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_oauth_refresh_token_userId_clientId_lastUsedAt_idx" ON "mcp_oauth_refresh_token"("userId", "clientId", "lastUsedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mcp_oauth_consent_userId_revokedAt_createdAt_idx" ON "mcp_oauth_consent"("userId", "revokedAt", "createdAt");

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Dropping the new indexes is safe; the queries fall back to the plans measured
-- in explain-before.json. The four indexes this migration removed are
-- redundant with a UNIQUE constraint, so they need not be recreated, but if you
-- want the exact prior state:
--
-- CREATE INDEX CONCURRENTLY "api_key_keyHash_idx" ON "api_key"("keyHash");
-- CREATE INDEX CONCURRENTLY "mcp_oauth_access_token_tokenHash_idx" ON "mcp_oauth_access_token"("tokenHash");
-- CREATE INDEX CONCURRENTLY "mcp_oauth_refresh_token_tokenHash_idx" ON "mcp_oauth_refresh_token"("tokenHash");
-- CREATE INDEX CONCURRENTLY "mcp_oauth_client_clientId_idx" ON "mcp_oauth_client"("clientId");
