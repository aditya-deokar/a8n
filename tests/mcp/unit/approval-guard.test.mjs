import { describe, expect, it } from "vitest";
import {
  requireToolApproval,
  stableApprovalHash,
} from "@/mcp/safety/approval-guard";
import { mcpAuthForUser } from "../helpers/auth-fixtures.mjs";

describe("MCP approval guard", () => {
  it("returns an approval preview for side-effect tools before execution", () => {
    const result = requireToolApproval({
      toolName: "execute_workflow",
      auth: mcpAuthForUser(),
      approved: false,
      requiresConfirmation: false,
      preview: {
        triggered: false,
        workflowId: "workflow-1",
      },
      warning: "Execution may trigger side effects.",
      auditInput: { workflowId: "workflow-1" },
    });

    expect(result.approved).toBe(false);
    expect(result.response.structuredContent).toMatchObject({
      triggered: false,
      approvalRequired: true,
      warning: "Execution may trigger side effects.",
    });
  });

  it("requires a matching confirmation hash for destructive tools", () => {
    const payload = {
      toolName: "delete_workflow",
      workflowId: "workflow-1",
      irreversible: true,
    };
    const expectedHash = stableApprovalHash(payload);

    const rejected = requireToolApproval({
      toolName: "delete_workflow",
      auth: mcpAuthForUser(),
      approved: true,
      confirmationHash: "wrong",
      requiresConfirmation: true,
      confirmationPayload: payload,
      preview: {
        deleted: false,
        workflowId: "workflow-1",
      },
      warning: "Deletion is permanent.",
    });

    expect(rejected.approved).toBe(false);
    expect(rejected.confirmationHash).toBe(expectedHash);
    expect(rejected.response.structuredContent.confirmationHash).toBe(expectedHash);

    const accepted = requireToolApproval({
      toolName: "delete_workflow",
      auth: mcpAuthForUser(),
      approved: true,
      confirmationHash: expectedHash,
      requiresConfirmation: true,
      confirmationPayload: payload,
      preview: {
        deleted: false,
        workflowId: "workflow-1",
      },
      warning: "Deletion is permanent.",
    });

    expect(accepted).toEqual({
      approved: true,
      confirmationHash: expectedHash,
    });
  });

  it("fails closed when a tool has no contract", () => {
    expect(() =>
      requireToolApproval({
        toolName: "missing_tool",
        auth: mcpAuthForUser(),
        approved: true,
        preview: {},
        warning: "missing",
      }),
    ).toThrow(/Missing MCP tool contract/);
  });
});
