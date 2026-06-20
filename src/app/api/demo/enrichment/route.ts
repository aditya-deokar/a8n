import { type NextRequest, NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const pickResponse = (
  responses: unknown,
  keys: string[],
  fallback: string,
) => {
  if (!isRecord(responses)) return fallback;

  const entries = Object.entries(responses);
  for (const key of keys) {
    const exact = responses[key];
    if (exact !== undefined) return asString(exact, fallback);

    const normalizedKey = key.toLowerCase();
    const looseMatch = entries.find(([candidate]) =>
      candidate.toLowerCase().includes(normalizedKey),
    );
    if (looseMatch) return asString(looseMatch[1], fallback);
  }

  return fallback;
};

const formatStripeAmount = (raw: unknown) => {
  if (!isRecord(raw)) return "Demo amount unavailable";

  const amount =
    typeof raw.amount === "number"
      ? raw.amount
      : typeof raw.amount_received === "number"
        ? raw.amount_received
        : undefined;

  const currency = asString(raw.currency, "usd").toUpperCase();

  if (amount === undefined) return `Demo ${currency} payment`;

  return `${currency} ${(amount / 100).toFixed(2)}`;
};

const buildGoogleFormEvent = (googleForm: JsonRecord) => {
  const responses = googleForm.responses;
  const title = pickResponse(
    responses,
    ["Issue Title", "Title", "Subject"],
    "Cannot submit assignment before deadline",
  );
  const description = pickResponse(
    responses,
    ["Issue Description", "Description", "Details", "Message"],
    "The portal shows an error when the user tries to submit before the deadline.",
  );
  const urgency = pickResponse(responses, ["Urgency", "Priority"], "High");
  const customerName = pickResponse(responses, ["Full Name", "Name"], "Demo User");
  const customerEmail = asString(
    googleForm.respondentEmail,
    pickResponse(responses, ["Email", "Email Address"], "demo@example.com"),
  );

  return {
    source: "google-form",
    sourceLabel: "Google Form submission",
    sourceTimestamp: asString(googleForm.timestamp, "demo-google-form"),
    customerName,
    customerEmail,
    title,
    description,
    urgency,
    category: urgency.toLowerCase().includes("high") ? "Customer support" : "General operations",
    priority: urgency.toLowerCase().includes("high") ? "High" : "Medium",
    summary: `${customerName} reported: ${title}`,
    recommendedAction:
      "Review the submitted details, assign an owner, and respond with the next support step.",
    escalationRequired: urgency.toLowerCase().includes("high"),
    raw: googleForm,
  };
};

const buildStripeEvent = (stripe: JsonRecord) => {
  const raw = isRecord(stripe.raw) ? stripe.raw : {};
  const eventType = asString(stripe.eventType, "payment_intent.succeeded");
  const customerEmail = asString(
    raw.receipt_email,
    asString(raw.customer_email, "billing-demo@example.com"),
  );
  const customerName = asString(
    isRecord(raw.billing_details) ? raw.billing_details.name : undefined,
    "Billing Demo Customer",
  );
  const amount = formatStripeAmount(raw);

  return {
    source: "stripe",
    sourceLabel: "Stripe payment event",
    sourceTimestamp: asString(stripe.timestamp, "demo-stripe-event"),
    customerName,
    customerEmail,
    title: `Stripe event: ${eventType}`,
    description: `Payment event ${eventType} was received for ${amount}.`,
    urgency: eventType.includes("failed") ? "High" : "Medium",
    category: "Billing operations",
    priority: eventType.includes("failed") ? "High" : "Medium",
    summary: `${eventType} for ${amount}`,
    recommendedAction:
      "Confirm the payment state, update the customer record, and notify the finance/support team.",
    escalationRequired: eventType.includes("failed") || eventType.includes("dispute"),
    raw: stripe,
  };
};

const buildManualDemoEvent = (context: JsonRecord) => ({
  source: "manual-demo",
  sourceLabel: "Manual demo run",
  sourceTimestamp: "demo-manual-run",
  customerName: asString(context.customerName, "Demo User"),
  customerEmail: asString(context.customerEmail, "demo@example.com"),
  title: asString(context.title, "Payment confirmation not received"),
  description: asString(
    context.description,
    "The user completed payment but has not received confirmation after 20 minutes.",
  ),
  urgency: asString(context.urgency, "High"),
  category: "Demo operations",
  priority: "High",
  summary: "Demo user needs urgent help with payment confirmation.",
  recommendedAction:
    "Check payment status, confirm delivery state, and send a clear customer update.",
  escalationRequired: true,
  raw: context,
});

const getContext = (body: unknown): JsonRecord => {
  if (!isRecord(body)) return {};

  if (isRecord(body.context)) return body.context;
  if (isRecord(body.initialData)) return body.initialData;

  return body;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const context = getContext(body);

    const googleForm = isRecord(context.googleForm) ? context.googleForm : undefined;
    const stripe = isRecord(context.stripe) ? context.stripe : undefined;

    const demoEvent = googleForm
      ? buildGoogleFormEvent(googleForm)
      : stripe
        ? buildStripeEvent(stripe)
        : buildManualDemoEvent(context);

    return NextResponse.json({
      success: true,
      demoEvent,
    });
  } catch (error) {
    console.error("Demo enrichment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to enrich demo workflow payload",
      },
      { status: 500 },
    );
  }
}
