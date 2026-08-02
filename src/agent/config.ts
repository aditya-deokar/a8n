import { env } from "@/env";

export const AGENT_CONFIG = {
  enabledByDefault: false,
  modelProvider: env.AGENT_MODEL_PROVIDER || "google",
  modelName: env.AGENT_MODEL_NAME || "gemini-2.0-flash",
  fallbackModelName: env.AGENT_FALLBACK_MODEL_NAME,
  checkpointSchema: env.AGENT_CHECKPOINT_SCHEMA || "agent_graph",
  maxSteps: env.AGENT_MAX_STEPS || 20,
  maxToolCalls: env.AGENT_MAX_TOOL_CALLS || 30,
  runTimeoutMs: env.AGENT_RUN_TIMEOUT_MS || 30_000,
  toolTimeoutMs: env.AGENT_TOOL_TIMEOUT_MS || 15_000,
  memoryTtlDays: env.AGENT_MEMORY_TTL_DAYS || 180,
  embeddingModel: env.AGENT_EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimensions: env.AGENT_EMBEDDING_DIMENSIONS || 1536,

  // Phase 8 additions
  maxConcurrentRunsPerUser: env.AGENT_MAX_CONCURRENT_RUNS || 2,
  maxRunCostUsd: env.AGENT_MAX_RUN_COST_USD || 0.50,
  approvalExpiryMinutes: env.AGENT_APPROVAL_EXPIRY_MINUTES || 30,
  staleRunTimeoutMs: env.AGENT_STALE_RUN_TIMEOUT_MS || 300_000, // 5 minutes
} as const;

export function assertAgentConfig(): void {
  if (AGENT_CONFIG.embeddingDimensions !== 1536) {
    throw new Error(
      "The initial AgentMemory migration requires AGENT_EMBEDDING_DIMENSIONS=1536.",
    );
  }

  if (AGENT_CONFIG.maxSteps < 1 || AGENT_CONFIG.maxSteps > 50) {
    throw new Error("AGENT_MAX_STEPS must be between 1 and 50.");
  }
}
