/**
 * MCP database benchmark.
 *
 * Seeds a representative dataset and runs EXPLAIN (ANALYZE, BUFFERS) over the
 * queries the MCP surface issues most, so index and query changes can be
 * compared with measurements instead of assertions.
 *
 * Run against a throwaway database only — it writes and deletes rows:
 *   DATABASE_URL=postgresql://a8n_dev:a8n_dev@127.0.0.1:5432/a8n_dev \
 *     npx tsx --tsconfig tsconfig.scripts.json scripts/mcp-db-benchmark.ts --seed
 *
 * Then:  ... scripts/mcp-db-benchmark.ts --label before  > before.json
 *        (apply migration)
 *        ... scripts/mcp-db-benchmark.ts --label after   > after.json
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Point it at a throwaway database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString })),
});

/**
 * Sized so the planner has a real choice to make. On a table of a few hundred
 * rows Postgres prefers a sequential scan whatever indexes exist, so a smaller
 * dataset would produce a before/after comparison that proves nothing.
 */
const SEED = {
  users: 3,
  workflowsPerUser: 400,
  nodesPerWorkflow: 8,
  executionsPerWorkflow: 12,
  auditLogsPerUser: 60_000,
  oauthClientsPerUser: 10,
  tokensPerClient: 200,
};

const BENCH_USER = "bench-user-1";

function parseArgs() {
  const args = process.argv.slice(2);
  const labelIndex = args.indexOf("--label");
  return {
    seed: args.includes("--seed"),
    reset: args.includes("--reset"),
    label: labelIndex >= 0 ? args[labelIndex + 1] : "run",
  };
}

/** Prisma sends one statement per createMany, so cap the parameter count. */
async function createInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  chunkSize = 2000,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await insert(rows.slice(index, index + chunkSize));
  }
}

async function reset() {
  // Ordered by dependency so cascades do not fight the deletes.
  await prisma.mcpOAuthAccessToken.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.mcpOAuthRefreshToken.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.mcpOAuthConsent.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.mcpOAuthClient.deleteMany({ where: { clientId: { startsWith: "bench-client-" } } });
  await prisma.mcpAuditLog.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.apiKey.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.workflow.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.credential.deleteMany({ where: { userId: { startsWith: "bench-user-" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "bench-user-" } } });
}

