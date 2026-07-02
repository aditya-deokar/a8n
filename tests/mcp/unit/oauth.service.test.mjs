import { describe, expect, it } from "vitest";
import {
  hashOAuthSecret,
  parseOAuthScopes,
  scopeString,
} from "@/mcp/auth/oauth.service";

function restoreEnv(name, previous) {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("MCP OAuth helper functions", () => {
  it("hashes OAuth secrets deterministically", () => {
    const previous = process.env.MCP_OAUTH_TOKEN_HMAC_SECRET;
    process.env.MCP_OAUTH_TOKEN_HMAC_SECRET = "unit-oauth-hmac-secret-32-characters";

    const left = hashOAuthSecret("oauth-token");
    const right = hashOAuthSecret("oauth-token");

    restoreEnv("MCP_OAUTH_TOKEN_HMAC_SECRET", previous);
    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parses and de-duplicates supported OAuth scopes", () => {
    expect(parseOAuthScopes("workflows:read workflows:read system:read")).toEqual([
      "workflows:read",
      "system:read",
    ]);
  });

  it("rejects unsupported OAuth scopes", () => {
    expect(() => parseOAuthScopes("api_keys:manage")).toThrow(/Unsupported OAuth scopes/);
  });

  it("formats scope strings", () => {
    expect(scopeString(["workflows:read", "system:read"])).toBe(
      "workflows:read system:read",
    );
  });
});
