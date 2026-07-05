import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/env";
import { assertSafeE2EEnvironment } from "@/lib/e2e-safety";
import { logger, normalizeError, redactLogString } from "@/lib/logging";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

type PrismaQueryEvent = {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
};

type PrismaLogEvent = {
  timestamp: Date;
  message: string;
  target: string;
};

const connectionString = env.DATABASE_URL;

assertSafeE2EEnvironment();

function slowQueryThresholdMs() {
  return env.OBSERVABILITY_SLOW_QUERY_MS || 500;
}

function includeQueryPreview() {
  return (
    process.env.NODE_ENV !== "production" &&
    env.OBSERVABILITY_REQUEST_BODY_LOG_ENABLED === true
  );
}

function queryPreview(query: string) {
  return redactLogString(query).replace(/\s+/g, " ").trim().slice(0, 300);
}

function attachPrismaLogging(client: PrismaClient) {
  const clientWithEvents = client as PrismaClient & {
    $on(event: "query", callback: (event: PrismaQueryEvent) => void): void;
    $on(event: "error", callback: (event: PrismaLogEvent) => void): void;
  };

  clientWithEvents.$on("query", (event) => {
    const thresholdMs = slowQueryThresholdMs();
    if (event.duration < thresholdMs) return;

    logger.warn(
      {
        component: "database",
        event: "db_slow_query",
        target: event.target,
        durationMs: event.duration,
        slowQuery: true,
        thresholdMs,
        query: includeQueryPreview() ? queryPreview(event.query) : undefined,
      },
      "Slow database query detected.",
    );
  });

  clientWithEvents.$on("error", (event) => {
    logger.error(
      {
        component: "database",
        event: "db_query_failed",
        target: event.target,
        error: normalizeError(new Error(event.message)),
      },
      "Database query failed.",
    );
  });
}

const createPrismaClient = () => {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
    ],
  });
  attachPrismaLogging(client);
  return client;
};

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
