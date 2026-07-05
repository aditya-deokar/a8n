import { describe, expect, it } from "vitest";
import {
  aiTelemetryOptions,
  logger,
  observeExternalProvider,
  safeProviderHost,
} from "@/lib/logging";

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

describe("external provider logging", () => {
  it("logs provider completion without request or response bodies", async () => {
    const capture = captureLogs();

    try {
      await expect(
        observeExternalProvider(
          {
            provider: "http",
            operation: "request",
            nodeId: "node_1",
            nodeType: "HTTP_REQUEST",
            method: "POST",
            host: safeProviderHost("https://user:pass@example.com/path?token=secret"),
            statusCode: (result) => result.status,
          },
          async () => ({
            status: 204,
            body: "should-not-be-logged",
          }),
        ),
      ).resolves.toEqual({ status: 204, body: "should-not-be-logged" });

      const serialized = JSON.stringify(capture.events);

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "info",
          fields: expect.objectContaining({
            component: "workflow",
            event: "external_provider_request_completed",
            provider: "http",
            operation: "request",
            nodeId: "node_1",
            statusCode: 204,
          }),
        }),
      );
      expect(serialized).toContain("example.com");
      expect(serialized).not.toContain("should-not-be-logged");
      expect(serialized).not.toContain("secret");
      expect(serialized).not.toContain("pass");
    } finally {
      capture.restore();
    }
  });

  it("logs provider failures with redacted error messages", async () => {
    const capture = captureLogs();

    try {
      await expect(
        observeExternalProvider(
          {
            provider: "openai",
            operation: "generate_text",
            nodeId: "node_2",
            nodeType: "OPENAI",
          },
          async () => {
            throw new Error("provider rejected Bearer abcdefghijklmno");
          },
        ),
      ).rejects.toThrow("provider rejected");

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "error",
          fields: expect.objectContaining({
            component: "workflow",
            event: "external_provider_request_failed",
            provider: "openai",
            error: expect.objectContaining({
              message: "provider rejected Bearer [REDACTED]",
            }),
          }),
        }),
      );
    } finally {
      capture.restore();
    }
  });

  it("disables AI input and output telemetry unless payload logging is explicit", () => {
    const previous = process.env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED;
    process.env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED = "false";

    try {
      expect(aiTelemetryOptions()).toMatchObject({
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED;
      } else {
        process.env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED = previous;
      }
    }
  });
});
