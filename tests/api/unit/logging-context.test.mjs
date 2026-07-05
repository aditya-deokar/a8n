import { describe, expect, it } from "vitest";
import {
  buildRequestLogContext,
  getLogContext,
  runWithLogContext,
  traceContextFromHeaders,
} from "@/lib/logging/context";

describe("logging context", () => {
  it("propagates request context through async local storage", async () => {
    await runWithLogContext(
      {
        component: "api",
        requestId: "req_test_123",
        route: "/api/test",
      },
      async () => {
        await Promise.resolve();

        expect(getLogContext()).toMatchObject({
          component: "api",
          correlationId: "req_test_123",
          requestId: "req_test_123",
          route: "/api/test",
        });
      },
    );
  });

  it("builds request context from request and trace headers", () => {
    const traceId = "11111111111111111111111111111111";
    const spanId = "2222222222222222";
    const request = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        traceparent: `00-${traceId}-${spanId}-01`,
        "x-request-id": "req_from_header",
      },
    });

    expect(buildRequestLogContext(request, { component: "webhook" })).toMatchObject({
      component: "webhook",
      correlationId: "req_from_header",
      method: "POST",
      requestId: "req_from_header",
      spanId,
      traceId,
    });
  });

  it("ignores malformed traceparent headers", () => {
    const headers = new Headers({ traceparent: "malformed" });

    expect(traceContextFromHeaders(headers)).toEqual({});
  });
});
