import { describe, expect, it } from "vitest";
import { mcpJsonResponse, sanitizeOutput } from "@/mcp/shared/sanitize";
import { maliciousExecutionOutput } from "../fixtures/factories.mjs";

describe("MCP output sanitization", () => {
  it("redacts sensitive keys and secret-looking strings recursively", () => {
    const sanitized = sanitizeOutput(maliciousExecutionOutput());
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("should-not-leak");
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).toContain("[REDACTED");
  });

  it("adds safety metadata when sanitized output contains tool coercion", () => {
    const response = mcpJsonResponse(maliciousExecutionOutput());

    expect(response._meta?.safety).toMatchObject({
      untrustedContentDetected: true,
    });
  });
});
