"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

// ─── Types ───────────────────────────────────────────────────

export interface UseAgentApprovalsOptions {
  /**
   * Guard callback invoked before approving. Return `false` to prevent
   * the approval (e.g. when the editor canvas has unsaved changes).
   */
  onBeforeApprove?: () => boolean;
}

export interface UseAgentApprovalsReturn {
  /**
   * Approve a pending approval. Returns `true` on success.
   * Returns `false` if `onBeforeApprove` prevented the approval.
   * Throws if the mutation fails.
   */
  approve: (approvalId: string) => Promise<boolean>;
  /**
   * Reject a pending approval with an optional reason. Returns `true`
   * on success. Throws if the mutation fails.
   */
  reject: (approvalId: string, reason?: string) => Promise<boolean>;
  /** Whether an approve or reject mutation is in-flight. */
  isPending: boolean;
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * React hook for handling agent approval actions.
 *
 * Extracted from `agent-sidebar.tsx` (lines 257–269). The
 * `onBeforeApprove` guard lets the editor sidebar check for
 * unsaved canvas changes before allowing an apply.
 */
export function useAgentApprovals(
  options?: UseAgentApprovalsOptions,
): UseAgentApprovalsReturn {
  const trpc = useTRPC();

  const approveMutation = useMutation(
    trpc.agent.approveApproval.mutationOptions(),
  );
  const rejectMutation = useMutation(
    trpc.agent.rejectApproval.mutationOptions(),
  );

  const approve = async (approvalId: string): Promise<boolean> => {
    if (options?.onBeforeApprove && !options.onBeforeApprove()) {
      return false;
    }
    await approveMutation.mutateAsync({ approvalId });
    return true;
  };

  const reject = async (
    approvalId: string,
    reason?: string,
  ): Promise<boolean> => {
    await rejectMutation.mutateAsync({ approvalId, reason });
    return true;
  };

  return {
    approve,
    reject,
    isPending: approveMutation.isPending || rejectMutation.isPending,
  };
}
