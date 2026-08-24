import { logger } from "@/lib/logging";
import prisma from "@/lib/db";
import { throwIfE2EFault } from "@/lib/e2e-faults";
import {
  applySubscriptionEvent,
  verifyPolarWebhook,
} from "@/lib/entitlements/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_EVENT_PREFIX = "subscription.";

async function handle(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const verification = verifyPolarWebhook(rawBody, request.headers);
  if (!verification.ok) {
    logger.warn(
      {
        component: "billing",
        event: "billing.webhook.rejected",
        reason: verification.reason,
        eventId: verification.eventId,
      },
      "Polar webhook rejected.",
    );
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: { type?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType =
    typeof event.type === "string" ? event.type : "unknown";
  const ledgerId = verification.eventId || `${eventType}:${verification.payloadHash}`;

  try {
    await prisma.processedWebhookEvent.create({
      data: {
        id: ledgerId,
        type: eventType,
        payloadHash: verification.payloadHash,
      },
    });
  } catch {
    return Response.json({ received: true, deduped: true });
  }

  if (!eventType.startsWith(SUBSCRIPTION_EVENT_PREFIX)) {
    return Response.json({ received: true, ignored: true });
  }

  throwIfE2EFault(
    "polar-webhook",
    "Simulated E2E Polar webhook application failure.",
  );

  try {
    const result = await applySubscriptionEvent(
      (event.data ?? {}) as Record<string, unknown>,
    );

    logger.info(
      {
        component: "billing",
        event: "billing.webhook.applied",
        type: eventType,
        userId: result.userId,
        applied: result.applied,
        reason: result.reason ?? null,
      },
      "Polar subscription event processed.",
    );

    return Response.json({
      received: true,
      applied: result.applied,
      reason: result.reason ?? null,
    });
  } catch {
    // Release the dedup slot so Polar's redelivery can reapply the event.
    await prisma.processedWebhookEvent
      .deleteMany({ where: { id: ledgerId } })
      .catch(() => undefined);

    logger.error(
      {
        component: "billing",
        event: "billing.webhook.apply_failed",
        type: eventType,
      },
      "Polar webhook application failed.",
    );
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
