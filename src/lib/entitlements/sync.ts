import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db";
import { env } from "@/env";
import { isE2EMode } from "@/lib/e2e-safety";
import { logger } from "@/lib/logging";
import type { PlanId } from "@/config/plans";

export interface NormalizedSubscriptionState {
  externalUserId: string | null;
  polarCustomerId: string | null;
  polarProductId: string | null;
  status: string;
  planId: PlanId;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface ApplyResult {
  applied: boolean;
  userId?: string;
  reason?: string;
}

function mockedExternalServices() {
  return isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";
}

/** Maps a Polar product to an a8n plan. Unknown products never grant Pro. */
export function mapProductToPlan(productId?: string | null): PlanId {
  const proProductId = env.POLAR_PRO_PRODUCT_ID;
  if (!proProductId) return "free";
  if (mockedExternalServices()) {
    // E2E convention mirrors src/trpc/init.ts: "pro" anywhere ⇒ active pro.
    return productId === "pro" ? "pro" : "free";
  }
  return productId === proProductId ? "pro" : "free";
}

interface PolarSubscriptionLike {
  status?: string | null;
  currentPeriodEnd?: string | Date | null;
  cancelAtPeriodEnd?: boolean | null;
  productId?: string | null;
  product?: { id?: string | null } | null;
  customer?: { externalId?: string | null; id?: string | null } | null;
  customerId?: string | null;
  modifiedAt?: string | Date | null;
}

export function normalizeSubscriptionPayload(
  subscription: PolarSubscriptionLike,
): NormalizedSubscriptionState {
  const productId = subscription.productId ?? subscription.product?.id ?? null;
  const rawPeriodEnd = subscription.currentPeriodEnd;
  const periodEnd =
    typeof rawPeriodEnd === "string" ? new Date(rawPeriodEnd) : rawPeriodEnd ?? null;

  const validPeriodEnd =
    periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null;

  const externalUserId =
    subscription.customer?.externalId != null
      ? String(subscription.customer.externalId)
      : null;

  return {
    externalUserId,
    polarCustomerId:
      subscription.customer?.id ?? subscription.customerId ?? null,
    polarProductId: productId ?? null,
    status: subscription.status ?? "inactive",
    planId: mapProductToPlan(productId),
    currentPeriodEnd: validPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
  };
}

/** Adapts the `customers.getStateExternal` payload to the shared normalizer. */
export function normalizeCustomerState(state: unknown): NormalizedSubscriptionState {
  const customerState = state as {
    activeSubscriptions?: PolarSubscriptionLike[];
  } | null;

  const primary =
    customerState?.activeSubscriptions && customerState.activeSubscriptions.length > 0
      ? customerState.activeSubscriptions[0]
      : {};

  return normalizeSubscriptionPayload(primary);
}

async function upsertNormalizedSubscription(
  normalized: NormalizedSubscriptionState,
  now: Date = new Date(),
): Promise<void> {
  if (!normalized.externalUserId) return;

  await prisma.subscription.upsert({
    where: { userId: normalized.externalUserId },
    create: {
      userId: normalized.externalUserId,
      polarCustomerId: normalized.polarCustomerId,
      polarProductId: normalized.polarProductId,
      status: normalized.status,
      planId: normalized.planId,
      currentPeriodEnd: normalized.currentPeriodEnd,
      cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
      lastSyncedAt: now,
    },
    update: {
      polarCustomerId: normalized.polarCustomerId,
      polarProductId: normalized.polarProductId,
      status: normalized.status,
      planId: normalized.planId,
      currentPeriodEnd: normalized.currentPeriodEnd,
      cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
      lastSyncedAt: now,
    },
  });
}

/**
 * Applies a `customers.getStateExternal` result (used by syncNow and the
 * reconciliation job). Shares one mapping path with webhook events so both
 * producers write identical rows.
 */
export async function applyCustomerState(state: unknown): Promise<ApplyResult> {
  const normalized = normalizeCustomerState(state);
  if (!normalized.externalUserId) {
    logger.warn(
      { component: "billing", event: "billing.sync.unlinked_customer" },
      "Polar customer state has no external user id; nothing applied.",
    );
    return { applied: false, reason: "unlinked_customer" };
  }
  await upsertNormalizedSubscription(normalized);
  return { applied: true, userId: normalized.externalUserId };
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEventStale(
  eventModifiedAt: string | Date | null | undefined,
  lastSyncedAt: Date | undefined,
): boolean {
  const eventTime = toDate(eventModifiedAt ?? null);
  if (!eventTime || !lastSyncedAt) return false;
  return eventTime <= lastSyncedAt;
}

/**
 * Applies a Polar webhook `subscription.*` event body. Assumes signature
 * verification and dedup have already happened at the route layer.
 */
export async function applySubscriptionEvent(
  eventData: PolarSubscriptionLike & { id?: string },
): Promise<ApplyResult> {
  const normalized = normalizeSubscriptionPayload(eventData);

  if (!normalized.externalUserId) {
    logger.warn(
      {
        component: "billing",
        event: "billing.webhook.unlinked_customer",
        polarCustomerId: normalized.polarCustomerId,
      },
      "Webhook for unlinked Polar customer ignored.",
    );
    return { applied: false, reason: "unlinked_customer" };
  }

  if (normalized.status === "active" && normalized.planId !== "pro") {
    logger.warn(
      {
        component: "billing",
        event: "billing.webhook.unmapped_product",
        productId: normalized.polarProductId,
      },
      "Active subscription mapped to no known plan; entitlements remain free.",
    );
  }

  const existing = await prisma.subscription.findUnique({
    where: { userId: normalized.externalUserId },
    select: { lastSyncedAt: true },
  });

  if (
    isEventStale(
      eventData.modifiedAt ?? null,
      existing?.lastSyncedAt as Date | undefined,
    )
  ) {
    return { applied: false, userId: normalized.externalUserId, reason: "stale_event" };
  }

  await upsertNormalizedSubscription(normalized);
  return { applied: true, userId: normalized.externalUserId };
}

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

function decodeWebhookSecret(secret: string): Buffer {
  if (secret.startsWith("whsec_")) {
    const decoded = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decoded.length > 0) return decoded;
  }
  return Buffer.from(secret, "utf8");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface WebhookVerificationResult {
  ok: boolean;
  reason?: string;
  eventId: string | null;
  payloadHash: string;
}

/**
 * Verifies a Polar webhook delivery using the Standard Webhooks scheme
 * (`webhook-id` / `webhook-timestamp` / `webhook-signature`, base64
 * HMAC-SHA256 over `${id}.${timestamp}.${body}`), including replay tolerance.
 */
export function verifyPolarWebhook(
  rawBody: string,
  headers: Headers,
  options: { now?: Date; secret?: string } = {},
): WebhookVerificationResult {
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const eventId = headers.get("webhook-id");
  const timestampHeader = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  const secret = options.secret ?? env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, reason: "missing_secret", eventId, payloadHash };
  }

  if (!eventId || !timestampHeader || !signatureHeader) {
    return { ok: false, reason: "missing_headers", eventId, payloadHash };
  }

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "invalid_timestamp", eventId, payloadHash };
  }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (
    Math.abs(nowSeconds - timestampSeconds) >
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
  ) {
    return { ok: false, reason: "timestamp_out_of_tolerance", eventId, payloadHash };
  }

  const expected = createHmac("sha256", decodeWebhookSecret(secret))
    .update(`${eventId}.${timestampHeader}.${rawBody}`)
    .digest("base64");

  const candidates = signatureHeader
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const matches = candidates.some((candidate) => {
    const [version, digest] = candidate.split(",");
    if (version !== "v1" || !digest) return false;
    return safeEqual(Buffer.from(digest), Buffer.from(expected));
  });

  if (!matches) {
    return { ok: false, reason: "invalid_signature", eventId, payloadHash };
  }

  return { ok: true, eventId, payloadHash };
}
