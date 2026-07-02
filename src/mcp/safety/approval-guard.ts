import { createHash } from "crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/mcp/auth/types";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getToolContract } from "@/mcp/contracts/tools.manifest";

export type ApprovalGuardResult =
  | { approved: true; confirmationHash?: string }
  | { approved: false; response: CallToolResult; confirmationHash?: string };

export function stableApprovalHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function logApprovalEvent(params: {
  auth: McpAuthInfo;
  toolName: string;
  event: "approval_requested" | "approval_accepted";
  input: Record<string, unknown>;
}) {
  const audit = createAuditContext({
    userId: params.auth.userId,
    apiKeyId: params.auth.apiKeyId,
    authMethod: params.auth.method,
    tool: `${params.toolName}.${params.event}`,
    input: params.input,
  });
  audit.success();
}

export function requireToolApproval(params: {
  toolName: string;
  auth: McpAuthInfo;
  approved?: boolean;
  confirmationHash?: string;
  confirmationPayload?: unknown;
  requiresConfirmation?: boolean;
  preview: Record<string, unknown>;
  warning: string;
  instruction?: string;
  auditInput?: Record<string, unknown>;
}): ApprovalGuardResult {
  const contract = getToolContract(params.toolName);
  if (!contract) {
    throw new Error(`Missing MCP tool contract for approval-gated tool: ${params.toolName}`);
  }

  const approvalRequired =
    contract.requiresApproval ||
    contract.externalSideEffect ||
    contract.destructive ||
    contract.risk === "approval_gated_write" ||
    contract.risk === "admin_or_destructive";

  if (!approvalRequired) {
    return { approved: true };
  }

  const requiresConfirmation =
    params.requiresConfirmation ??
    Boolean(contract.destructive || contract.risk === "approval_gated_write");
  if (requiresConfirmation && params.confirmationPayload === undefined) {
    throw new Error(
      `Approval confirmation payload is required for high-risk tool: ${params.toolName}`,
    );
  }

  const expectedHash = requiresConfirmation
    ? stableApprovalHash(params.confirmationPayload)
    : undefined;
  const confirmationAccepted =
    !requiresConfirmation || params.confirmationHash === expectedHash;
  const auditInput = {
    ...params.auditInput,
    approved: params.approved === true,
    confirmationRequired: requiresConfirmation,
    confirmationHashMatches: confirmationAccepted,
  };

  if (!params.approved || !confirmationAccepted) {
    logApprovalEvent({
      auth: params.auth,
      toolName: params.toolName,
      event: "approval_requested",
      input: auditInput,
    });

    return {
      approved: false,
      confirmationHash: expectedHash,
      response: mcpJsonResponse({
        ...params.preview,
        approvalRequired: true,
        ...(expectedHash ? { confirmationHash: expectedHash } : {}),
        warning: params.warning,
        instruction:
          params.instruction ||
          (expectedHash
            ? "Call again with approved: true and this confirmationHash after explicit user approval."
            : "Call again with approved: true after explicit user approval."),
      }),
    };
  }

  logApprovalEvent({
    auth: params.auth,
    toolName: params.toolName,
    event: "approval_accepted",
    input: auditInput,
  });

  return { approved: true, confirmationHash: expectedHash };
}
