ALTER TABLE "Workflow" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum for NodeType already exists; ExecutionNodeRun reuses ExecutionStatus + NodeType.
CREATE TABLE "ExecutionNodeRun" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" "NodeType" NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,

    CONSTRAINT "ExecutionNodeRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutionNodeRun_executionId_nodeId_key" ON "ExecutionNodeRun"("executionId", "nodeId");
CREATE INDEX "ExecutionNodeRun_executionId_status_idx" ON "ExecutionNodeRun"("executionId", "status");

ALTER TABLE "ExecutionNodeRun" ADD CONSTRAINT "ExecutionNodeRun_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
