import { sendWorkflowExecution } from "@/inngest/utils";
import { isKillSwitchEnabled } from "@/lib/feature-flags";
import { logger, normalizeError, withRequestLogging } from "@/lib/logging";
import { type NextRequest, NextResponse } from "next/server";
import {
  assertWorkflowActive,
  getWorkflowTriggerSecrets,
  isRateLimited,
  verifySharedWebhookSecret,
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
        provider: "google-form",
        workflowId,
      },
      "Google Form webhook received.",
    );

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: workflowId" },
        { status: 400 },
      );
    }

    if (isRateLimited(`google-form:${workflowId}`)) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_rate_limited",
          provider: "google-form",
          workflowId,
        },
        "Google Form webhook rate limited.",
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

    const workflowSecrets = await getWorkflowTriggerSecrets(
      workflowId,
      NodeType.GOOGLE_FORM_TRIGGER,
    );
    const verification = verifySharedWebhookSecret(
      request,
      url,
      [
        "GOOGLE_FORM_WEBHOOK_SECRET",
        "A8N_WEBHOOK_SHARED_SECRET",
      ],
      workflowSecrets,
    );

    if (!verification.ok) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_verification_failed",
          provider: "google-form",
          workflowId,
          verificationMode: verification.mode,
          verified: false,
        },
        "Google Form webhook verification failed.",
      );

      return webhookAuthError(verification);
    }

    logger.info(
      {
        component: "webhook",
        event: "webhook_verification_completed",
        provider: "google-form",
        workflowId,
        verificationMode: verification.mode,
        verified: verification.enforced,
      },
      "Google Form webhook verification completed.",
    );

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      logger.warn(
        {
          component: "webhook",
          event: "webhook_malformed_payload",
          provider: "google-form",
          workflowId,
          reason: "invalid_json_object",
        },
        "Google Form webhook payload is malformed.",
      );

      return NextResponse.json(
        { success: false, error: "Malformed Google Form payload" },
        { status: 400 },
      );
    }

    const formData = {
      formId: body.formId,
      formTitle: body.formTitle,
      responseId: body.responseId,
      timestamp: body.timestamp,
      respondentEmail: body.respondentEmail,
      responses: body.responses,
      raw: body,
    };

    // Trigger an Inngest job
    const event = await sendWorkflowExecution({
      workflowId,
      initialData: {
        googleForm: formData,
      },
    });

    logger.info(
      {
        component: "webhook",
        event: "webhook_dispatch_completed",
        provider: "google-form",
        workflowId,
        inngestEventId: event.eventId,
        verificationMode: verification.mode,
        verified: verification.enforced,
      },
      "Google Form webhook dispatch completed.",
    );

    return NextResponse.json(
      {
        success: true,
        inngestEventId: event.eventId,
        webhookSecurity: {
          verified: verification.enforced,
          mode: verification.mode,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(
      {
        component: "webhook",
        event: "webhook_processing_failed",
        provider: "google-form",
        workflowId,
        error: normalizeError(error),
      },
      "Google Form webhook processing failed.",
    );
    return NextResponse.json(
      { success: false, error: "Failed to process Google Form submission" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLogging(postHandler, {
  component: "webhook",
  route: "/api/webhooks/google-form",
  eventPrefix: "webhook_request",
  fields: { provider: "google-form" },
});
