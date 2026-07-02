import { describe, expect, it } from "vitest";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { hasScope } from "@/mcp/auth/scopes";
import { mcpAuth } from "../fixtures/factories.mjs";

describe("MCP scope guard", () => {
  it("allows a granted scope", () => {
    expect(() => requireScope(mcpAuth(), "workflows:read")).not.toThrow();
  });

  it("allows wildcard scope", () => {
    expect(hasScope(["*"], "api_keys:manage")).toBe(true);
    expect(() => requireScope(mcpAuth({ scopes: ["*"] }), "api_keys:manage")).not.toThrow();
  });

  it("rejects missing scope with an actionable error", () => {
    expect(() => requireScope(mcpAuth(), "workflows:write")).toThrow(
      /requires the "workflows:write" scope/,
    );
  });
});
