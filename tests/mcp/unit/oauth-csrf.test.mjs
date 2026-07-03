import { describe, expect, it } from "vitest";
import {
  createOAuthCsrfToken,
  OAUTH_CSRF_COOKIE,
  validateAndConsumeOAuthCsrf,
} from "@/mcp/auth/oauth-csrf";

describe("MCP OAuth CSRF nonce", () => {
  it("validates and consumes a nonce once", () => {
    const token = createOAuthCsrfToken();
    const request = new Request("http://localhost/api/oauth/authorize", {
      headers: {
        cookie: `${OAUTH_CSRF_COOKIE}=${encodeURIComponent(token)}`,
      },
    });

    expect(validateAndConsumeOAuthCsrf(request, token)).toBe(true);
    expect(validateAndConsumeOAuthCsrf(request, token)).toBe(false);
  });

  it("rejects missing or mismatched nonce values", () => {
    const token = createOAuthCsrfToken();
    const request = new Request("http://localhost/api/oauth/authorize", {
      headers: {
        cookie: `${OAUTH_CSRF_COOKIE}=${encodeURIComponent(token)}`,
      },
    });

    expect(validateAndConsumeOAuthCsrf(request, "wrong-token")).toBe(false);
    expect(validateAndConsumeOAuthCsrf(request, null)).toBe(false);
  });
});
