-- Backfills schema objects that existed in the Prisma schema before later
-- migrations started extending credential and execution types.
-- The guards keep this safe for local databases that were previously created
-- with `prisma db push` during development.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CredentialType') THEN
        CREATE TYPE "CredentialType" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExecutionStatus') THEN
        CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Node"
ADD COLUMN IF NOT EXISTS "credentialId" TEXT;

CREATE TABLE IF NOT EXISTS "Execution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "errorStack" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "inngestEventId" TEXT NOT NULL,
    "output" JSONB,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Execution_inngestEventId_key"
ON "Execution"("inngestEventId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Credential_userId_fkey'
    ) THEN
        ALTER TABLE "Credential"
        ADD CONSTRAINT "Credential_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Node_credentialId_fkey'
    ) THEN
        ALTER TABLE "Node"
        ADD CONSTRAINT "Node_credentialId_fkey"
        FOREIGN KEY ("credentialId") REFERENCES "Credential"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Execution_workflowId_fkey'
    ) THEN
        ALTER TABLE "Execution"
        ADD CONSTRAINT "Execution_workflowId_fkey"
        FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
