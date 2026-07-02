import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitHeaders } from "@/mcp/middleware/rate-limiter";

describe("MCP rate limiter", () => {
  it("tracks remaining free-tier requests per identifier", () => {
    const identifier = `unit-rate-${Date.now()}-${Math.random()}`;
    const first = checkRateLimit(identifier, "free");

    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(30);
    expect(first.remaining).toBe(29);
  });

  it("blocks after the configured free-tier window budget", () => {
    const identifier = `unit-rate-limit-${Date.now()}-${Math.random()}`;
    let result;
    for (let i = 0; i < 31; i += 1) {
      result = checkRateLimit(identifier, "free");
    }

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("emits standard rate-limit headers", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      limit: 30,
      remaining: 12,
      resetMs: 1500,
    });

    expect(headers).toEqual({
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": "12",
      "X-RateLimit-Reset": "2",
    });
  });
});
