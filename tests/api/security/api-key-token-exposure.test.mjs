import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildApiKey } from "../fixtures/factories.mjs";
import {
  createApiKeyMock,
  createAppCaller,
  listApiKeysMock,
  resetApiTestMocks,
  revokeOAuthClientUserTokensMock,
  setApiUser,
} from "../helpers/trpc-caller.mjs";

function serialized(value) {
  return JSON.stringify(value);
}

describe("API key and OAuth token exposure regression coverage", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("returns the raw MCP API key only from createKey", async () => {
    const caller = await createAppCaller();

    const createResult = await caller.mcp.createKey({
      name: "One-time key",
      scopes: ["workflows:read"],
    });

    expect(createResult.rawKey).toBe("a8n_mcp_test_raw_key");
    expect(createApiKeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: apiUsers.userAPro.id,
      }),
    );
  });

  it("does not expose raw API keys or key hashes from listKeys", async () => {
    listApiKeysMock.mockResolvedValue([
      buildApiKey({
        id: "api_key_safe",
        keyPrefix: "a8n_mcp_abcd1234",
      }),
    ]);
    const caller = await createAppCaller();

    const result = await caller.mcp.listKeys();

    expect(serialized(result)).toContain("a8n_mcp_abcd1234");
    expect(serialized(result)).not.toContain("rawKey");
    expect(serialized(result)).not.toContain("keyHash");
    expect(serialized(result)).not.toContain("a8n_mcp_test_raw_key");
  });

  it("OAuth connection revocation returns counts without token hashes", async () => {
    revokeOAuthClientUserTokensMock.mockResolvedValue({
      revokedAccessTokens: 2,
      revokedRefreshTokens: 1,
    });
    const caller = await createAppCaller();

    const result = await caller.mcp.revokeOAuthConnection({ clientId: "client_a" });

    expect(result).toEqual({
      revokedAccessTokens: 2,
      revokedRefreshTokens: 1,
    });
    expect(serialized(result)).not.toContain("tokenHash");
    expect(serialized(result)).not.toContain("refresh");
  });
});
