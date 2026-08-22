import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { resetPrismaMock, prismaMock } from "../helpers/mock-prisma.mjs";

const SECRET_RAW = process.env.POLAR_WEBHOOK_SECRET;
const SECRET_BYTES = Buffer.from(SECRET_RAW.replace(/^whsec_/, ""), "base64");

function signDelivery(id, timestamp, body) {
  return createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

function buildRequest(body, { id = "evt_1", timestamp, signatures } = {}) {
  const ts = String(timestamp ?? Math.floor(Date.now() / 1000));
  const headers = new Headers({
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature":
      signatures ?? `v1,${signDelivery(id, ts, body)}`,
  });
  return new Request("http://127.0.0.1/api/webhooks/polar", {
    method: "POST",
    headers,
    body,
  });
}

function eventBody(overrides = {}) {
  const payload = {
    type: "subscription.updated",
    timestamp: new Date().toISOString(),
    data: {
      id: "sub_123",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      modifiedAt: new Date().toISOString(),
      product: { id: process.env.POLAR_PRO_PRODUCT_ID },
      customer: { externalId: "user_external_1" },
      ...overrides,
    },
  };
  return JSON.stringify(payload);
}

async function loadRoute() {
  vi.resetModules();
  vi.doMock("@/lib/db", () => ({ default: prismaMock }));
  return import("@/app/api/webhooks/polar/route");
}

describe("polar webhook route", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("applies a valid signed subscription event to the local mirror", async () => {
    const { POST } = await loadRoute();

    const response = await POST(buildRequest(eventBody()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ received: true, applied: true });
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_external_1" },
        update: expect.objectContaining({
          status: "active",
          polarProductId: process.env.POLAR_PRO_PRODUCT_ID,
          lastSyncedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("deduplicates replays by webhook id", async () => {
    const { POST } = await loadRoute();
    prismaMock.processedWebhookEvent.create.mockRejectedValueOnce(
      new Error("Unique constraint violated"),
    );

    const response = await POST(
      buildRequest(eventBody(), { id: "evt_dup" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      deduped: true,
    });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("rejects unsigned deliveries with 401", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      buildRequest(eventBody(), { signatures: "v1,bm90LXRoZS1zaWduYXR1cmU=" }),
    );

    expect(response.status).toBe(401);
    expect(prismaMock.processedWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("ignores non-subscription events after recording them once", async () => {
    const { POST } = await loadRoute();

    const body = JSON.stringify({ type: "order.paid", data: {} });
    const response = await POST(buildRequest(body));

    await expect(response.json()).resolves.toMatchObject({
      received: true,
      ignored: true,
    });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("reports unlinked customers without failing the delivery", async () => {
    const { POST } = await loadRoute();

    const body = eventBody({
      customer: { externalId: null },
    });
    const response = await POST(buildRequest(body));
    const json = await response.json();

    expect(json).toMatchObject({
      received: true,
      applied: false,
      reason: "unlinked_customer",
    });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("skips stale out-of-order events against a newer synced row", async () => {
    const { POST } = await loadRoute();
    prismaMock.subscription.findUnique.mockResolvedValue({
      lastSyncedAt: new Date(Date.now() + 3600_000),
    });

    const response = await POST(buildRequest(eventBody()));
    const json = await response.json();

    expect(json).toMatchObject({ received: true, applied: false, reason: "stale_event" });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("releases the dedup slot when application crashes so retries can reapply", async () => {
    const { POST } = await loadRoute();
    prismaMock.subscription.findUnique.mockRejectedValue(
      new Error("db unavailable"),
    );

    const response = await POST(buildRequest(eventBody()));

    expect(response.status).toBe(500);
    expect(prismaMock.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: "evt_1" },
    });
  });
});
