import { NextResponse } from "next/server";
import { runMcpProductionMaintenance } from "@/mcp/maintenance/production-maintenance";

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

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
