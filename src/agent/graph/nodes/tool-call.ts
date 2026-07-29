import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { AgentGraphState } from "../state";

/**
 * Invokes MCP tools selected by the model.
 *
 * This wraps the LangGraph ToolNode to:
 * 1. Execute tool calls from the last AI message
 * 2. Track draft state changes based on which tools were called
 * 3. Parse tool outputs to extract draft IDs and validation reports
 */
export function createToolCallNode(tools: DynamicStructuredTool[]) {
  const toolNode = new ToolNode(tools);

  return async function toolCallNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    // Execute the tool calls through LangGraph's built-in ToolNode
    const result = await toolNode.invoke(state);
    const toolMessages = result.messages || [];

    // Inspect tool outputs to update draft lifecycle state
    let draftId = state.draftId;
    let draftStatus = state.draftStatus;
    let validationReport = state.validationReport;
    let previewPayload = state.previewPayload;

    for (const msg of toolMessages) {
      if (!msg || typeof msg !== "object") continue;

      const content = typeof msg.content === "string" ? msg.content : "";
      const toolName = "name" in msg ? msg.name : "";

      try {
        const parsed = content ? JSON.parse(content) : null;
        if (!parsed || typeof parsed !== "object") continue;

        // Track draft creation
        if (
          toolName === "create_workflow_draft" &&
          parsed.draft?.id
        ) {
          draftId = parsed.draft.id;
          draftStatus = "created";
        }

        // Track answer updates
        if (
          toolName === "answer_workflow_draft_questions" &&
          parsed.draft?.id
        ) {
          draftId = parsed.draft.id;
          draftStatus = "answering";
        }

        // Track validation
        if (
          toolName === "validate_workflow_draft" &&
          parsed.validation
        ) {
          validationReport = {
            valid: parsed.validation.valid ?? false,
            errors: parsed.validation.errors ?? [],
            warnings: parsed.validation.warnings ?? [],
          };
          draftStatus = "validated";
        }

        // Track preview
        if (
          toolName === "preview_workflow_diff" &&
          parsed.approval?.confirmationHash
        ) {
          previewPayload = {
            draftId: parsed.draftId || draftId || "",
            workflowId: parsed.workflowId || state.workflowId || null,
            confirmationHash: parsed.approval.confirmationHash,
            diff: parsed.diff || {
              addedNodes: [],
              removedNodes: [],
              changedNodes: [],
              addedEdges: [],
              removedEdges: [],
            },
            validation: validationReport || {
              valid: true,
              errors: [],
              warnings: [],
            },
          };
          draftStatus = "previewed";
        }

        // Track apply
        if (
          toolName === "apply_workflow_draft" &&
          parsed.applied === true
        ) {
          draftStatus = "applied";
        }
      } catch {
        // Tool output is not JSON — that's fine, carry on
      }
    }

    return {
      messages: toolMessages,
      draftId,
      draftStatus,
      validationReport,
      previewPayload,
    };
  };
}
