-- Embedded agent foundation: product metadata and user-scoped pgvector memory.
-- LangGraph checkpoint tables are created by PostgresSaver.setup() in the
-- dedicated AGENT_CHECKPOINT_SCHEMA because the package owns those migrations.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "AgentThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED_FOR_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "AgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONSUMED');

CREATE TABLE "agent_thread" (
    "id" TEXT NOT NULL,
    "langgraphThreadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT,
    "title" TEXT,
    "status" "AgentThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_thread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_thread_langgraphThreadId_key" ON "agent_thread"("langgraphThreadId");
CREATE INDEX "agent_thread_userId_updatedAt_idx" ON "agent_thread"("userId", "updatedAt");
CREATE INDEX "agent_thread_userId_workflowId_updatedAt_idx" ON "agent_thread"("userId", "workflowId", "updatedAt");

CREATE TABLE "agent_run" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "clientMessageId" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_run_threadId_clientMessageId_key" ON "agent_run"("threadId", "clientMessageId");
CREATE INDEX "agent_run_userId_createdAt_idx" ON "agent_run"("userId", "createdAt");
CREATE INDEX "agent_run_threadId_createdAt_idx" ON "agent_run"("threadId", "createdAt");

CREATE TABLE "agent_approval" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "status" "AgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "rejectionReason" TEXT,
    CONSTRAINT "agent_approval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_approval_userId_status_expiresAt_idx" ON "agent_approval"("userId", "status", "expiresAt");
CREATE INDEX "agent_approval_threadId_status_idx" ON "agent_approval"("threadId", "status");
CREATE UNIQUE INDEX "agent_approval_runId_confirmationHash_key" ON "agent_approval"("runId", "confirmationHash");

CREATE TABLE "agent_memory_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "namespace" TEXT[] NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "consentStatus" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "agent_memory_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_memory_item_userId_namespace_idx" ON "agent_memory_item"("userId", "namespace");
CREATE INDEX "agent_memory_item_userId_expiresAt_idx" ON "agent_memory_item"("userId", "expiresAt");
CREATE INDEX "agent_memory_item_embedding_hnsw_idx" ON "agent_memory_item" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "agent_thread"
  ADD CONSTRAINT "agent_thread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_thread_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_run"
  ADD CONSTRAINT "agent_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_run_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agent_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_run_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_approval"
  ADD CONSTRAINT "agent_approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_approval_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agent_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_approval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_approval_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_memory_item"
  ADD CONSTRAINT "agent_memory_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
