import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/mcp";
import { getToolContract } from "@/mcp/contracts/tools.manifest";
import { CHATGPT_WIDGET_URIS } from "@/mcp/apps/widget-resources";
import { shouldRecordLastUsed } from "@/mcp/auth/last-used";

type RegisteredTool = {
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

function internals(server: ReturnType<typeof createMcpServer>) {
  return server as unknown as {
    _registeredTools: Record<string, RegisteredTool>;
    _registeredResources: Record<string, { name?: string }>;
  };
}

describe("MCP server capabilities", () => {
  it("declares the logging capability so logging/setLevel is handled", () => {
    // McpServer infers tools/resources/prompts, but the SDK only registers the
    // logging/setLevel handler when `logging` is declared explicitly.
    const server = createMcpServer(undefined, { appProfile: "default" });
    const raw = server.server as unknown as {
      getCapabilities?: () => Record<string, unknown>;
      _capabilities?: Record<string, unknown>;
    };

    const capabilities = raw.getCapabilities?.() ?? raw._capabilities ?? {};
    expect(capabilities.logging).toBeDefined();
    expect(capabilities.tools).toBeDefined();
    expect(capabilities.resources).toBeDefined();
    expect(capabilities.prompts).toBeDefined();
  });

  it("does not re-register widget resources on the client-initialized hook", () => {
    // The hook used to call registerChatGptWidgetResources a second time,
    // which throws "already registered" inside a notification handler where
    // the error is swallowed.
    const server = createMcpServer(undefined, { appProfile: "default" });
    const raw = server.server as unknown as { oninitialized?: () => void };

    expect(() => raw.oninitialized?.()).not.toThrow();
  });

  it("registers every widget resource the render tools point at", () => {
    const server = createMcpServer(undefined, { appProfile: "default" });
    const uris = Object.keys(internals(server)._registeredResources);

    for (const uri of Object.values(CHATGPT_WIDGET_URIS)) {
      expect(uris).toContain(uri);
    }
  });
});

describe("tool annotations", () => {
  it("gives every tool the behavior hints its contract declares", () => {
    // Clients use readOnlyHint/destructiveHint to decide what to auto-approve.
    // Most tools register through an SDK overload with no annotations slot, so
    // the contract's hints are applied after registration.
    const server = createMcpServer(undefined, { appProfile: "default" });
    const tools = internals(server)._registeredTools;

    const withoutAnnotations = Object.entries(tools)
      .filter(([, tool]) => !tool.annotations)
      .map(([name]) => name);

    expect(withoutAnnotations).toEqual([]);
  });

  it("marks read-only tools as read-only and destructive tools as destructive", () => {
    const server = createMcpServer(undefined, { appProfile: "default" });
    const tools = internals(server)._registeredTools;

    expect(tools.list_workflows?.annotations?.readOnlyHint).toBe(true);
    expect(tools.delete_workflow?.annotations?.destructiveHint).toBe(true);
    expect(tools.delete_workflow?.annotations?.readOnlyHint).toBe(false);
  });

  it("keeps annotations consistent with the contract manifest", () => {
    const server = createMcpServer(undefined, { appProfile: "default" });
    const tools = internals(server)._registeredTools;

    for (const [name, tool] of Object.entries(tools)) {
      const contract = getToolContract(name);
      if (!contract || typeof contract.annotations.readOnlyHint !== "boolean") continue;
      expect(tool.annotations?.readOnlyHint).toBe(contract.annotations.readOnlyHint);
    }
  });
});

describe("last-used write throttle", () => {
  it("records the first use", () => {
    expect(shouldRecordLastUsed(null)).toBe(true);
    expect(shouldRecordLastUsed(undefined)).toBe(true);
  });

  it("skips a write when the stored timestamp is recent", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const fiveSecondsAgo = new Date(now.getTime() - 5_000);
    expect(shouldRecordLastUsed(fiveSecondsAgo, now)).toBe(false);
  });

  it("records again once the interval has passed", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const twoMinutesAgo = new Date(now.getTime() - 120_000);
    expect(shouldRecordLastUsed(twoMinutesAgo, now)).toBe(true);
  });
});
