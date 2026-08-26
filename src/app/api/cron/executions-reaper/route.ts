import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logger, withRequestLogging } from "@/lib/logging";

const STALE_THRESHOLD_MINUTES = 15;

function isAuthorized(request: Request) {
  const configuredSecret =
    process.env.EXECUTIONS_REAPER_SECRET || process.env.CRON_SECRET || "";
  if (!configuredSecret) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization") || "";
  return bearer === `Bearer ${configuredSecret}`;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const stale = await prisma.execution.findMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: threshold },
    },
    select: { id: true },
    take: 500,
  });

  if (stale.length === 0) {
    return NextResponse.json({ reaped: 0, thresholdMinutes: STALE_THRESHOLD_MINUTES });
  }

  const result = await prisma.execution.updateMany({
    where: {
      id: { in: stale.map((execution) => execution.id) },
      status: "RUNNING",
    },
    data: {
      status: "FAILED",
      error: `Execution was marked as timed out after ${STALE_THRESHOLD_MINUTES} minutes without a terminal status.`,
      completedAt: new Date(),
    },
  });

  logger.info(
    {
      component: "workflow",
      event: "stale_executions_reaped",
      count: result.count,
      thresholdMinutes: STALE_THRESHOLD_MINUTES,
    },
    "Reaped executions stuck in RUNNING.",
  );

  return NextResponse.json({
    reaped: result.count,
    thresholdMinutes: STALE_THRESHOLD_MINUTES,
  });
}

async function getHandler(request: Request) {
  return handle(request);
}

async function postHandler(request: Request) {
  return handle(request);
}

export const GET = withRequestLogging(getHandler, {
  component: "workflow",
  route: "/api/cron/executions-reaper",
  eventPrefix: "executions_reaper_request",
});

export const POST = withRequestLogging(postHandler, {
  component: "workflow",
  route: "/api/cron/executions-reaper",
  eventPrefix: "executions_reaper_request",
});
