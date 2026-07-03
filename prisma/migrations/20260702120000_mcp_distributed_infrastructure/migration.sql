-- Phase 12: distributed MCP infrastructure.
-- Stores rate-limit counters in Postgres so all app instances share the same budget.

CREATE TABLE "mcp_rate_limit_bucket" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_rate_limit_bucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_rate_limit_bucket_identifier_tier_windowStart_key"
    ON "mcp_rate_limit_bucket"("identifier", "tier", "windowStart");

CREATE INDEX "mcp_rate_limit_bucket_expiresAt_idx"
    ON "mcp_rate_limit_bucket"("expiresAt");
