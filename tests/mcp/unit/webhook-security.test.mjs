import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifySharedWebhookSecret,
  verifyStripeSignature,
} from "@/app/api/webhooks/_security";

function restoreEnv(name, previous) {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("Webhook security helpers", () => {
  it("allows unsigned dev mode when no shared secret is configured", () => {
    const previous = process.env.UNIT_WEBHOOK_SECRET;
    delete process.env.UNIT_WEBHOOK_SECRET;
    const request = new Request("http://localhost/api/webhooks/google-form");

    const result = verifySharedWebhookSecret(request, new URL(request.url), [
      "UNIT_WEBHOOK_SECRET",
    ]);

    restoreEnv("UNIT_WEBHOOK_SECRET", previous);
    expect(result).toEqual({ ok: true, enforced: false, mode: "unsigned-dev" });
  });

  it("requires the configured shared secret", () => {
    const previous = process.env.UNIT_WEBHOOK_SECRET;
    process.env.UNIT_WEBHOOK_SECRET = "shared-secret";
    const request = new Request("http://localhost/api/webhooks/google-form", {
      headers: { "x-a8n-webhook-secret": "shared-secret" },
    });

    const result = verifySharedWebhookSecret(request, new URL(request.url), [
      "UNIT_WEBHOOK_SECRET",
    ]);

    restoreEnv("UNIT_WEBHOOK_SECRET", previous);
    expect(result).toMatchObject({ ok: true, enforced: true, mode: "UNIT_WEBHOOK_SECRET" });
  });

  it("rejects invalid shared secrets", () => {
    const previous = process.env.UNIT_WEBHOOK_SECRET;
    process.env.UNIT_WEBHOOK_SECRET = "shared-secret";
    const request = new Request("http://localhost/api/webhooks/google-form", {
      headers: { "x-a8n-webhook-secret": "wrong" },
    });

    const result = verifySharedWebhookSecret(request, new URL(request.url), [
      "UNIT_WEBHOOK_SECRET",
    ]);

    restoreEnv("UNIT_WEBHOOK_SECRET", previous);
    expect(result).toMatchObject({ ok: false, enforced: true });
  });

  it("validates Stripe signatures with timestamp tolerance", () => {
    const body = JSON.stringify({ id: "evt_test" });
    const secret = "stripe-secret";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const result = verifyStripeSignature(
      body,
      `t=${timestamp},v1=${signature}`,
      secret,
    );

    expect(result).toMatchObject({ ok: true, enforced: true });
  });
});
