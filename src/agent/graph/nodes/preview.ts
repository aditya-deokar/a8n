import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { AgentGraphState } from "../state";

const PREVIEW_SYSTEM_PROMPT = `You are the a8n workflow preview assistant.
Call preview_workflow_diff with the current draft ID to generate a diff and confirmation hash.
Present the proposed changes clearly and ask the user if they want to apply.
Never request or accept credentials, tokens, passwords, or API keys.`;

/**
 * Call preview_workflow_diff to generate a diff and confirmation hash.
 * This prepares the data needed for the approval step.
 */
export function createPreviewNode(
  model: BaseChatModel,
  tools: DynamicStructuredTool[],
) {
  const previewTool = tools.find(
    (t) => t.name === "preview_workflow_diff",
  );
  const boundModel = previewTool && model.bindTools
    ? model.bindTools([previewTool])
    : model;

  return async function previewNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    if (!state.draftId) {
      return {
        messages: [
          new HumanMessage(
            "No draft to preview. Please create and validate a draft first.",
          ),
        ],
      };
    }

    const workflowContext = state.workflowId
      ? `Target workflow: ${state.workflowId}`
      : "This will create a new workflow.";

    const messages = [
      new SystemMessage(PREVIEW_SYSTEM_PROMPT),
      new SystemMessage(
        `Draft ID: ${state.draftId}. ${workflowContext}. Generate the preview now.`,
      ),
    ];

    const response = await boundModel.invoke(messages);

    return {
      messages: [response],
    };
  };
}
