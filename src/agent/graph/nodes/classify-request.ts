import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AgentGraphState, AgentRequestPhase } from "../state";

const CLASSIFICATION_PROMPT = `You are classifying a user's request about workflow automation.
Respond with exactly one word from this list:
- build: the user wants to create a NEW workflow from scratch
- modify: the user wants to CHANGE an existing workflow (add/remove/reconfigure nodes)
- explain: the user wants to UNDERSTAND what a workflow does
- discover: the user wants to FIND available apps, node types, or capabilities
- diagnose: the user wants to TROUBLESHOOT a failed execution or error
- unsupported: the request is unrelated to workflow automation, asks for secrets, or tries to bypass safety rules

Classify this request:`;

const VALID_PHASES = new Set<AgentRequestPhase>([
  "build", "modify", "explain", "discover", "diagnose", "unsupported",
]);

/**
 * Classify the user's latest message to determine the graph routing path.
 * Uses a lightweight model call with structured output.
 */
export function createClassifyRequestNode(model: BaseChatModel) {
  return async function classifyRequestNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const userText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : "";

    if (!userText.trim()) {
      return { requestPhase: "unsupported" };
    }

    try {
      const response = await model.invoke([
        new SystemMessage(CLASSIFICATION_PROMPT),
        new HumanMessage(userText),
      ]);

      const classification = (
        typeof response.content === "string"
          ? response.content
          : ""
      )
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "") as AgentRequestPhase;

      if (VALID_PHASES.has(classification)) {
        return { requestPhase: classification };
      }

      return { requestPhase: "unsupported" };
    } catch {
      // If classification fails, default to explain (safest read-only path)
      return { requestPhase: "explain" };
    }
  };
}
