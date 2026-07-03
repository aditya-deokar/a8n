import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluateMcpAlertRules,
  getMcpDashboardSpecs,
  getMcpObservabilitySnapshot,
  getMcpRuntimeFeatureFlags,
  recordMcpRuntimeEvent,
  resetMcpObservabilityForTests,
} from "@/mcp/observability/runtime-guardrails";

describe("MCP observability runtime guardrails", () => {
  beforeEach(() => {
    resetMcpObservabilityForTests();
  });

  it("records tool call metrics by tool, risk, and profile", () => {
    recordMcpRuntimeEvent({
      type: "tool_call",
      tool: "list_workflows",
      risk: "read_only",
      profile: "chatgpt",
      status: "success",
      durationMs: 20,
    });

    const snapshot = getMcpObservabilitySnapshot();

    expect(snapshot.metrics.toolCallCount).toBe(1);
    expect(snapshot.metrics.toolCounts.list_workflows).toBe(1);
    expect(snapshot.metrics.riskCounts.read_only).toBe(1);
    expect(snapshot.metrics.profileCounts.chatgpt).toBe(1);
  });

  it("evaluates prompt-injection alert rules", () => {
    for (let index = 0; index < 5; index++) {
      recordMcpRuntimeEvent({
        type: "prompt_injection_warning",
        status: "warning",
        error: "ignore-instructions",
      });
    }

    const alert = evaluateMcpAlertRules().find(
      (item) => item.id === "mcp-prompt-injection-spike",
    );

    expect(alert).toMatchObject({
      id: "mcp-prompt-injection-spike",
      triggered: true,
    });
  });

  it("exposes dashboard specs and runtime feature flags", () => {
    const dashboards = getMcpDashboardSpecs();
    const flags = getMcpRuntimeFeatureFlags();

    expect(dashboards.map((dashboard) => dashboard.id)).toEqual(
      expect.arrayContaining(["mcp-health", "mcp-safety", "mcp-evals"]),
    );
    expect(flags).toEqual(
      expect.objectContaining({
        disableSideEffectTools: expect.any(Boolean),
        disableCredentialMutation: expect.any(Boolean),
        forceReadOnlyChatGptProfile: expect.any(Boolean),
      }),
    );
  });
});
