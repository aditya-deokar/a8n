import {
  clearE2EWorkflowDispatches,
  listE2EWorkflowDispatches,
} from "@/lib/e2e-workflow-dispatches";
import { isE2EMode } from "@/lib/e2e-safety";
import { withRequestLogging } from "@/lib/logging";
import { type NextRequest, NextResponse } from "next/server";

function assertAvailable() {
  return isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";
}

function unavailable() {
  return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
}

async function getHandler(request: NextRequest) {
  if (!assertAvailable()) return unavailable();

  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId") || undefined;

  return NextResponse.json({
    success: true,
    dispatches: listE2EWorkflowDispatches(workflowId),
  });
}

async function deleteHandler(request: NextRequest) {
  void request;

  if (!assertAvailable()) return unavailable();

  clearE2EWorkflowDispatches();
  return NextResponse.json({ success: true });
}

export const GET = withRequestLogging(getHandler, {
  component: "api",
  route: "/api/e2e/workflow-dispatches",
  eventPrefix: "e2e_workflow_dispatches_request",
});

export const DELETE = withRequestLogging(deleteHandler, {
  component: "api",
  route: "/api/e2e/workflow-dispatches",
  eventPrefix: "e2e_workflow_dispatches_request",
});
