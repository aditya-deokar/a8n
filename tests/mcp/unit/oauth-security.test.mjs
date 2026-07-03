import { describe, expect, it } from "vitest";
import {
  validateOAuthClientMetadata,
  validateOAuthRedirectUri,
} from "@/mcp/auth/oauth.service";

describe("MCP OAuth production redirect policy", () => {
  it("requires exact redirect URI matches when exact mode is enabled", () => {
    const result = validateOAuthRedirectUri(
      "https://chatgpt.com/connector/oauth/runtime-callback",
      ["https://chatgpt.com/connector/oauth/registered-callback"],
      {
        exactOnly: true,
        configuredUris: [],
        allowDevelopmentHostFallback: false,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "redirect_uri must exactly match a registered URI",
    });
  });

  it("allows development hostname fallback only when explicitly enabled", () => {
    const result = validateOAuthRedirectUri("http://localhost:3000/oauth/callback", [], {
      exactOnly: false,
      configuredUris: [],
      allowDevelopmentHostFallback: true,
    });

    expect(result).toMatchObject({
      ok: true,
      match: "development-host",
    });
  });

  it("rejects wildcard redirect metadata", () => {
    expect(() =>
      validateOAuthClientMetadata({
        redirect_uris: ["https://chatgpt.com/connector/oauth/*"],
      }),
    ).toThrow(/wildcards/);
  });

  it("rejects unsupported client metadata", () => {
    expect(() =>
      validateOAuthClientMetadata({
        redirect_uris: ["https://chatgpt.com/connector/oauth/callback"],
        grant_types: ["password"],
      }),
    ).toThrow(/Unsupported grant_types/);
  });
});
