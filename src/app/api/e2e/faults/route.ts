import {
  clearE2EFaults,
  setE2EFault,
  type E2EFaultName,
} from "@/lib/e2e-faults";
import { isE2EMode } from "@/lib/e2e-safety";
import { withRequestLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

const E2E_FAULTS = new Set<E2EFaultName>(["prisma", "inngest", "polar"]);

function available() {
  return isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";
}

function unavailable() {
  return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
}

async function postHandler(request: Request) {
  if (!available()) return unavailable();

  const body = await request.json().catch(() => null);
  const fault = body && typeof body === "object" ? (body as { fault?: unknown }).fault : null;

  if (typeof fault !== "string" || !E2E_FAULTS.has(fault as E2EFaultName)) {
    return NextResponse.json(
      { success: false, error: "Invalid E2E fault name." },
      { status: 400 },
    );
  }

  setE2EFault(fault as E2EFaultName);
  return NextResponse.json({ success: true, fault });
}

async function deleteHandler(request: Request) {
  void request;

  if (!available()) return unavailable();

  clearE2EFaults();
  return NextResponse.json({ success: true });
}

export const POST = withRequestLogging(postHandler, {
  component: "api",
  route: "/api/e2e/faults",
  eventPrefix: "e2e_fault_request",
});

export const DELETE = withRequestLogging(deleteHandler, {
  component: "api",
  route: "/api/e2e/faults",
  eventPrefix: "e2e_fault_request",
});
