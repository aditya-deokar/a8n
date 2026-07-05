import { describe, expect, it } from "vitest";
import { getLogContext } from "@/lib/logging/context";
import { withRequestLogging } from "@/lib/logging/http";

describe("request logging wrapper", () => {
  it("adds the request id header and preserves handler behavior", async () => {
    const handler = withRequestLogging(
      async () => new Response("ok", { status: 201 }),
      {
        component: "api",
        route: "/api/test",
        eventPrefix: "test_request",
      },
    );

    const response = await handler(
      new Request("https://example.com/api/test?token=secret", {
        method: "POST",
        headers: { "x-request-id": "req_test_http" },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("req_test_http");
    await expect(response.text()).resolves.toBe("ok");
  });

  it("makes request context available to wrapped handlers", async () => {
    const handler = withRequestLogging(
      async () => {
        expect(getLogContext()).toMatchObject({
          component: "webhook",
          requestId: "req_context_http",
          route: "/api/webhooks/test",
        });

        return Response.json({ ok: true });
      },
      {
        component: "webhook",
        route: "/api/webhooks/test",
      },
    );

    const response = await handler(
      new Request("https://example.com/api/webhooks/test", {
        headers: { "x-request-id": "req_context_http" },
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
