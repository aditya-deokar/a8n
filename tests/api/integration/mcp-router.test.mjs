import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import {
  createApiKeyMock,
  createAppCaller,
  getMcpUserSecuritySummaryMock,
  listApiKeysMock,
  listMcpOAuthConnectionsForUserMock,
  resetApiTestMocks,
  revokeApiKeyMock,
  revokeOAuthClientUserTokensMock,
  setApiUser,
} from "../helpers/trpc-caller.mjs";

describe("MCP dashboard tRPC router integration", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("creates API keys for the current user and computes expiration", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.mcp.createKey({
        name: "Dashboard key",
        scopes: ["workflows:read", "system:read"],
        expiresInDays: 30,
      }),
    ).resolves.toMatchObject({
      rawKey: "a8n_mcp_test_raw_key",
    });

    expect(createApiKeyMock).toHaveBeenCalledWith({
      userId: apiUsers.userAPro.id,
      name: "Dashboard key",
      scopes: ["workflows:read", "system:read"],
      expiresAt: expect.any(Date),
    });
  });

  it("lists only current-user API key metadata", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.listKeys()).resolves.toHaveLength(1);
    expect(listApiKeysMock).toHaveBeenCalledWith(apiUsers.userAPro.id);
  });

  it("revokes API keys through user-scoped service parameters", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.revokeKey({ id: "api_key_a" })).resolves.toEqual({
      success: true,
    });
    expect(revokeApiKeyMock).toHaveBeenCalledWith({
      keyId: "api_key_a",
      userId: apiUsers.userAPro.id,
    });
  });

  it("returns the current user's MCP security summary", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.securitySummary()).resolves.toMatchObject({
      apiKeys: { total: 1 },
    });
    expect(getMcpUserSecuritySummaryMock).toHaveBeenCalledWith(apiUsers.userAPro.id);
  });

  it("lists OAuth connections for the current user", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.listOAuthConnections()).resolves.toEqual([]);
    expect(listMcpOAuthConnectionsForUserMock).toHaveBeenCalledWith(apiUsers.userAPro.id);
  });

  it("revokes OAuth client tokens for the current user", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.revokeOAuthConnection({ clientId: "client_a" })).resolves.toEqual({
      revokedAccessTokens: 1,
      revokedRefreshTokens: 1,
    });
    expect(revokeOAuthClientUserTokensMock).toHaveBeenCalledWith({
      userId: apiUsers.userAPro.id,
      clientId: "client_a",
    });
  });
});
