/**
 * Agent subsystem health check.
 *
 * Reports the status of all agent subsystems: model provider,
 * checkpointer, memory store, feature flags, and package compatibility.
 * Used by ops to verify readiness before enabling rollout.
 */

import { AGENT_CONFIG } from "@/agent/config";
import { env } from "@/env";
import {
  getAgentFlagSnapshot,
} from "@/agent/feature-policy";
import { checkPackageCompatibility, type CompatibilityIssue } from "@/agent/compatibility";
import { emitAgentEvent } from "@/agent/observability/tracing";

export type SubsystemStatus = "healthy" | "degraded" | "unavailable";

export type SubsystemHealth = {
  name: string;
  status: SubsystemStatus;
  details: Record<string, unknown>;
};

export type AgentHealthReport = {
  timestamp: string;
  overallStatus: SubsystemStatus;
  subsystems: SubsystemHealth[];
  featureFlags: Record<string, unknown>;
  compatibility: {
    issues: CompatibilityIssue[];
    status: SubsystemStatus;
  };
  config: Record<string, unknown>;
};

/**
 * Run a full health check of all agent subsystems.
 */
export async function checkAgentHealth(
  userId = "system",
): Promise<AgentHealthReport> {
  const subsystems: SubsystemHealth[] = [];

  // --- Model provider ---
  const modelHealth = checkModelProvider();
  subsystems.push(modelHealth);

  // --- Checkpointer ---
  const checkpointerHealth = await checkCheckpointer();
  subsystems.push(checkpointerHealth);

  // --- Memory store ---
  const memoryHealth = checkMemoryStore();
  subsystems.push(memoryHealth);

  // --- Feature flags ---
  const flags = getAgentFlagSnapshot({ userId });

  // --- Package compatibility ---
  const compatIssues = checkPackageCompatibility();
  const hasErrors = compatIssues.some((i) => i.severity === "error");
  const compatStatus: SubsystemStatus = hasErrors ? "degraded" : "healthy";

  // --- Overall status ---
  const statuses = subsystems.map((s) => s.status);
  let overallStatus: SubsystemStatus = "healthy";
  if (statuses.includes("unavailable")) {
    overallStatus = "unavailable";
  } else if (statuses.includes("degraded") || hasErrors) {
    overallStatus = "degraded";
  }

  const report: AgentHealthReport = {
    timestamp: new Date().toISOString(),
    overallStatus,
    subsystems,
    featureFlags: flags,
    compatibility: {
      issues: compatIssues,
      status: compatStatus,
    },
    config: {
      modelProvider: AGENT_CONFIG.modelProvider,
      modelName: AGENT_CONFIG.modelName,
      fallbackModelName: AGENT_CONFIG.fallbackModelName || null,
      maxSteps: AGENT_CONFIG.maxSteps,
      maxToolCalls: AGENT_CONFIG.maxToolCalls,
      runTimeoutMs: AGENT_CONFIG.runTimeoutMs,
      maxConcurrentRunsPerUser: AGENT_CONFIG.maxConcurrentRunsPerUser,
      maxRunCostUsd: AGENT_CONFIG.maxRunCostUsd,
      memoryTtlDays: AGENT_CONFIG.memoryTtlDays,
    },
  };

  emitAgentEvent("health.check.completed", {
    overallStatus,
    subsystemStatuses: Object.fromEntries(
      subsystems.map((s) => [s.name, s.status]),
    ),
  });

  return report;
}

/**
 * Check model provider availability.
 */
function checkModelProvider(): SubsystemHealth {
  const hasApiKey = !!env.OPENAI_API_KEY;
  const isOpenAI = AGENT_CONFIG.modelProvider === "openai";

  if (!isOpenAI) {
    return {
      name: "model_provider",
      status: "unavailable",
      details: {
        provider: AGENT_CONFIG.modelProvider,
        reason: "Only OpenAI is currently supported.",
      },
    };
  }

  if (!hasApiKey) {
    return {
      name: "model_provider",
      status: "unavailable",
      details: {
        provider: "openai",
        model: AGENT_CONFIG.modelName,
        reason: "OPENAI_API_KEY is not configured.",
      },
    };
  }

  return {
    name: "model_provider",
    status: "healthy",
    details: {
      provider: "openai",
      model: AGENT_CONFIG.modelName,
      fallback: AGENT_CONFIG.fallbackModelName || "none",
    },
  };
}

/**
 * Check checkpointer availability.
 */
async function checkCheckpointer(): Promise<SubsystemHealth> {
  try {
    // Just verify the schema config exists — actual connection is lazy
    const schema = AGENT_CONFIG.checkpointSchema;
    return {
      name: "checkpointer",
      status: "healthy",
      details: {
        schema,
        type: "postgres",
      },
    };
  } catch {
    return {
      name: "checkpointer",
      status: "degraded",
      details: {
        reason: "Checkpointer configuration error.",
      },
    };
  }
}

/**
 * Check memory store availability.
 */
function checkMemoryStore(): SubsystemHealth {
  const hasEmbeddingModel = !!AGENT_CONFIG.embeddingModel;
  const hasDimensions = AGENT_CONFIG.embeddingDimensions > 0;

  if (!hasEmbeddingModel || !hasDimensions) {
    return {
      name: "memory_store",
      status: "degraded",
      details: {
        embeddingModel: AGENT_CONFIG.embeddingModel || "not configured",
        dimensions: AGENT_CONFIG.embeddingDimensions,
        reason: "Embedding model configuration incomplete.",
      },
    };
  }

  return {
    name: "memory_store",
    status: "healthy",
    details: {
      embeddingModel: AGENT_CONFIG.embeddingModel,
      dimensions: AGENT_CONFIG.embeddingDimensions,
      ttlDays: AGENT_CONFIG.memoryTtlDays,
    },
  };
}
