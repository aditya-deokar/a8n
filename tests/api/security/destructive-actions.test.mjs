import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";
import {
  createAppCaller,
  resetApiTestMocks,
  revokeApiKeyMock,
  revokeOAuthClientUserTokensMock,
  setApiUser,
} from "../helpers/trpc-caller.mjs";

describe("destructive action authorization regression coverage", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("workflow deletion is scoped to the authenticated user", async () => {
    const caller = await createAppCaller();

    await caller.workflows.remove({ id: "workflow_a" });

    expect(prismaMock.workflow.delete).toHaveBeenCalledWith({
      where: {
        id: "workflow_a",
        userId: apiUsers.userAPro.id,
      },
    });
  });

  it("credential deletion is scoped to the authenticated user", async () => {
    const caller = await createAppCaller();

    await caller.credentials.remove({ id: "credential_a" });

    expect(prismaMock.credential.delete).toHaveBeenCalledWith({
      where: {
        id: "credential_a",
        userId: apiUsers.userAPro.id,
      },
    });
  });

  it("MCP API key revocation is scoped to the authenticated user", async () => {
    const caller = await createAppCaller();

    await caller.mcp.revokeKey({ id: "api_key_a" });

    expect(revokeApiKeyMock).toHaveBeenCalledWith({
      keyId: "api_key_a",
      userId: apiUsers.userAPro.id,
    });
  });

  it("OAuth connection revocation is scoped to the authenticated user", async () => {
    const caller = await createAppCaller();

    await caller.mcp.revokeOAuthConnection({ clientId: "client_a" });

    expect(revokeOAuthClientUserTokensMock).toHaveBeenCalledWith({
      clientId: "client_a",
      userId: apiUsers.userAPro.id,
    });
  });
});
