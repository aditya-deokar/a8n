-- Adds persistent MCP API keys.
-- This migration is intentionally idempotent because some local databases may
-- already have this table from `prisma db push` during MCP development.

CREATE TABLE IF NOT EXISTS "api_key" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_key_keyHash_key" ON "api_key"("keyHash");
CREATE INDEX IF NOT EXISTS "api_key_keyHash_idx" ON "api_key"("keyHash");
CREATE INDEX IF NOT EXISTS "api_key_userId_idx" ON "api_key"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_key_userId_fkey'
    ) THEN
        ALTER TABLE "api_key"
        ADD CONSTRAINT "api_key_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
