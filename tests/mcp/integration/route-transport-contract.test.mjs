import { afterEach, describe, expect, it, vi } from "vitest";
import { mcpAuthForUser, TEST_USERS } from "../helpers/auth-fixtures.mjs";
import { createOptionsRequest, mcpRouteUrl } from "../helpers/route-client.mjs";

const ORIGINAL_ENV = {
  MCP_CORS_ORIGINS: process.env.MCP_CORS_ORIGINS,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function loadRoute({ corsOrigins = "https://chatgpt.com", nodeEnv = "test" } = {}) {
  vi.resetModules();
  vi.doUnmock("@/mcp/auth/bearer-auth.middleware");

  process.env.MCP_CORS_ORIGINS = corsOrigins;
  process.env.NODE_ENV = nodeEnv;

  const validateBearerToken = vi.fn(async () => ({
    ok: true,
    auth: mcpAuthForUser(TEST_USERS.userA, { apiKeyId: "api-key-transport" }),
  }));

  vi.doMock("@/mcp/auth/bearer-auth.middleware", () => ({ validateBearerToken }));

  const routeModule = await import("@/app/api/mcp/route");
  return { routeModule, validateBearerToken };
}

function authedRequest(method) {
  return new Request(mcpRouteUrl(), {
    method,
    headers: new Headers({
      Authorization: "Bearer a8n_mcp_test",
      Accept: "application/json, text/event-stream",
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@/mcp/auth/bearer-auth.middleware");
  restoreEnv("MCP_CORS_ORIGINS", ORIGINAL_ENV.MCP_CORS_ORIGINS);
  restoreEnv("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
});

describe("MCP transport contract", () => {
  it("answers GET with 405 and an Allow header instead of an idle SSE stream", async () => {
    // The SDK client opens a standalone GET stream after initialize and only
    // treats 405 as "no server-initiated stream". Under the stateless
    // transport a 200 would hand every client a connection that never emits.
    const { routeModule } = await loadRoute();

    const response = await routeModule.GET(authedRequest("GET"));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toContain("POST");
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const body = await response.json();
    expect(body.error.message).toMatch(/not supported/i);
    expect(body.server.transport).toBe("streamable-http");
  });

  it("does not require authentication to report that GET is unsupported", async () => {
    const { routeModule, validateBearerToken } = await loadRoute();

    const response = await routeModule.GET(
      new Request(mcpRouteUrl(), { method: "GET" }),
    );

    expect(response.status).toBe(405);
    expect(validateBearerToken).not.toHaveBeenCalled();
  });

  it("answers DELETE with 204 without building a server", async () => {
    const { routeModule, validateBearerToken } = await loadRoute();

    const response = await routeModule.DELETE(authedRequest("DELETE"));

    expect(response.status).toBe(204);
    expect(validateBearerToken).toHaveBeenCalled();
  });

  it("rejects an unauthenticated DELETE", async () => {
    vi.resetModules();
    process.env.MCP_CORS_ORIGINS = "https://chatgpt.com";
    process.env.NODE_ENV = "test";
    vi.doMock("@/mcp/auth/bearer-auth.middleware", () => ({
      validateBearerToken: vi.fn(async () => ({
        ok: false,
        error: "Missing Authorization header. Expected: Bearer <token>",
        status: 401,
      })),
    }));

    const routeModule = await import("@/app/api/mcp/route");
    const response = await routeModule.DELETE(
      new Request(mcpRouteUrl(), { method: "DELETE" }),
    );

    expect(response.status).toBe(401);
  });

  it("exposes WWW-Authenticate so browser clients can discover OAuth", async () => {
    // WWW-Authenticate is not CORS-safelisted; without exposing it, a browser
    // client cannot read resource_metadata off a 401.
    const { routeModule } = await loadRoute();

    const response = await routeModule.OPTIONS(
      createOptionsRequest({ origin: "https://chatgpt.com" }),
    );

    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "WWW-Authenticate",
    );
  });
});
