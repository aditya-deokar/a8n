import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPolarWebhook } from "@/lib/entitlements/sync";

const SECRET = "whsec_" + Buffer.from("test-webhook-secret-bytes").toString("base64");

function sign(secret, id, timestamp, body) {
  return createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

function buildHeaders({ id, timestamp, signatures }) {
  const headers = new Headers();
  headers.set("webhook-id", id);
  headers.set("webhook-timestamp", String(timestamp));
  headers.set("webhook-signature", signatures);
  return headers;
}

describe("polar webhook verification", () => {
  const secretBytes = Buffer.from("test-webhook-secret-bytes");
  const body = JSON.stringify({ type: "subscription.updated", data: {} });
  const id = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const validSignature = `v1,${sign(secretBytes, id, nowSeconds, body)}`;

  it("accepts a correctly signed delivery", () => {
    const result = verifyPolarWebhook(
      body,
      buildHeaders({ id, timestamp: nowSeconds, signatures: validSignature }),
      { secret: SECRET },
    );
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe(id);
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a tampered payload", () => {
    const tampered = body.replace("updated", "created");
    const result = verifyPolarWebhook(
      tampered,
      buildHeaders({ id, timestamp: nowSeconds, signatures: validSignature }),
      { secret: SECRET },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects a wrong signing secret", () => {
    const other = `v1,${sign(Buffer.from("other-secret"), id, nowSeconds, body)}`;
    const result = verifyPolarWebhook(
      body,
      buildHeaders({ id, timestamp: nowSeconds, signatures: other }),
      { secret: SECRET },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects deliveries older than the replay tolerance", () => {
    const staleTimestamp = nowSeconds - 3600;
    const staleSignature = `v1,${sign(secretBytes, id, staleTimestamp, body)}`;
    const result = verifyPolarWebhook(
      body,
      buildHeaders({
        id,
        timestamp: staleTimestamp,
        signatures: staleSignature,
      }),
      { secret: SECRET },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timestamp_out_of_tolerance");
  });

  it("accepts any of multiple space-separated signatures", () => {
    const multi = `v1,AAAA ${validSignature}`;
    const result = verifyPolarWebhook(
      body,
      buildHeaders({ id, timestamp: nowSeconds, signatures: multi }),
      { secret: SECRET },
    );
    expect(result.ok).toBe(true);
  });

  it("fails closed when required headers are missing", () => {
    const missing = new Headers();
    missing.set("webhook-id", id);
    missing.set("webhook-timestamp", String(nowSeconds));
    const result = verifyPolarWebhook(body, missing, { secret: SECRET });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_headers");
  });

  it("fails closed without a configured secret", () => {
    const result = verifyPolarWebhook(
      body,
      buildHeaders({ id, timestamp: nowSeconds, signatures: validSignature }),
      { secret: "" },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_secret");
  });

  it("supports raw (unprefixed utf8) secrets", () => {
    const rawSecret = "raw-secret-string";
    const signature = `v1,${sign(Buffer.from(rawSecret, "utf8"), id, nowSeconds, body)}`;
    const result = verifyPolarWebhook(
      body,
      buildHeaders({ id, timestamp: nowSeconds, signatures: signature }),
      { secret: rawSecret },
    );
    expect(result.ok).toBe(true);
  });
});
