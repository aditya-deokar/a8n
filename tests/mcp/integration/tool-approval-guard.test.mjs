import { afterEach, describe, expect, it, vi } from "vitest";
import { mcpAuthForUser } from "../helpers/auth-fixtures.mjs";

function captureServer() {
  const tools = new Map();
  return {
    tools,
    server: {
      tool: vi.fn((name, _description, _schema, handler) => {
        tools.set(name, handler);
      }),
    },
  };
}

function textContent(result) {
  return result.content?.map((item) => item.text).join("\n") || "";
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/inngest/utils");
  vi.doUnmock("@/mcp/auth/api-key.service");
});

describe("MCP high-risk tool handler approval gates", () => {
  it("does not trigger execute_workflow before approval", async () => {
    const sendWorkflowExecution = vi.fn(async () => ({ eventId: "evt-approved" }));
    const prisma = {
      workflow: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "workflow-1",
          name: "Approval workflow",
        })),
      },
    };

    vi.doMock("@/lib/db", () => ({ default: prisma }));
    vi.doMock("@/inngest/utils", () => ({ sendWorkflowExecution }));

    const { registerExecuteWorkflow } = await import(
      "@/mcp/tools/workflows/workflow-mutations.tool"
    );
    const { server, tools } = captureServer();
    registerExecuteWorkflow(server, { authInfo: mcpAuthForUser() });

    const handler = tools.get("execute_workflow");
    const preview = await handler({ id: "workflow-1", approved: false }, {});

    expect(preview.structuredContent).toMatchObject({
      triggered: false,
      approvalRequired: true,
      workflowId: "workflow-1",
    });
    expect(sendWorkflowExecution).not.toHaveBeenCalled();

    const executed = await handler({ id: "workflow-1", approved: true }, {});

    expect(sendWorkflowExecution).toHaveBeenCalledWith({ workflowId: "workflow-1" });
    expect(executed.structuredContent).toMatchObject({
      workflowId: "workflow-1",
      inngestEventId: "evt-approved",
    });
  });

  it("does not delete workflows without the returned confirmation hash", async () => {
    const prisma = {
      workflow: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "workflow-delete",
          name: "Delete me",
        })),
        delete: vi.fn(async () => ({ id: "workflow-delete" })),
      },
    };

    vi.doMock("@/lib/db", () => ({ default: prisma }));
    vi.doMock("@/inngest/utils", () => ({
      sendWorkflowExecution: vi.fn(),
    }));

    const { registerDeleteWorkflow } = await import(
      "@/mcp/tools/workflows/workflow-mutations.tool"
    );
    const { server, tools } = captureServer();
    registerDeleteWorkflow(server, { authInfo: mcpAuthForUser() });

    const handler = tools.get("delete_workflow");
    const preview = await handler({ id: "workflow-delete", approved: false }, {});
    const confirmationHash = preview.structuredContent.confirmationHash;

    expect(preview.structuredContent).toMatchObject({
      deleted: false,
      approvalRequired: true,
      workflowId: "workflow-delete",
      irreversible: true,
    });
    expect(prisma.workflow.delete).not.toHaveBeenCalled();

    const wrongHash = await handler(
      { id: "workflow-delete", approved: true, confirmationHash: "wrong" },
      {},
    );

    expect(wrongHash.structuredContent.confirmationHash).toBe(confirmationHash);
    expect(prisma.workflow.delete).not.toHaveBeenCalled();

    const deleted = await handler(
      { id: "workflow-delete", approved: true, confirmationHash },
      {},
    );

    expect(prisma.workflow.delete).toHaveBeenCalledWith({
      where: { id: "workflow-delete", userId: "mcp-test-user-a" },
    });
    expect(textContent(deleted)).toContain("permanently deleted");
  });

  it("does not revoke API keys without the returned confirmation hash", async () => {
    const listApiKeys = vi.fn(async () => [
      {
        id: "key-1",
        name: "Cursor key",
        keyPrefix: "a8n_mcp_abcd",
        scopes: ["workflows:read"],
      },
    ]);
    const revokeApiKey = vi.fn(async () => true);

    vi.doMock("@/mcp/auth/api-key.service", () => ({
      createApiKey: vi.fn(),
      listApiKeys,
      revokeApiKey,
    }));

    const { registerRevokeApiKey } = await import(
      "@/mcp/tools/api-keys/api-key-tools"
    );
    const { server, tools } = captureServer();
    registerRevokeApiKey(server, { authInfo: mcpAuthForUser() });

    const handler = tools.get("revoke_api_key");
    const preview = await handler({ keyId: "key-1", approved: false }, {});
    const confirmationHash = preview.structuredContent.confirmationHash;

    expect(preview.structuredContent).toMatchObject({
      revoked: false,
      approvalRequired: true,
      irreversible: true,
    });
    expect(revokeApiKey).not.toHaveBeenCalled();

    const revoked = await handler(
      { keyId: "key-1", approved: true, confirmationHash },
      {},
    );

    expect(revokeApiKey).toHaveBeenCalledWith({
      keyId: "key-1",
      userId: "mcp-test-user-a",
    });
    expect(textContent(revoked)).toContain("revoked");
  });
});
