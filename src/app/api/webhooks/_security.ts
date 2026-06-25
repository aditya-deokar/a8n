import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

type VerificationResult = {
  ok: boolean;
  enforced: boolean;
  mode: string;
  error?: string;
};

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function firstConfiguredEnv(names: string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = process.env[name];
    if (value) return { name, value };
  }
  return null;
}

export function verifySharedWebhookSecret(
  request: NextRequest,
  url: URL,
  envNames: string[],
): VerificationResult {
  const configured = firstConfiguredEnv(envNames);
  if (!configured) {
    return { ok: true, enforced: false, mode: "unsigned-dev" };
  }

  const supplied =
    request.headers.get("x-a8n-webhook-secret") ||
    url.searchParams.get("secret") ||
    "";

  if (!supplied || !safeEqual(supplied, configured.value)) {
    return {
      ok: false,
      enforced: true,
      mode: configured.name,
      error: "Invalid webhook secret.",
    };
  }

  return { ok: true, enforced: true, mode: configured.name };
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 300,
): VerificationResult {
  if (!secret) return { ok: true, enforced: false, mode: "unsigned-dev" };
  if (!signatureHeader) {
    return {
      ok: false,
      enforced: true,
      mode: "stripe-signature",
      error: "Missing Stripe signature.",
    };
  }

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (!key || !value) return acc;
      acc[key] = [...(acc[key] || []), value];
      return acc;
    },
    {},
  );
  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 || [];

  if (!timestamp || signatures.length === 0) {
    return {
      ok: false,
      enforced: true,
      mode: "stripe-signature",
      error: "Malformed Stripe signature.",
    };
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) {
    return {
      ok: false,
      enforced: true,
      mode: "stripe-signature",
      error: "Stripe signature is outside the allowed tolerance.",
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const matched = signatures.some((signature) => safeEqual(signature, expected));

  return matched
    ? { ok: true, enforced: true, mode: "stripe-signature" }
    : {
        ok: false,
        enforced: true,
        mode: "stripe-signature",
        error: "Invalid Stripe signature.",
      };
}

export function webhookAuthError(result: VerificationResult) {
  return NextResponse.json(
    {
      success: false,
      error: result.error || "Webhook verification failed.",
      mode: result.mode,
    },
    { status: 401 },
  );
}
