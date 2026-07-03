import { sendWorkflowExecution } from "@/inngest/utils";
import { type NextRequest, NextResponse } from "next/server";
import {
  verifySharedWebhookSecret,
  verifyStripeSignature,
  webhookAuthError,
} from "../_security";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: workflowId" },
        { status: 400 },
      );
    };

    const rawBody = await request.text();
    const stripeVerification = verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    const sharedVerification = process.env.STRIPE_WEBHOOK_SECRET
      ? stripeVerification
      : verifySharedWebhookSecret(request, url, [
          "STRIPE_WEBHOOK_SHARED_SECRET",
          "A8N_WEBHOOK_SHARED_SECRET",
        ]);
    if (!sharedVerification.ok) return webhookAuthError(sharedVerification);

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!isRecord(parsed)) {
        return NextResponse.json(
          { success: false, error: "Malformed Stripe payload" },
          { status: 400 },
        );
      }
      body = parsed;
    } catch {
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

    // Trigger an Inngest job
    const event = await sendWorkflowExecution({
      workflowId,
      initialData: {
        stripe: stripeData,
      },
    });

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
    console.error("Stripe webhook error:" , error);
    return NextResponse.json(
      { success: false, error: "Failed to process Stripe event" },
      { status: 500 },
    );
  }
};
