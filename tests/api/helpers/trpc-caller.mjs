import { vi } from "vitest";
import { apiUsers, createApiSession } from "../fixtures/auth-fixtures.mjs";
import { buildApiKey } from "../fixtures/factories.mjs";
import { prismaMock, resetPrismaMock } from "./mock-prisma.mjs";

export const authGetSessionMock = vi.fn();
export const headersMock = vi.fn();
export const polarGetStateExternalMock = vi.fn();
export const sendWorkflowExecutionMock = vi.fn();
export const createApiKeyMock = vi.fn();
export const listApiKeysMock = vi.fn();
export const revokeApiKeyMock = vi.fn();
export const getMcpUserSecuritySummaryMock = vi.fn();
export const listMcpOAuthConnectionsForUserMock = vi.fn();
export const revokeOAuthClientUserTokensMock = vi.fn();

export function setAnonymousApiUser() {
  authGetSessionMock.mockResolvedValue(null);
}

export function setApiUser(user = apiUsers.userAPro) {
  authGetSessionMock.mockResolvedValue(createApiSession(user));
}

export function setPremiumSubscription(active = true) {
  polarGetStateExternalMock.mockResolvedValue({
    activeSubscriptions: active ? [{ id: "subscription_pro", status: "active" }] : [],
  });
}

export function resetApiTestMocks() {
  vi.clearAllMocks();
  resetPrismaMock();

  setApiUser(apiUsers.userAPro);
  setPremiumSubscription(true);

  headersMock.mockResolvedValue(new Headers([["x-api-test", "true"]]));
  sendWorkflowExecutionMock.mockResolvedValue({ eventId: "event_dispatched", result: {} });

  createApiKeyMock.mockResolvedValue({
    apiKey: buildApiKey(),
    rawKey: "a8n_mcp_test_raw_key",
  });
  listApiKeysMock.mockResolvedValue([buildApiKey()]);
  revokeApiKeyMock.mockResolvedValue(true);
  getMcpUserSecuritySummaryMock.mockResolvedValue({
    apiKeys: { total: 1, active: 1, revoked: 0, expired: 0 },
    oauthConnections: { total: 0, active: 0 },
    audit: { recentFailures: 0 },
  });
  listMcpOAuthConnectionsForUserMock.mockResolvedValue([]);
  revokeOAuthClientUserTokensMock.mockResolvedValue({
    revokedAccessTokens: 1,
    revokedRefreshTokens: 1,
  });
}

export function installApiModuleMocks() {
  vi.doMock("@/lib/db", () => ({ default: prismaMock }));
  vi.doMock("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: authGetSessionMock,
      },
    },
  }));
  vi.doMock("next/headers", () => ({ headers: headersMock }));
  vi.doMock("@/lib/polar", () => ({
    polarClient: {
      customers: {
        getStateExternal: polarGetStateExternalMock,
      },
    },
  }));
  vi.doMock("@/inngest/utils", () => ({
    inngest: { send: vi.fn() },
    sendWorkflowExecution: sendWorkflowExecutionMock,
  }));
  vi.doMock("@/mcp/auth/api-key.service", () => ({
    createApiKey: createApiKeyMock,
    listApiKeys: listApiKeysMock,
    revokeApiKey: revokeApiKeyMock,
  }));
  vi.doMock("@/mcp/security/security-summary", () => ({
    getMcpUserSecuritySummary: getMcpUserSecuritySummaryMock,
    listMcpOAuthConnectionsForUser: listMcpOAuthConnectionsForUserMock,
  }));
  vi.doMock("@/mcp/auth/oauth.service", () => ({
    revokeOAuthClientUserTokens: revokeOAuthClientUserTokensMock,
  }));
}

export async function loadAppRouter() {
  vi.resetModules();
  installApiModuleMocks();
  const { appRouter } = await import("@/trpc/routers/_app");
  return appRouter;
}

export async function createAppCaller() {
  const appRouter = await loadAppRouter();
  return appRouter.createCaller({});
}

export async function loadTrpcInit() {
  vi.resetModules();
  installApiModuleMocks();
  return import("@/trpc/init");
}

export function expectTrpcCode(error, code) {
  if (!error || error.code !== code) {
    throw new Error(`Expected tRPC code ${code}, received ${error?.code ?? "<missing>"}`);
  }
}

resetApiTestMocks();
