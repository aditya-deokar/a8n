import { describe, expect, it } from "vitest";
import {
  CHATGPT_TOOL_CONTRACTS,
  FORBIDDEN_CHATGPT_TOOL_CONTRACTS,
  MCP_TOOL_CONTRACTS,
} from "@/mcp/contracts/tools.manifest";
import { isContractOutputSchemaName } from "@/mcp/contracts/schemas";
import {
  CHATGPT_APP_TOOL_COUNT,
  CHATGPT_APP_TOOL_POLICY,
  CHATGPT_FORBIDDEN_TOOLS,
} from "@/mcp/safety/app-tool-policy";

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

describe("MCP tool contract manifest", () => {
  it("has unique tool names and known output schemas", () => {
    expect(duplicates(MCP_TOOL_CONTRACTS.map((tool) => tool.name))).toEqual([]);
    expect(MCP_TOOL_CONTRACTS.every((tool) => isContractOutputSchemaName(tool.outputSchema))).toBe(true);
  });

  it("drives the ChatGPT policy", () => {
    expect(CHATGPT_APP_TOOL_COUNT).toBe(CHATGPT_TOOL_CONTRACTS.length);
    expect(Object.keys(CHATGPT_APP_TOOL_POLICY).sort()).toEqual(
      CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name).sort(),
    );
  });

  it("keeps forbidden tools out of the ChatGPT profile", () => {
    const chatgptNames = new Set(CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name));

    expect(FORBIDDEN_CHATGPT_TOOL_CONTRACTS.every((tool) => !chatgptNames.has(tool.name))).toBe(true);
    expect([...CHATGPT_FORBIDDEN_TOOLS].sort()).toEqual(
      FORBIDDEN_CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name).sort(),
    );
  });

  it("marks approval-gated writes as approval-required", () => {
    expect(
      MCP_TOOL_CONTRACTS
        .filter((tool) => tool.risk === "approval_gated_write")
        .every((tool) => tool.requiresApproval),
    ).toBe(true);
  });
});
