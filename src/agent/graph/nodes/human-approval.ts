import { interrupt } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import type { AgentGraphState } from "../state";
import { approvalService } from "@/agent/safety/approval-service";

/**
 * Approval interrupt node.
 *
 * This node:
 * 1. Creates an AgentApproval row with the preview payload
 * 2. Uses LangGraph interrupt() to pause the graph
 * 3. When resumed after user approval/rejection, routes accordingly
 *
 * The interrupt payload is persisted in the LangGraph checkpoint so the
 * graph can be resumed after the user responds through the approval API.
 */
export async function humanApprovalNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const preview = state.previewPayload;

  if (!preview) {
    return {
      messages: [
        new AIMessage(
          "No preview is available. Please validate the draft first.",
        ),
      ],
    };
  }

  // If we already have a pending approval, we're being resumed
  if (state.pendingApprovalId) {
    // The approval has been resolved externally — check its status
    // The resume path injects the approval decision into the graph state
    return {};
  }

  // Create the approval row
  const approvalId = await approvalService.createApproval({
    threadId: "", // Will be set by the service layer before graph invocation
    runId: "", // Will be set by the service layer
    userId: state.userId,
    toolName: "apply_workflow_draft",
    confirmationHash: preview.confirmationHash,
    payload: {
      draftId: preview.draftId,
      workflowId: preview.workflowId,
      diff: preview.diff,
    },
    preview: {
      draftId: preview.draftId,
      workflowId: preview.workflowId,
      diff: preview.diff,
      validation: preview.validation,
    },
  });

  // Interrupt the graph — this saves the checkpoint and pauses execution.
  // The graph will resume when the approval API endpoint triggers a resume.
  const approvalDecision = interrupt({
    approvalId,
    type: "approval_requested",
    toolName: "apply_workflow_draft",
    confirmationHash: preview.confirmationHash,
    preview: {
      draftId: preview.draftId,
      workflowId: preview.workflowId,
      diff: preview.diff,
      validation: preview.validation,
    },
  });

  // When resumed, approvalDecision contains the user's response
  const decision = approvalDecision as {
    approved: boolean;
    reason?: string;
  };

  if (!decision.approved) {
    return {
      messages: [
        new AIMessage(
          decision.reason
            ? `The changes were rejected: ${decision.reason}. Let me know if you'd like to revise the draft.`
            : "The changes were rejected. Let me know if you'd like to revise the draft.",
        ),
      ],
      pendingApprovalId: null,
      draftStatus: "validated", // Reset to validated so user can re-preview
    };
  }

  return {
    pendingApprovalId: approvalId,
    draftStatus: "applying",
  };
}