async function seed() {
  await reset();

  for (let u = 1; u <= SEED.users; u += 1) {
    const userId = `bench-user-${u}`;
    await prisma.user.create({
      data: {
        id: userId,
        name: `Bench User ${u}`,
        email: `bench-${u}@example.test`,
        emailVerified: true,
      },
    });

    const credential = await prisma.credential.create({
      data: { userId, name: `cred-${u}`, value: "encrypted", type: "OPENAI" },
    });

    const workflowIds = Array.from(
      { length: SEED.workflowsPerUser },
      (_, w) => `bench-wf-${u}-${w}`,
    );
    await prisma.workflow.createMany({
      data: workflowIds.map((id, w) => ({
        id,
        userId,
        name: `Workflow ${u}-${w}`,
        updatedAt: new Date(Date.now() - w * 60_000),
      })),
    });

    const nodeRows = workflowIds.flatMap((workflowId) =>
      Array.from({ length: SEED.nodesPerWorkflow }, (_, n) => ({
        id: `${workflowId}-n${n}`,
        workflowId,
        name: `node-${n}`,
        type: n === 0 ? ("MANUAL_TRIGGER" as const) : ("HTTP_REQUEST" as const),
        position: { x: n * 200, y: 0 },
        data: { variableName: `step${n}` },
        credentialId: n % 3 === 0 ? credential.id : null,
      })),
    );
    await createInChunks(nodeRows, (rows) => prisma.node.createMany({ data: rows }));

    const connectionRows = workflowIds.flatMap((workflowId) =>
      Array.from({ length: SEED.nodesPerWorkflow - 1 }, (_, n) => ({
        workflowId,
        fromNodeId: `${workflowId}-n${n}`,
        toNodeId: `${workflowId}-n${n + 1}`,
      })),
    );
    await createInChunks(connectionRows, (rows) =>
      prisma.connection.createMany({ data: rows }),
    );

    const executionRows = workflowIds.flatMap((workflowId) =>
      Array.from({ length: SEED.executionsPerWorkflow }, (_, e) => ({
        workflowId,
        status: e % 4 === 0 ? ("FAILED" as const) : ("SUCCESS" as const),
        inngestEventId: `evt-${workflowId}-${e}`,
        startedAt: new Date(Date.now() - e * 3_600_000),
        completedAt: new Date(Date.now() - e * 3_600_000 + 4_000),
        output: { steps: Array.from({ length: 20 }, (_, i) => ({ i, note: "payload".repeat(20) })) },
      })),
    );
    await createInChunks(executionRows, (rows) =>
      prisma.execution.createMany({ data: rows }),
    );

    await createInChunks(
      Array.from({ length: SEED.auditLogsPerUser }, (_, a) => ({
        correlationId: `corr-${userId}-${a}`,
        userId,
        authMethod: "api_key",
        tool: a % 5 === 0 ? "list_workflows" : "get_workflow",
        durationMs: 12,
        status: a % 7 === 0 ? "error" : "success",
        timestamp: new Date(Date.now() - a * 60_000),
      })),
      (rows) => prisma.mcpAuditLog.createMany({ data: rows }),
    );

    for (let c = 0; c < SEED.oauthClientsPerUser; c += 1) {
      const clientId = `bench-client-${u}-${c}`;
      await prisma.mcpOAuthClient.create({
        data: {
          clientId,
          clientName: `Bench Client ${c}`,
          redirectUris: ["https://example.test/callback"],
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          scope: "workflows:read",
          tokenEndpointAuthMethod: "none",
        },
      });
      await prisma.mcpOAuthConsent.create({
        data: {
          userId,
          clientId,
          scopes: ["workflows:read", "executions:read"],
          redirectUri: "https://example.test/callback",
          resource: "https://example.test/api/mcp",
        },
      });
      await prisma.mcpOAuthAccessToken.createMany({
        data: Array.from({ length: SEED.tokensPerClient }, (_, t) => ({
          tokenHash: `access-${clientId}-${t}`,
          userId,
          clientId,
          scopes: ["workflows:read"],
          resource: "https://example.test/api/mcp",
          expiresAt: new Date(Date.now() + 3_600_000),
          lastUsedAt: t % 2 === 0 ? new Date(Date.now() - t * 60_000) : null,
        })),
      });
      await prisma.mcpOAuthRefreshToken.createMany({
        data: Array.from({ length: SEED.tokensPerClient }, (_, t) => ({
          tokenHash: `refresh-${clientId}-${t}`,
          userId,
          clientId,
          scopes: ["workflows:read"],
          resource: "https://example.test/api/mcp",
          expiresAt: new Date(Date.now() + 86_400_000),
          lastUsedAt: t % 3 === 0 ? new Date(Date.now() - t * 60_000) : null,
        })),
      });
    }
  }

  await prisma.$executeRawUnsafe("ANALYZE");
}

type BenchCase = { name: string; sql: string };

