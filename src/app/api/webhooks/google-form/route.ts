import { sendWorkflowExecution } from "@/inngest/utils";
import { type NextRequest, NextResponse } from "next/server";
import { verifySharedWebhookSecret, webhookAuthError } from "../_security";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId");
    const verification = verifySharedWebhookSecret(request, url, [
      "GOOGLE_FORM_WEBHOOK_SECRET",
      "A8N_WEBHOOK_SHARED_SECRET",
    ]);

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: workflowId" },
        { status: 400 },
      );
    };
    if (!verification.ok) return webhookAuthError(verification);

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
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
    console.error("Google form webhook error:" , error);
    return NextResponse.json(
      { success: false, error: "Failed to process Google Form submission" },
      { status: 500 },
    );
  }
};
