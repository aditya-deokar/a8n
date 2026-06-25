CREATE TABLE "mcp_audit_log" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "authMethod" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "mcp_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_audit_log_userId_timestamp_idx" ON "mcp_audit_log"("userId", "timestamp");
CREATE INDEX "mcp_audit_log_tool_idx" ON "mcp_audit_log"("tool");
CREATE INDEX "mcp_audit_log_status_idx" ON "mcp_audit_log"("status");

ALTER TABLE "mcp_audit_log"
ADD CONSTRAINT "mcp_audit_log_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
