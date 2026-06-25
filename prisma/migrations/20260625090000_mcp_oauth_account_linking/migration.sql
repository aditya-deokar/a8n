CREATE TABLE "mcp_oauth_client" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "redirectUris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "grantTypes" TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "responseTypes" TEXT[] NOT NULL DEFAULT ARRAY['code']::TEXT[],
    "scope" TEXT,
    "tokenEndpointAuthMethod" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_oauth_client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_oauth_authorization_code" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_authorization_code_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_oauth_access_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_oauth_access_token_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_oauth_refresh_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_oauth_refresh_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_oauth_client_clientId_key" ON "mcp_oauth_client"("clientId");
CREATE INDEX "mcp_oauth_client_clientId_idx" ON "mcp_oauth_client"("clientId");

CREATE UNIQUE INDEX "mcp_oauth_authorization_code_codeHash_key" ON "mcp_oauth_authorization_code"("codeHash");
CREATE INDEX "mcp_oauth_authorization_code_userId_idx" ON "mcp_oauth_authorization_code"("userId");
CREATE INDEX "mcp_oauth_authorization_code_clientId_idx" ON "mcp_oauth_authorization_code"("clientId");
CREATE INDEX "mcp_oauth_authorization_code_expiresAt_idx" ON "mcp_oauth_authorization_code"("expiresAt");

CREATE UNIQUE INDEX "mcp_oauth_access_token_tokenHash_key" ON "mcp_oauth_access_token"("tokenHash");
CREATE INDEX "mcp_oauth_access_token_tokenHash_idx" ON "mcp_oauth_access_token"("tokenHash");
CREATE INDEX "mcp_oauth_access_token_userId_idx" ON "mcp_oauth_access_token"("userId");
CREATE INDEX "mcp_oauth_access_token_clientId_idx" ON "mcp_oauth_access_token"("clientId");
CREATE INDEX "mcp_oauth_access_token_expiresAt_idx" ON "mcp_oauth_access_token"("expiresAt");

CREATE UNIQUE INDEX "mcp_oauth_refresh_token_tokenHash_key" ON "mcp_oauth_refresh_token"("tokenHash");
CREATE INDEX "mcp_oauth_refresh_token_tokenHash_idx" ON "mcp_oauth_refresh_token"("tokenHash");
CREATE INDEX "mcp_oauth_refresh_token_userId_idx" ON "mcp_oauth_refresh_token"("userId");
CREATE INDEX "mcp_oauth_refresh_token_clientId_idx" ON "mcp_oauth_refresh_token"("clientId");
CREATE INDEX "mcp_oauth_refresh_token_expiresAt_idx" ON "mcp_oauth_refresh_token"("expiresAt");

ALTER TABLE "mcp_oauth_authorization_code"
ADD CONSTRAINT "mcp_oauth_authorization_code_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_authorization_code"
ADD CONSTRAINT "mcp_oauth_authorization_code_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_client"("clientId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_access_token"
ADD CONSTRAINT "mcp_oauth_access_token_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_access_token"
ADD CONSTRAINT "mcp_oauth_access_token_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_client"("clientId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_refresh_token"
ADD CONSTRAINT "mcp_oauth_refresh_token_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_oauth_refresh_token"
ADD CONSTRAINT "mcp_oauth_refresh_token_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_client"("clientId")
ON DELETE CASCADE ON UPDATE CASCADE;
