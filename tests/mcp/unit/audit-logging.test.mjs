import { describe, expect, it } from "vitest";
import { logger } from "@/lib/logging";
import { MCP_CONFIG } from "@/mcp/config";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { resetMcpObservabilityForTests } from "@/mcp/observability/runtime-guardrails";

function captureLogs() {
  const events = [];
  const original = {
    info: logger.info,
    error: logger.error,
  };

  logger.info = (fields, message) => {
    events.push({ level: "info", fields, message });
  };
  logger.error = (fields, message) => {
    events.push({ level: "error", fields, message });
  };

  return {
    events,
    restore() {
      Object.assign(logger, original);
    },
  };
}

describe("MCP audit logging", () => {
  it("emits successful audit logs through the shared logger with redacted input", () => {
    resetMcpObservabilityForTests();
    const previous = MCP_CONFIG.AUDIT_LOG_ENABLED;
    MCP_CONFIG.AUDIT_LOG_ENABLED = true;
    const capture = captureLogs();

    try {
      const audit = createAuditContext({
        userId: "user_1",
        authMethod: "api_key",
        tool: "create_credential",
        input: {
          name: "OpenAI",
          value: "sk-live-abcdefghijkl",
          nested: {
            authorization: "Bearer abcdefghijklmno",
          },
        },
      });

      audit.success();

      const serialized = JSON.stringify(capture.events);

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "info",
          fields: expect.objectContaining({
            component: "mcp",
            event: "mcp_tool_completed",
            tool: "create_credential",
            status: "success",
          }),
        }),
      );
      expect(serialized).toContain("OpenAI");
      expect(serialized).not.toContain("sk-live");
      expect(serialized).not.toContain("abcdefghijkl");
      expect(serialized).not.toContain("Bearer abcdef");
    } finally {
      capture.restore();
      MCP_CONFIG.AUDIT_LOG_ENABLED = previous;
    }
  });
});
