import { AIMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { AgentGraphState } from "../state";
import { approvalService } from "@/agent/safety/approval-service";
import { AgentError } from "@/agent/errors";

/**
 * Apply node — invokes apply_workflow_draft after consuming the approval.
 *
 * 1. Consumes the approval via approval-service (validates hash match)
 * 2. Calls the apply_workflow_draft MCP tool with approved: true and the hash
 * 3. Parses the result and updates state
 */
export function createApplyNode(tools: DynamicStructuredTool[]) {
  const applyTool = tools.find((t) => t.name === "apply_workflow_draft");

  return async function applyNode(
    state: AgentGraphState,
  ): Promise<Partial<AgentGraphState>> {
    if (!state.pendingApprovalId) {
      return {
        messages: [
          new AIMessage("No pending approval to apply."),
        ],
      };
    }

    if (!state.previewPayload) {
      return {
        messages: [
          new AIMessage(
            "The preview data is missing. Please create a new preview.",
          ),
        ],
        pendingApprovalId: null,
      };
    }

    if (!applyTool) {
      return {
        messages: [
          new AIMessage(
            "The apply tool is not available. Workflow application is currently disabled.",
          ),
        ],
        pendingApprovalId: null,
      };
    }

    try {
      // Consume the approval — this validates hash match and prevents replay
      const consumed = await approvalService.consumeApproval({
        approvalId: state.pendingApprovalId,
        expectedHash: state.previewPayload.confirmationHash,
      });

      // Call the MCP apply tool with the confirmation from the approval
      const result = await applyTool.invoke({
        draftId: state.previewPayload.draftId,
        workflowId: state.previewPayload.workflowId || undefined,
        approved: true,
        confirmationHash: consumed.confirmationHash,
      });

      // Parse the tool result
      let applied = false;
      let workflowId = state.workflowId;
      try {
        const parsed =
          typeof result === "string" ? JSON.parse(result) : result;
        applied = parsed?.applied === true;
        workflowId = parsed?.workflowId || workflowId;
      } catch {
        // If we can't parse, treat as failure
      }

      if (applied) {
        return {
          messages: [
            new AIMessage(
              `The workflow draft has been applied successfully.${workflowId ? ` Workflow ID: ${workflowId}` : ""}`,
            ),
          ],
          draftStatus: "applied",
          pendingApprovalId: null,
        };
      }

      return {
        messages: [
          new AIMessage(
            "The draft could not be applied. Please check the validation and try again.",
          ),
        ],
        pendingApprovalId: null,
      };
    } catch (error) {
      const message =
        error instanceof AgentError
          ? error.message
          : "An error occurred while applying the draft.";

      return {
        messages: [new AIMessage(message)],
        pendingApprovalId: null,
        draftStatus: "previewed", // Allow retry
      };
    }
  };
}
