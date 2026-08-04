import type { AgentGraphState } from "../state";

/**
 * Sync-editor node.
 *
 * After a successful apply, emit the authoritative applied graph data
 * that the frontend needs to synchronize React Flow. This node doesn't
 * modify messages — it just marks state so the service layer can emit
 * the workflow.applied event with the correct payload.
 */
export async function syncEditorNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  // The service layer reads draftStatus === "applied" and the previewPayload
  // to emit a workflow.applied event. This node ensures the state is clean
  // for the finalize step.
  return {
    // Clear the approval state — it's been consumed
    pendingApprovalId: null,
    // Clear the preview — it's been applied
    previewPayload: null,
    // Keep draftStatus as "applied" for the finalize node
  };
}
