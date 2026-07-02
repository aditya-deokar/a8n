import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MCP_TOOL_CONTRACTS } from "@/mcp/contracts/tools.manifest";

function source(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const HIGH_RISK_TOOLS = MCP_TOOL_CONTRACTS.filter(
  (tool) => tool.externalSideEffect || tool.destructive || tool.risk === "approval_gated_write",
);

describe("MCP high-risk tool source guards", () => {
  it("requires high-risk contracts to declare approval", () => {
    expect(HIGH_RISK_TOOLS.map((tool) => [tool.name, tool.requiresApproval])).toEqual(
      HIGH_RISK_TOOLS.map((tool) => [tool.name, true]),
    );
  });

  it.each(HIGH_RISK_TOOLS)(
    "$name handler source depends on the central approval guard",
    (tool) => {
      const text = source(tool.source);
      const toolIndex = text.indexOf(`"${tool.name}"`);
      const singleQuoteIndex = text.indexOf(`'${tool.name}'`);
      const start = toolIndex >= 0 ? toolIndex : singleQuoteIndex;

      expect(start).toBeGreaterThanOrEqual(0);
      expect(text).toContain("requireToolApproval");
    },
  );
});
