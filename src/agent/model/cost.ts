/**
 * Token-to-cost estimator for supported agent models.
 *
 * Provides cost estimation and run budget enforcement.
 * Prices are approximate and should be updated when provider pricing changes.
 */

import { AgentError } from "@/agent/errors";

/**
 * Per-token pricing in USD for supported models.
 * Values are per 1 token (not per 1K tokens).
 */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  // OpenAI models
  "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "gpt-4o": { input: 0.0000025, output: 0.00001 },
  "gpt-4-turbo": { input: 0.00001, output: 0.00003 },
  "gpt-4": { input: 0.00003, output: 0.00006 },
  "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },

  // Google models (gemini-2.0-flash prices)
  "gemini-2.0-flash": { input: 0.0000001, output: 0.0000004 },

  // Default fallback (conservative estimate)
  _default: { input: 0.00001, output: 0.00003 },
};

/**
 * Estimate the cost of a model invocation in USD.
 */
export function estimateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING._default;

  const inputCost = Math.max(0, inputTokens) * pricing.input;
  const outputCost = Math.max(0, outputTokens) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Assert that the current run has not exceeded its cost budget.
 *
 * @throws {AgentError} with code AGENT_RUN_LIMIT_EXCEEDED if the budget is exceeded.
 */
export function assertRunBudget(params: {
  runId: string;
  currentCostUsd: number;
  maxCostUsd: number;
}): void {
  if (params.currentCostUsd > params.maxCostUsd) {
    throw new AgentError(
      "AGENT_RUN_LIMIT_EXCEEDED",
      `Agent run ${params.runId} exceeded cost budget: $${params.currentCostUsd.toFixed(6)} > $${params.maxCostUsd.toFixed(6)}.`,
    );
  }
}

/**
 * Format a cost value for display.
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(6)}`;
  }
  return `$${costUsd.toFixed(4)}`;
}
