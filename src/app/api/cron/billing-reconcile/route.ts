import { NextResponse } from "next/server";
import { runBillingReconciliation } from "@/lib/entitlements/reconcile";
import { withRequestLogging } from "@/lib/logging";

function isAuthorized(request: Request) {
  const configuredSecret =
    process.env.BILLING_RECONCILE_SECRET || process.env.CRON_SECRET || "";
  if (!configuredSecret) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization") || "";
  return bearer === `Bearer ${configuredSecret}`;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runBillingReconciliation();
  return NextResponse.json(report);
}

async function getHandler(request: Request) {
  return handle(request);
}

async function postHandler(request: Request) {
  return handle(request);
}

export const GET = withRequestLogging(getHandler, {
  component: "billing",
  route: "/api/cron/billing-reconcile",
  eventPrefix: "billing_reconcile_request",
});

export const POST = withRequestLogging(postHandler, {
  component: "billing",
  route: "/api/cron/billing-reconcile",
  eventPrefix: "billing_reconcile_request",
});
