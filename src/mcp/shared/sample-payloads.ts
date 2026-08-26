/**
 * Shared sample payloads — Phase 1 dedup (previously triplicated).
 * Sources:
 *  - src/mcp/tools/integrations/integration-tools.ts: sampleGoogleFormPayload / sampleStripePayload / webhookInitialData
 *  - src/mcp/tools/executions/execution-runtime-tools.ts: sampleInitialData
 * Canonical shapes are kept identical to avoid breaking existing callers.
 */

export function sampleGoogleFormPayload() {
  return {
    formId: "sample-form-id",
    formTitle: "Sample Customer Feedback",
    responseId: "sample-response-id",
    timestamp: new Date().toISOString(),
    respondentEmail: "student@example.com",
    responses: {
      Name: "Alex",
      Feedback: "I need help understanding automation setup.",
      Score: "8",
    },
  };
}

export function sampleStripePayload() {
  return {
    id: "evt_sample_payment_succeeded",
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "pi_sample",
        amount: 2500,
        currency: "usd",
        customer: "cus_sample",
        status: "succeeded",
      },
    },
  };
}

export function webhookInitialData(trigger: "google_form" | "stripe") {
  if (trigger === "google_form") {
    const body = sampleGoogleFormPayload();
    return {
      googleForm: {
        formId: body.formId,
        formTitle: body.formTitle,
        responseId: body.responseId,
        timestamp: body.timestamp,
        respondentEmail: body.respondentEmail,
        responses: body.responses,
        raw: body,
      },
    };
  }

  const body = sampleStripePayload();
  return {
    stripe: {
      eventId: body.id,
      eventType: body.type,
      timestamp: body.created,
      livemode: body.livemode,
      raw: body.data.object,
    },
  };
}

/**
 * Mirrors execution-runtime-tools.sampleInitialData but reuses the same
 * Google/Stripe shapes above so payloads stay consistent across
 * run_workflow_test and the (now-removed) test_webhook_setup.
 */
export function sampleInitialData(
  trigger: "manual" | "google_form" | "stripe",
  sampleData?: Record<string, unknown>,
) {
  if (sampleData) return sampleData;
  if (trigger === "google_form" || trigger === "stripe") {
    return webhookInitialData(trigger);
  }
  return {};
}
