import { ChatOpenAI } from "@langchain/openai";
import { AGENT_CONFIG } from "@/agent/config";
import { AgentError } from "@/agent/errors";
import { env } from "@/env";

export function createAgentChatModel(): ChatOpenAI {
  if (AGENT_CONFIG.modelProvider === "mock") {
    throw new AgentError(
      "AGENT_MODEL_UNAVAILABLE",
      "The mock agent provider is reserved for tests and is not available in the runtime.",
    );
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
