import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AGENT_CONFIG } from "@/agent/config";
import { AgentError } from "@/agent/errors";
import { env } from "@/env";
import { emitAgentEvent } from "@/agent/observability/tracing";
import { recordAgentMetric, AGENT_METRICS } from "@/agent/observability/metrics";

/**
 * Create the primary agent chat model.
 *
 * If the primary model is unavailable and a fallback is configured
 * with the agentProviderFallback feature flag enabled, the fallback
 * model is returned instead.
 */
export function createAgentChatModel(): ChatOpenAI {
  if (AGENT_CONFIG.modelProvider === "mock") {
    throw new AgentError(
      "AGENT_MODEL_UNAVAILABLE",
      "The mock agent provider is reserved for tests and is not available in the runtime.",
    );
  }

  if (AGENT_CONFIG.modelProvider === "google") {
    if (!env.GOOGLE_API_KEY) {
      throw new AgentError(
        "AGENT_MODEL_UNAVAILABLE",
        "Google API key is not configured.",
      );
    }
    return new ChatGoogleGenerativeAI({
      apiKey: env.GOOGLE_API_KEY,
      model: AGENT_CONFIG.modelName,
      temperature: 0,
      maxOutputTokens: 1_500,
      maxRetries: 1,
    }) as any; // Type coercion because LangGraph expects BaseChatModel
  }

  if (AGENT_CONFIG.modelProvider !== "openai" || !env.OPENAI_API_KEY) {
    throw new AgentError(
      "AGENT_MODEL_UNAVAILABLE",
      "The embedded agent model provider is not configured.",
    );
  }

  return new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: AGENT_CONFIG.modelName,
    temperature: 0,
    maxTokens: 1_500,
    timeout: AGENT_CONFIG.runTimeoutMs,
    maxRetries: 1,
  });
}

/**
 * Create the agent chat model with fallback support.
 *
 * Tries the primary model first. If it fails and a fallback model name
 * is configured, creates a model with the fallback name.
 */
export function createAgentChatModelWithFallback(): ChatOpenAI {
  try {
    return createAgentChatModel();
  } catch (error) {
    // If there's no fallback configured, rethrow
    if (!AGENT_CONFIG.fallbackModelName) {
      throw error;
    }

    emitAgentEvent("model.fallback.activated", {
      primaryModel: AGENT_CONFIG.modelName,
      fallbackModel: AGENT_CONFIG.fallbackModelName,
    });
    recordAgentMetric(AGENT_METRICS.MODEL_FALLBACK_USED, 1, {
      primaryModel: AGENT_CONFIG.modelName,
      fallbackModel: AGENT_CONFIG.fallbackModelName,
    });

    if (AGENT_CONFIG.modelProvider === "google") {
      if (!env.GOOGLE_API_KEY) {
        throw new AgentError(
          "AGENT_MODEL_UNAVAILABLE",
          "Google API key is not configured.",
        );
      }
      return new ChatGoogleGenerativeAI({
        apiKey: env.GOOGLE_API_KEY,
        model: AGENT_CONFIG.fallbackModelName,
        temperature: 0,
        maxOutputTokens: 1_500,
        maxRetries: 1,
      }) as any;
    }

    if (!env.OPENAI_API_KEY) {
      throw new AgentError(
        "AGENT_MODEL_UNAVAILABLE",
        "Neither the primary nor fallback model provider is configured.",
      );
    }

    return new ChatOpenAI({
      apiKey: env.OPENAI_API_KEY,
      model: AGENT_CONFIG.fallbackModelName,
      temperature: 0,
      maxTokens: 1_500,
      timeout: AGENT_CONFIG.runTimeoutMs,
      maxRetries: 1,
    }) as any;
  }
}
