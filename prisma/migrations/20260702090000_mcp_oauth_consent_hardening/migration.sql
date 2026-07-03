CREATE TABLE "mcp_oauth_consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "redirectUri" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_oauth_consent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_oauth_consent_userId_idx" ON "mcp_oauth_consent"("userId");
CREATE INDEX "mcp_oauth_consent_clientId_idx" ON "mcp_oauth_consent"("clientId");
CREATE INDEX "mcp_oauth_consent_userId_clientId_revokedAt_idx" ON "mcp_oauth_consent"("userId", "clientId", "revokedAt");

ALTER TABLE "mcp_oauth_consent"
ADD CONSTRAINT "mcp_oauth_consent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_consent"
ADD CONSTRAINT "mcp_oauth_consent_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_client"("clientId")
ON DELETE CASCADE ON UPDATE CASCADE;
