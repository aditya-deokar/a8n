import { createHmac } from "node:crypto";

export const GOOGLE_FORM_WEBHOOK_SECRET = "test-google-form-webhook-secret";
export const STRIPE_WEBHOOK_SECRET = "test-stripe-webhook-secret";

export function buildGoogleFormPayload() {
  return {
    formId: "e2e_form_123",
    formTitle: "E2E Intake Form",
    responseId: "e2e_response_123",
    timestamp: "2026-07-03T12:00:00.000Z",
    respondentEmail: "e2e_form_submitter@example.com",
    responses: {
      name: "E2E Submitter",
      message: "Hello from the backend E2E suite",
    },
  };
}

export function buildStripePayload() {
  return {
    id: "evt_e2e_stripe_123",
    type: "payment_intent.succeeded",
    created: 1783070400,
    livemode: false,
    data: {
      object: {
        id: "pi_e2e_123",
        amount: 4200,
        currency: "usd",
      },
    },
  };
}

export function signStripePayload(
  rawBody: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const signature = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}
