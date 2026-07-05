import { afterEach, describe, expect, it } from "vitest";
import { logger } from "@/lib/logging";
import { POST } from "@/app/api/logs/client/route";

function captureLogs() {
  const events = [];
  const original = {
    info: logger.info,
    warn: logger.warn,
    error: logger.error,
  };

  logger.info = (fields, message) => {
    events.push({ level: "info", fields, message });
  };
  logger.warn = (fields, message) => {
    events.push({ level: "warn", fields, message });
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

const originalClientLogging = process.env.OBSERVABILITY_CLIENT_LOG_ENABLED;

afterEach(() => {
  if (originalClientLogging === undefined) {
    delete process.env.OBSERVABILITY_CLIENT_LOG_ENABLED;
  } else {
    process.env.OBSERVABILITY_CLIENT_LOG_ENABLED = originalClientLogging;
  }
});

describe("client log route", () => {
  it("accepts safe client error reports and redacts secrets", async () => {
    process.env.OBSERVABILITY_CLIENT_LOG_ENABLED = "true";
    const capture = captureLogs();

    try {
      const response = await POST(
        new Request("https://example.com/api/logs/client", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.10",
            "x-request-id": "req_client_test",
          },
          body: JSON.stringify({
            errorName: "TypeError",
            message: "Failed with Bearer abcdefghijklmno",
            digest: "digest_123",
            path: "/workflows?token=a8n_oauth_code_secret",
            source: "global_error_boundary",
            userAgent: "UnitTest/1.0",
          }),
        }),
      );

      expect(response.status).toBe(202);

      const event = capture.events.find(
        (item) => item.fields?.event === "client_error_reported",
      );
      const serialized = JSON.stringify(event);

      expect(event).toMatchObject({
        level: "warn",
        fields: expect.objectContaining({
          component: "client",
          digest: "digest_123",
          errorName: "TypeError",
          requestId: "req_client_test",
          source: "global_error_boundary",
        }),
      });
      expect(serialized).toContain("Bearer [REDACTED]");
      expect(serialized).not.toContain("abcdefghijklmno");
      expect(serialized).not.toContain("a8n_oauth_code_secret");
    } finally {
      capture.restore();
    }
  });

  it("can be disabled without logging the client payload", async () => {
    process.env.OBSERVABILITY_CLIENT_LOG_ENABLED = "false";
    const capture = captureLogs();

    try {
      const response = await POST(
        new Request("https://example.com/api/logs/client", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.11",
          },
          body: JSON.stringify({
            errorName: "TypeError",
            message: "should-not-log",
          }),
        }),
      );

      expect(response.status).toBe(204);
      expect(
        capture.events.some((item) => item.fields?.event === "client_error_reported"),
      ).toBe(false);
    } finally {
      capture.restore();
    }
  });
});