async function benchCases(): Promise<BenchCase[]> {
  const workflow = await prisma.workflow.findFirstOrThrow({
    where: { userId: BENCH_USER },
    select: { id: true },
  });
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      name: "graph: nodes by workflow",
      sql: `SELECT * FROM "Node" WHERE "workflowId" = '${workflow.id}'`,
    },
    {
      name: "graph: connections by workflow",
      sql: `SELECT * FROM "Connection" WHERE "workflowId" = '${workflow.id}'`,
    },
    {
      name: "list_executions: page 1",
      sql: `SELECT e.id, e.status, e."workflowId", e."startedAt", e."completedAt", e.error
            FROM "Execution" e
            JOIN "Workflow" w ON w.id = e."workflowId"
            WHERE w."userId" = '${BENCH_USER}'
            ORDER BY e."startedAt" DESC
            LIMIT 20`,
    },
    {
      name: "list_workflows: page 1",
      sql: `SELECT id, name, "updatedAt" FROM "Workflow"
            WHERE "userId" = '${BENCH_USER}'
            ORDER BY "updatedAt" DESC LIMIT 20`,
    },
    {
      name: "audit: failed events last 24h",
      sql: `SELECT count(*) FROM "mcp_audit_log"
            WHERE "userId" = '${BENCH_USER}' AND status = 'error' AND "timestamp" >= '${since}'`,
    },
    {
      name: "audit: retention sweep scan",
      sql: `SELECT count(*) FROM "mcp_audit_log" WHERE "timestamp" < '${cutoff}'`,
    },
    {
      name: "oauth: active access tokens per client",
      sql: `SELECT "clientId", count(*) FROM "mcp_oauth_access_token"
            WHERE "userId" = '${BENCH_USER}' AND "revokedAt" IS NULL AND "expiresAt" > now()
            GROUP BY "clientId"`,
    },
    {
      name: "oauth: latest token usage per client",
      sql: `SELECT "clientId", max("lastUsedAt") FROM "mcp_oauth_access_token"
            WHERE "userId" = '${BENCH_USER}' AND "lastUsedAt" IS NOT NULL
            GROUP BY "clientId"`,
    },
    {
      name: "oauth: consent listing",
      sql: `SELECT * FROM "mcp_oauth_consent"
            WHERE "userId" = '${BENCH_USER}' AND "revokedAt" IS NULL
            ORDER BY "createdAt" DESC`,
    },
  ];
}

type PlanRow = { "QUERY PLAN": Array<Record<string, unknown>> };

async function explain(sql: string) {
  const rows = await prisma.$queryRawUnsafe<PlanRow[]>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  const plan = rows[0]["QUERY PLAN"][0] as {
    Plan: Record<string, unknown>;
    "Execution Time": number;
    "Planning Time": number;
  };

  const scanTypes: string[] = [];
  const walk = (node: Record<string, unknown>) => {
    if (typeof node["Node Type"] === "string") scanTypes.push(node["Node Type"] as string);
    const children = node.Plans as Array<Record<string, unknown>> | undefined;
    for (const child of children ?? []) walk(child);
  };
  walk(plan.Plan);

  return {
    executionMs: Number(plan["Execution Time"].toFixed(3)),
    planningMs: Number(plan["Planning Time"].toFixed(3)),
    sharedBlocksRead: Number(plan.Plan["Shared Read Blocks"] ?? 0),
    sharedBlocksHit: Number(plan.Plan["Shared Hit Blocks"] ?? 0),
    scanTypes: [...new Set(scanTypes)].sort(),
    usesSeqScan: scanTypes.includes("Seq Scan"),
  };
}

async function main() {
  const { seed: shouldSeed, reset: shouldReset, label } = parseArgs();

  if (shouldReset) {
    await reset();
    console.log(JSON.stringify({ reset: true }, null, 2));
    await prisma.$disconnect();
    return;
  }

  if (shouldSeed) {
    await seed();
  }

  const cases = await benchCases();
  const results = [];
  for (const benchCase of cases) {
    // Run twice and keep the second result so caches are warm for both labels.
    await explain(benchCase.sql);
    const measurement = await explain(benchCase.sql);
    results.push({ name: benchCase.name, ...measurement });
  }

  console.log(
    JSON.stringify(
      {
        label,
        generatedAt: new Date().toISOString(),
        seed: SEED,
        results,
        seqScanCount: results.filter((item) => item.usesSeqScan).length,
        totalExecutionMs: Number(
          results.reduce((total, item) => total + item.executionMs, 0).toFixed(3),
        ),
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
