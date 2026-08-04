import prisma from "@/lib/db";
import { AgentError } from "@/agent/errors";

const DEFAULT_APPROVAL_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export type CreateApprovalParams = {
  threadId: string;
  runId: string;
  userId: string;
  toolName: string;
  confirmationHash: string;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
  expiresInMs?: number;
};

export type ResolveApprovalParams = {
  approvalId: string;
  userId: string;
  action: "approve" | "reject";
  reason?: string;
};

export type ConsumeApprovalParams = {
  approvalId: string;
  expectedHash: string;
};

/**
 * Server-side approval lifecycle manager.
 *
 * Approvals are server-owned state transitions, not prompt conventions.
 * The model cannot self-approve — only the authenticated user can resolve
 * an approval through a dedicated API endpoint.
 */
export class ApprovalService {
  /**
   * Create a pending approval row with a short expiry.
   */
  async createApproval(params: CreateApprovalParams): Promise<string> {
    const expiresAt = new Date(
      Date.now() + (params.expiresInMs || DEFAULT_APPROVAL_EXPIRY_MS),
    );

    const approval = await prisma.agentApproval.create({
      data: {
        threadId: params.threadId,
        runId: params.runId,
        userId: params.userId,
        toolName: params.toolName,
        status: "PENDING",
        confirmationHash: params.confirmationHash,
        payload: params.payload as any,
        preview: params.preview as any,
        expiresAt,
      },
    });

    return approval.id;
  }

  /**
   * Resolve a pending approval (approve or reject).
   * Validates ownership, status, and expiry.
   */
  async resolveApproval(params: ResolveApprovalParams): Promise<{
    status: "APPROVED" | "REJECTED";
    threadId: string;
    runId: string;
    confirmationHash: string;
  }> {
    const approval = await prisma.agentApproval.findUnique({
      where: { id: params.approvalId },
    });

    if (!approval) {
      throw new AgentError(
        "AGENT_APPROVAL_REQUIRED",
        "Approval not found.",
      );
    }

    // Ownership check
    if (approval.userId !== params.userId) {
      throw new AgentError(
        "AGENT_UNAUTHORIZED",
        "You are not authorized to resolve this approval.",
      );
    }

    // Status check
    if (approval.status !== "PENDING") {
      throw new AgentError(
        "AGENT_APPROVAL_EXPIRED",
        `Approval has already been ${approval.status.toLowerCase()}.`,
      );
    }

    // Expiry check
    if (approval.expiresAt < new Date()) {
      await prisma.agentApproval.update({
        where: { id: approval.id },
        data: { status: "EXPIRED" },
      });
      throw new AgentError(
        "AGENT_APPROVAL_EXPIRED",
        "This approval has expired. Please ask the agent to create a new preview.",
      );
    }

    const newStatus = params.action === "approve" ? "APPROVED" : "REJECTED";
    await prisma.agentApproval.update({
      where: { id: approval.id },
      data: {
        status: newStatus as "APPROVED" | "REJECTED",
        resolvedAt: new Date(),
        resolvedByUserId: params.userId,
        rejectionReason: params.reason || null,
      },
    });

    return {
      status: newStatus as "APPROVED" | "REJECTED",
      threadId: approval.threadId,
      runId: approval.runId,
      confirmationHash: approval.confirmationHash,
    };
  }

  /**
   * Consume an approved approval for tool execution.
   * Transitions APPROVED → CONSUMED. Validates hash match.
   * Prevents replay — an approval can only be consumed once.
   */
  async consumeApproval(params: ConsumeApprovalParams): Promise<{
    toolName: string;
    payload: Record<string, unknown>;
    confirmationHash: string;
  }> {
    const approval = await prisma.agentApproval.findUnique({
      where: { id: params.approvalId },
    });

    if (!approval) {
      throw new AgentError(
        "AGENT_APPROVAL_REQUIRED",
        "Approval not found.",
      );
    }

    if (approval.status !== "APPROVED") {
      throw new AgentError(
        "AGENT_APPROVAL_REQUIRED",
        `Approval is ${approval.status.toLowerCase()}, not approved.`,
      );
    }

    // Hash match — prevents applying a different draft than what was previewed
    if (approval.confirmationHash !== params.expectedHash) {
      throw new AgentError(
        "AGENT_STALE_WORKFLOW",
        "The confirmation hash does not match. The draft may have changed since the preview.",
      );
    }

    // Expiry check even on approved approvals
    if (approval.expiresAt < new Date()) {
      await prisma.agentApproval.update({
        where: { id: approval.id },
        data: { status: "EXPIRED" },
      });
      throw new AgentError(
        "AGENT_APPROVAL_EXPIRED",
        "This approval has expired after being approved. Please create a new preview.",
      );
    }

    await prisma.agentApproval.update({
      where: { id: approval.id },
      data: { status: "CONSUMED" },
    });

    return {
      toolName: approval.toolName,
      payload: approval.payload as Record<string, unknown>,
      confirmationHash: approval.confirmationHash,
    };
  }

  /**
   * List pending approvals for a thread.
   */
  async listPending(params: {
    threadId: string;
    userId: string;
  }) {
    return prisma.agentApproval.findMany({
      where: {
        threadId: params.threadId,
        userId: params.userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        toolName: true,
        status: true,
        confirmationHash: true,
        preview: true,
        requestedAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Expire all overdue pending approvals.
   * Intended for a cleanup job.
   */
  async expirePendingApprovals(): Promise<number> {
    const result = await prisma.agentApproval.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }
}

export const approvalService = new ApprovalService();
