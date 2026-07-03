import { expect, test } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { newSignedUpE2ERequestContext, signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getApiKeyById,
  getE2EMcpOAuthTokenState,
  seedE2EMcpOAuthConnection,
} from "../helpers/db";
import { expectNoSecretLeakInText } from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

function expectNoMcpTokenMaterial(value: unknown, rawKey?: string) {
  const text = JSON.stringify(value);

  if (rawKey) {
    expect(text).not.toContain(rawKey);
  }
  expect(text).not.toContain("keyHash");
  expect(text).not.toContain("tokenHash");
  expect(text).not.toContain("_access_hash");
  expect(text).not.toContain("_refresh_hash");
}

test.describe("backend E2E MCP dashboard API", () => {
  test.beforeEach(async () => {
    await cleanupE2EData();
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("creates an MCP API key and only returns the raw key once", async ({ request }) => {
    const user = buildE2EUser("mcp_key_create");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);

    const created = await trpc.mcp.createKey.mutate({
      name: "E2E MCP Key",
      scopes: ["workflows:read", "executions:read"],
      expiresInDays: 7,
    });

    expect(created.rawKey).toEqual(expect.stringMatching(/^a8n_mcp_/));
    expect(created.record).toMatchObject({
      id: expect.any(String),
      name: "E2E MCP Key",
      keyPrefix: expect.any(String),
      scopes: ["workflows:read", "executions:read"],
    });
    expect(JSON.stringify(created.record)).not.toContain(created.rawKey);
    expect(JSON.stringify(created.record)).not.toContain("keyHash");

    const persisted = await getApiKeyById(created.record.id);
    expect(persisted.keyHash).not.toBe(created.rawKey);
    expect(persisted.keyPrefix).toBe(created.record.keyPrefix);
    expect(persisted.revokedAt).toBeNull();

    const listed = await trpc.mcp.listKeys.query();
    expect(listed).toEqual([
      expect.objectContaining({
        id: created.record.id,
        name: "E2E MCP Key",
        keyPrefix: created.record.keyPrefix,
      }),
    ]);
    expectNoMcpTokenMaterial(listed, created.rawKey);

    const summary = await trpc.mcp.securitySummary.query();
    expect(summary).toMatchObject({
      apiKeys: {
        active: 1,
      },
    });
    expectNoMcpTokenMaterial(summary, created.rawKey);
  });

  test("revokes an MCP API key and removes it from active listings", async ({ request }) => {
    const user = buildE2EUser("mcp_key_revoke");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);
    const created = await trpc.mcp.createKey.mutate({
      name: "E2E Revoke Key",
      scopes: ["workflows:read"],
      expiresInDays: 7,
    });

    await expect(
      trpc.mcp.revokeKey.mutate({ id: created.record.id }),
    ).resolves.toEqual({ success: true });

    const persisted = await getApiKeyById(created.record.id);
    expect(persisted.revokedAt).toEqual(expect.any(Date));

    await expect(trpc.mcp.listKeys.query()).resolves.toEqual([]);
  });

  test("another user cannot revoke an MCP API key", async () => {
    const owner = buildE2EUser("mcp_key_owner");
    const attacker = buildE2EUser("mcp_key_attacker");
    const ownerContext = await newSignedUpE2ERequestContext(owner);
    const attackerContext = await newSignedUpE2ERequestContext(attacker);

    try {
      const ownerTrpc = createE2ETrpcClient(ownerContext);
      const attackerTrpc = createE2ETrpcClient(attackerContext);
      const created = await ownerTrpc.mcp.createKey.mutate({
        name: "Owner MCP Key",
        scopes: ["workflows:read"],
      });

      await expect(
        attackerTrpc.mcp.revokeKey.mutate({ id: created.record.id }),
      ).resolves.toEqual({ success: false });

      const persisted = await getApiKeyById(created.record.id);
      expect(persisted.revokedAt).toBeNull();
      await expect(ownerTrpc.mcp.listKeys.query()).resolves.toEqual([
        expect.objectContaining({ id: created.record.id }),
      ]);
    } finally {
      await ownerContext.dispose();
      await attackerContext.dispose();
    }
  });

  test("lists and revokes an MCP OAuth connection", async ({ request }) => {
    const user = buildE2EUser("mcp_oauth_revoke");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    const clientId = "e2e_oauth_client_revoke";
    await seedE2EMcpOAuthConnection({
      clientId,
      userId: dbUser.id,
      clientName: "E2E OAuth Dashboard Client",
      scopes: ["workflows:read", "executions:read"],
    });
    const trpc = createE2ETrpcClient(request);

    const listed = await trpc.mcp.listOAuthConnections.query();
    expect(listed).toEqual([
      expect.objectContaining({
        clientId,
        clientName: "E2E OAuth Dashboard Client",
        scopes: ["workflows:read", "executions:read"],
        activeAccessTokens: 1,
        activeRefreshTokens: 1,
      }),
    ]);
    expectNoSecretLeakInText(JSON.stringify(listed));
    expectNoMcpTokenMaterial(listed);

    await expect(trpc.mcp.securitySummary.query()).resolves.toMatchObject({
      oauth: {
        connectedClients: 1,
        activeTokens: 2,
      },
    });

    await expect(
      trpc.mcp.revokeOAuthConnection.mutate({ clientId }),
    ).resolves.toEqual({
      accessTokensRevoked: 1,
      refreshTokensRevoked: 1,
      consentsRevoked: 1,
    });

    await expect(getE2EMcpOAuthTokenState(clientId)).resolves.toEqual({
      activeAccessTokens: 0,
      activeRefreshTokens: 0,
      activeConsents: 0,
    });
    await expect(trpc.mcp.listOAuthConnections.query()).resolves.toEqual([]);
  });

  test("another user cannot list or revoke an MCP OAuth connection", async () => {
    const owner = buildE2EUser("mcp_oauth_owner");
    const attacker = buildE2EUser("mcp_oauth_attacker");
    const ownerContext = await newSignedUpE2ERequestContext(owner);
    const attackerContext = await newSignedUpE2ERequestContext(attacker);
    const clientId = "e2e_oauth_client_tenant_owned";

    try {
      const ownerRecord = await findE2EUserByEmail(owner.email);
      await seedE2EMcpOAuthConnection({
        clientId,
        userId: ownerRecord.id,
        clientName: "Tenant Owned OAuth Client",
      });

      const attackerTrpc = createE2ETrpcClient(attackerContext);
      await expect(attackerTrpc.mcp.listOAuthConnections.query()).resolves.toEqual([]);
      await expect(
        attackerTrpc.mcp.revokeOAuthConnection.mutate({ clientId }),
      ).resolves.toEqual({
        accessTokensRevoked: 0,
        refreshTokensRevoked: 0,
        consentsRevoked: 0,
      });

      await expect(getE2EMcpOAuthTokenState(clientId)).resolves.toEqual({
        activeAccessTokens: 1,
        activeRefreshTokens: 1,
        activeConsents: 1,
      });
    } finally {
      await ownerContext.dispose();
      await attackerContext.dispose();
    }
  });
});
