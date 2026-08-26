import { sendWorkflowExecution } from "@/inngest/utils";
import { isKillSwitchEnabled } from "@/lib/feature-flags";
import { logger, normalizeError, withRequestLogging } from "@/lib/logging";
import { type NextRequest, NextResponse } from "next/server";
import {
  assertWorkflowActive,
  getWorkflowTriggerSecrets,
  isRateLimited,
  verifySharedWebhookSecret,
  verifyStripeSignature,
  webhookAuthError,
} from "../_security";
import { NodeType } from "@/generated/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function postHandler(request: NextRequest) {
  let workflowId: string | null = null;

  try {
    if (isKillSwitchEnabled("disableWebhookProcessing")) {
      return NextResponse.json(
        { success: false, error: "Webhook processing is temporarily disabled" },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    workflowId = url.searchParams.get("workflowId");

    logger.info(
      {
        component: "webhook",
        event: "webhook_received",
        provider: "stripe",
        workflowId,
      },
      "Stripe webhook received.",
    );

    if (!workflowId) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_malformed_payload",
          provider: "stripe",
          reason: "missing_workflow_id",
        },
        "Stripe webhook is missing workflowId.",
      );

      return NextResponse.json(
        { success: false, error: "Missing required query parameter: workflowId" },
        { status: 400 },
      );
    }

    if (isRateLimited(`stripe:${workflowId}`)) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_rate_limited",
          provider: "stripe",
          workflowId,
        },
        "Stripe webhook rate limited.",
      );
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 },
      );
    }

    const workflowActive = await assertWorkflowActive(workflowId);
    if (!workflowActive.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This workflow is not active. Activate it from the workflows dashboard to receive events.",
        },
        { status: 409 },
      );
    }

    const rawBody = await request.text();
    const workflowSecrets = await getWorkflowTriggerSecrets(
      workflowId,
      NodeType.STRIPE_TRIGGER,
    );

    // Verify against the platform secret first, then any per-workflow
    // signing secrets configured on this workflow's Stripe trigger nodes.
    let stripeVerification = verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (!stripeVerification.ok && workflowSecrets.length > 0) {
      for (const secret of workflowSecrets) {
        const candidate = verifyStripeSignature(
          rawBody,
          request.headers.get("stripe-signature"),
          secret,
        );
        if (candidate.ok) {
          stripeVerification = candidate;
          break;
        }
      }
    }

    const sharedVerification =
      stripeVerification.ok
        ? stripeVerification
        : process.env.STRIPE_WEBHOOK_SECRET || workflowSecrets.length > 0
          ? stripeVerification
          : verifySharedWebhookSecret(request, url, [
              "STRIPE_WEBHOOK_SHARED_SECRET",
              "A8N_WEBHOOK_SHARED_SECRET",
            ]);
    if (!sharedVerification.ok) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_verification_failed",
          provider: "stripe",
          workflowId,
          verificationMode: sharedVerification.mode,
          verified: false,
        },
        "Stripe webhook verification failed.",
      );

      return webhookAuthError(sharedVerification);
    }

    logger.info(
      {
        component: "webhook",
        event: "webhook_verification_completed",
        provider: "stripe",
        workflowId,
        verificationMode: sharedVerification.mode,
        verified: sharedVerification.enforced,
      },
      "Stripe webhook verification completed.",
    );

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!isRecord(parsed)) {
        logger.warn(
          {
            component: "webhook",
            event: "webhook_malformed_payload",
            provider: "stripe",
            workflowId,
            reason: "invalid_json_object",
          },
          "Stripe webhook payload is malformed.",
        );

        return NextResponse.json(
          { success: false, error: "Malformed Stripe payload" },
          { status: 400 },
        );
      }
      body = parsed;
    } catch {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_malformed_payload",
          provider: "stripe",
          workflowId,
          reason: "invalid_json",
        },
        "Stripe webhook payload is malformed.",
      );

      return NextResponse.json(
        { success: false, error: "Malformed Stripe payload" },
        { status: 400 },
      );
    }
    const data = isRecord(body.data) ? body.data : undefined;

    const stripeData = {
      // Event metadata
      eventId: body.id,
      eventType: body.type,
      timestamp: body.created,
      livemode: body.livemode,
      raw: data?.object,
    };

    logger.info(
      {
        component: "webhook",
        event: "webhook_event_identified",
        provider: "stripe",
        workflowId,
        stripeEventId: typeof body.id === "string" ? body.id : undefined,
        stripeEventType: typeof body.type === "string" ? body.type : undefined,
      },
      "Stripe webhook event identified.",
    );

    // Trigger an Inngest job
    const event = await sendWorkflowExecution({
      workflowId,
      initialData: {
        stripe: stripeData,
      },
    });

    logger.info(
      {
        component: "webhook",
        event: "webhook_dispatch_completed",
        provider: "stripe",
        workflowId,
        inngestEventId: event.eventId,
        stripeEventId: typeof body.id === "string" ? body.id : undefined,
        stripeEventType: typeof body.type === "string" ? body.type : undefined,
        verificationMode: sharedVerification.mode,
        verified: sharedVerification.enforced,
      },
      "Stripe webhook dispatch completed.",
    );

    return NextResponse.json(
      {
        success: true,
        inngestEventId: event.eventId,
        webhookSecurity: {
          verified: sharedVerification.enforced,
          mode: sharedVerification.mode,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(
      {
        component: "webhook",
        event: "webhook_processing_failed",
        provider: "stripe",
        workflowId,
        error: normalizeError(error),
      },
      "Stripe webhook processing failed.",
    );
    return NextResponse.json(
      { success: false, error: "Failed to process Stripe event" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLogging(postHandler, {
  component: "webhook",
  route: "/api/webhooks/stripe",
  eventPrefix: "webhook_request",
  fields: { provider: "stripe" },
});
