import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { NodeType } from "@/generated/prisma";

type VerificationResult = {
  ok: boolean;
  enforced: boolean;
  mode: string;
  error?: string;
};

/**
 * Loads workflow-level webhook secrets configured on the trigger node(s).
 * They are stored encrypted in node data and act as an alternative to the
 * platform-wide environment secrets.
 */
export async function getWorkflowTriggerSecrets(
  workflowId: string,
  nodeType: NodeType,
): Promise<string[]> {
  try {
    const nodes = await prisma.node.findMany({
      where: { workflowId, type: nodeType },
      select: { data: true },
    });

    const secrets: string[] = [];
    for (const node of nodes) {
      const data = node.data as Record<string, unknown> | null;
      const encrypted = data?.webhookSecret;
      if (typeof encrypted !== "string" || encrypted.length === 0) continue;
      try {
        secrets.push(decrypt(encrypted));
      } catch {
        // Skip undecryptable entries rather than failing the request.
      }
    }
    return secrets;
  } catch {
    return [];
  }
}

/**
 * Checks whether the target workflow is active. Inactive workflows reject
 * webhook dispatches so users can pause automations without deleting them.
 */
export async function assertWorkflowActive(
  workflowId: string,
): Promise<{ ok: boolean }> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { active: true },
  });

  if (!workflow) return { ok: false };
  if (!workflow.active) return { ok: false };
  return { ok: true };
}

// ─── Lightweight in-memory rate limiting ─────────────────────────────────────
// Note: per-instance only (serverless-safe fallback). It bounds abuse per
// instance without external infrastructure.

const rateLimitBuckets = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);

  if (rateLimitBuckets.size > 10_000) {
    // Opportunistic cleanup to bound memory.
    for (const [bucketKey, bucketTimestamps] of rateLimitBuckets) {
      if (
        bucketTimestamps.every(
          (timestamp) => now - timestamp >= RATE_LIMIT_WINDOW_MS,
        )
      ) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
  }

  return false;
}

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
  extraSecrets: string[] = [],
): VerificationResult {
  const configured = firstConfiguredEnv(envNames);
  if (!configured && extraSecrets.length === 0) {
    return { ok: true, enforced: false, mode: "unsigned-dev" };
  }

  // Secrets are accepted via header only — query parameters leak into access
  // logs and browser history.
  const supplied = request.headers.get("x-a8n-webhook-secret") || "";

  if (!supplied) {
    return {
      ok: false,
      enforced: true,
      mode: configured?.name ?? "workflow-secret",
      error: "Missing webhook secret.",
    };
  }

  if (configured && safeEqual(supplied, configured.value)) {
    return { ok: true, enforced: true, mode: configured.name };
  }

  for (const extra of extraSecrets) {
    if (safeEqual(supplied, extra)) {
      return { ok: true, enforced: true, mode: "workflow-secret" };
    }
  }

  return {
    ok: false,
    enforced: true,
    mode: configured?.name ?? "workflow-secret",
    error: "Invalid webhook secret.",
  };
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
