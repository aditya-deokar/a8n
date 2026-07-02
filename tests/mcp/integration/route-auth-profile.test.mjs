import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHATGPT_TOOL_CONTRACTS,
  DEFAULT_TOOL_CONTRACTS,
  FORBIDDEN_CHATGPT_TOOL_CONTRACTS,
} from "@/mcp/contracts/tools.manifest";
import {
  mcpAuthForUser,
  oauthAuthForUser,
  TEST_USERS,
} from "../helpers/auth-fixtures.mjs";
import {
  callMcpJson,
  createMcpPostRequest,
  createOptionsRequest,
  readJson,
  toolNamesFromListResponse,
} from "../helpers/route-client.mjs";

const ORIGINAL_ENV = {
  MCP_CORS_ORIGINS: process.env.MCP_CORS_ORIGINS,
  MCP_APP_PROFILE: process.env.MCP_APP_PROFILE,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function loadRoute({
  authResult,
  corsOrigins = "https://chatgpt.com",
  nodeEnv = "test",
  mcpModule,
} = {}) {
  vi.resetModules();
  vi.doUnmock("@/mcp");
  vi.doUnmock("@/mcp/auth/bearer-auth.middleware");

  process.env.MCP_CORS_ORIGINS = corsOrigins;
  process.env.NODE_ENV = nodeEnv;

  const validateBearerToken = vi.fn(async () =>
    authResult ?? {
      ok: true,
      auth: mcpAuthForUser(TEST_USERS.userA, {
        apiKeyId: `api-key-${Date.now()}-${Math.random()}`,
      }),
    },
  );

  vi.doMock("@/mcp/auth/bearer-auth.middleware", () => ({
    validateBearerToken,
  }));

  if (mcpModule) {
    vi.doMock("@/mcp", () => mcpModule);
  }

  const routeModule = await import("@/app/api/mcp/route");
  return { routeModule, validateBearerToken };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@/mcp");
  vi.doUnmock("@/mcp/auth/bearer-auth.middleware");
  restoreEnv("MCP_CORS_ORIGINS", ORIGINAL_ENV.MCP_CORS_ORIGINS);
  restoreEnv("MCP_APP_PROFILE", ORIGINAL_ENV.MCP_APP_PROFILE);
  restoreEnv("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
});

describe("MCP route auth and CORS integration", () => {
  it.each([
    ["missing bearer token", "Missing Authorization header. Expected: Bearer <token>"],
    ["invalid API key", "Invalid or expired API key"],
    ["expired OAuth token", "OAuth access token is expired"],
    ["wrong-resource OAuth token", "OAuth token resource is not valid for this MCP server"],
  ])("returns OAuth-aware 401 for %s", async (_name, error) => {
    const { routeModule, validateBearerToken } = await loadRoute({
      authResult: { ok: false, error, status: 401 },
    });

    const response = await routeModule.POST(
      createMcpPostRequest({
        token: null,
        origin: "https://chatgpt.com",
      }),
    );
    const json = await readJson(response);

    expect(response.status).toBe(401);
    expect(json.error).toBe(error);
    expect(json.hint).toMatch(/Bearer <token>/);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://chatgpt.com");
    expect(validateBearerToken).toHaveBeenCalledTimes(1);
  });

  it("rejects disallowed origins without echoing them as allowed", async () => {
    const { routeModule, validateBearerToken } = await loadRoute();

    const response = await routeModule.OPTIONS(
      createOptionsRequest({ origin: "https://attacker.example" }),
    );
    const json = await readJson(response);

    expect(response.status).toBe(403);
    expect(json.error).toMatch(/Origin not allowed/);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(validateBearerToken).not.toHaveBeenCalled();
  });

  it("fails closed when production CORS is configured as wildcard", async () => {
    const { routeModule } = await loadRoute({
      corsOrigins: "*",
      nodeEnv: "production",
    });

    const response = await routeModule.OPTIONS(
      createOptionsRequest({ origin: "https://chatgpt.com" }),
    );
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error).toMatch(/MCP_CORS_ORIGINS must list explicit origins/);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("MCP route profile integration", () => {
  it("exposes the full default tool surface to default profile clients", async () => {
    const { routeModule } = await loadRoute({
      authResult: {
        ok: true,
        auth: mcpAuthForUser(TEST_USERS.userA, {
          apiKeyId: "api-key-default-profile",
          scopes: ["*"],
        }),
      },
    });

    const { response, json } = await callMcpJson(routeModule, {
      id: 10,
      method: "tools/list",
      origin: "https://chatgpt.com",
      token: "default-profile-token",
    });
    const names = toolNamesFromListResponse(json);

    expect(response.status).toBe(200);
    expect(names).toEqual(DEFAULT_TOOL_CONTRACTS.map((tool) => tool.name).sort());
    expect(names).toContain("create_api_key");
    expect(names).toContain("delete_workflow");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
  });

  it("exposes only the curated ChatGPT app profile tools", async () => {
    const { routeModule } = await loadRoute({
      authResult: {
        ok: true,
        auth: oauthAuthForUser(TEST_USERS.userA, {
          oauthTokenId: "oauth-chatgpt-profile",
          scopes: ["*"],
        }),
      },
    });

    const { response, json } = await callMcpJson(routeModule, {
      id: 20,
      method: "tools/list",
      profile: "chatgpt",
      origin: "https://chatgpt.com",
      token: "oauth-chatgpt-token",
    });
    const names = toolNamesFromListResponse(json);

    expect(response.status).toBe(200);
    expect(names).toEqual(CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name).sort());
    expect(
      FORBIDDEN_CHATGPT_TOOL_CONTRACTS.every((tool) => !names.includes(tool.name)),
    ).toBe(true);
    expect(names).toContain("render_workflow_draft_preview");
    expect(names).not.toContain("create_credential");
    expect(names).not.toContain("delete_workflow");
  });

  it("returns standard rate-limit headers when the route quota is exceeded", async () => {
    const { routeModule } = await loadRoute({
      authResult: {
        ok: true,
        auth: mcpAuthForUser(TEST_USERS.userA, {
          apiKeyId: "api-key-rate-limit-route",
          scopes: ["system:read"],
        }),
      },
    });

    let response;
    for (let index = 0; index < 31; index += 1) {
      response = await routeModule.POST(
        createMcpPostRequest({
          id: 100 + index,
          method: "tools/list",
          origin: "https://chatgpt.com",
          token: "rate-limit-token",
        }),
      );
    }

    const json = await readJson(response);
    expect(response.status).toBe(429);
    expect(json.error).toMatch(/Rate limit exceeded/);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("MCP route production error shape", () => {
  it("does not leak internal exception messages in production JSON-RPC errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { routeModule } = await loadRoute({
      nodeEnv: "production",
      authResult: {
        ok: true,
        auth: mcpAuthForUser(TEST_USERS.userA, {
          apiKeyId: "api-key-production-error",
          scopes: ["*"],
        }),
      },
      mcpModule: {
        createMcpServer: () => {
          throw new Error("database password leaked in stack trace");
        },
      },
    });

    const response = await routeModule.POST(
      createMcpPostRequest({
        id: 50,
        method: "tools/list",
        origin: "https://chatgpt.com",
        token: "production-error-token",
      }),
    );
    const json = await readJson(response);

    expect(response.status).toBe(500);
    expect(json.error.message).toBe("Internal server error");
    expect(JSON.stringify(json)).not.toContain("database password");
    expect(consoleError).toHaveBeenCalled();
  });
});
