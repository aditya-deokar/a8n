import { describe, expect, it } from "vitest";
import {
  redactLogString,
  redactLogValue,
  safeHeaders,
  safeUrl,
} from "@/lib/logging/redaction";

describe("logging redaction", () => {
  it("redacts nested sensitive fields and known secret patterns", () => {
    const output = redactLogValue({
      authorization: "Bearer abcdefghijklmno",
      nested: {
        databaseUrl: "postgresql://user:password@localhost:5432/app",
        apiKey: "sk-live-abcdefghijk",
      },
      safe: "visible",
    });

    const serialized = JSON.stringify(output);

    expect(serialized).toContain("visible");
    expect(serialized).not.toContain("abcdefghijk");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("sk-live");
  });

  it("redacts credentials from URLs, headers, and loose strings", () => {
    expect(
      safeUrl("https://example.com/callback?code=a8n_oauth_code_secret&state=ok"),
    ).toContain("code=%5BREDACTED%5D");

    expect(
      safeHeaders({
        authorization: "Bearer abcdefghijklmno",
        "x-safe-header": "safe",
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      "x-safe-header": "safe",
    });

    expect(redactLogString("DATABASE_URL=postgresql://user:password@db/app")).toBe(
      "DATABASE_URL=[REDACTED]",
    );
  });
});
