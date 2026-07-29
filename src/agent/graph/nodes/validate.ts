import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { AgentGraphState } from "../state";

const VALIDATE_SYSTEM_PROMPT = `You are the a8n workflow validation assistant.
Call validate_workflow_draft with the current draft ID to check the draft.
If validation fails, explain each error in plain language and ask the user what to fix.
Never request or accept credentials, tokens, passwords, or API keys.`;

/**
 * Call validate_workflow_draft and parse the validation report.
 * If invalid, extract actionable errors for the user.
 */
export function createValidateNode(
  model: BaseChatModel,
  tools: DynamicStructuredTool[],
) {
  const validateTool = tools.find(
    (t) => t.name === "validate_workflow_draft",
  );
  const boundModel = validateTool && model.bindTools
    ? model.bindTools([validateTool])
    : model;

  return async function validateNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    if (!state.draftId) {
      return {
        messages: [
          new HumanMessage(
            "No draft to validate. Please create a draft first.",
          ),
        ],
      };
    }

    const messages = [
      new SystemMessage(VALIDATE_SYSTEM_PROMPT),
      new SystemMessage(
        `Current draft ID: ${state.draftId}. Validate this draft now.`,
      ),
    ];

    const response = await boundModel.invoke(messages);

    return {
      messages: [response],
    };
  };
}
