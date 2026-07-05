import { NextResponse } from "next/server";
import { runMcpProductionMaintenance } from "@/mcp/maintenance/production-maintenance";
import { withRequestLogging } from "@/lib/logging";

function isAuthorized(request: Request) {
  const configuredSecret =
    process.env.MCP_MAINTENANCE_SECRET || process.env.CRON_SECRET || "";
  if (!configuredSecret) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization") || "";
  return bearer === `Bearer ${configuredSecret}`;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runMcpProductionMaintenance();
  return NextResponse.json(report);
}

async function getHandler(request: Request) {
  return handle(request);
}

async function postHandler(request: Request) {
  return handle(request);
}

export const GET = withRequestLogging(getHandler, {
  component: "mcp",
  route: "/api/cron/mcp-maintenance",
  eventPrefix: "mcp_maintenance_request",
});

export const POST = withRequestLogging(postHandler, {
  component: "mcp",
  route: "/api/cron/mcp-maintenance",
  eventPrefix: "mcp_maintenance_request",
});
