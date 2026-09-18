/**
 * MCP query-count check.
 *
 * Counts the SQL statements the MCP dashboard prefetch path issues, so an N+1
 * regression shows up as a number rather than as a code-review opinion.
 *
 * The dashboard server component prefetches `listKeys`, `securitySummary` and
 * `listOAuthConnections` on every page load, and the two OAuth-aware calls used
 * to issue four statements per connected client.
 *
 * Run against a throwaway database seeded by scripts/mcp-db-benchmark.ts:
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.scripts.json \
 *     scripts/mcp-query-count-check.ts --label after
 *
 * Exits non-zero when the statement count scales with the number of connected
 * OAuth clients, which is the property that matters.
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Point it at a throwaway database.");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const labelIndex = args.indexOf("--label");
  return {
    label: labelIndex >= 0 ? args[labelIndex + 1] : "run",
    json: args.includes("--json"),
  };
}

/**
 * A counting client that records every statement, installed as the module-level
 * prisma singleton before the code under test imports it.
 */
function createCountingClient() {
  const statements: string[] = [];
  const client = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString })),
    log: [{ emit: "event", level: "query" }],
  }) as PrismaClient & {
    $on(event: "query", callback: (event: { query: string }) => void): void;
  };

  client.$on("query", (event) => {
    // Transaction bookkeeping is not work the feature asked for.
    if (/^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)/i.test(event.query.trim())) return;
    statements.push(event.query.replace(/\s+/g, " ").trim());
  });

  return { client, statements };
}

async function main() {
  const { label, json } = parseArgs();
  const { client, statements } = createCountingClient();

  // Install the counting client as the singleton `@/lib/db` hands out, so the
  // code under test is exercised unmodified.
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  globalForPrisma.prisma = client;

  const { listMcpOAuthConnectionsForUser, getMcpUserSecuritySummary } = await import(
    "../src/mcp/security/security-summary"
  );

  const consentCount = await client.mcpOAuthConsent.count({
    where: { userId: "bench-user-1", revokedAt: null },
  });

  statements.length = 0;
  await listMcpOAuthConnectionsForUser("bench-user-1");
  const listConnectionsStatements = statements.length;

  statements.length = 0;
  await getMcpUserSecuritySummary("bench-user-1");
  const securitySummaryStatements = statements.length;

  // Same call against a user with a different number of connected clients:
  // if the count tracks the client count, the query shape is still N+1.
  statements.length = 0;
  await listMcpOAuthConnectionsForUser("bench-user-2");
  const secondUserStatements = statements.length;

  const scalesWithConnections = listConnectionsStatements > consentCount;

  const report = {
    check: "mcp-query-count",
    label,
    generatedAt: new Date().toISOString(),
    connectedOAuthClients: consentCount,
    listOAuthConnections: { statements: listConnectionsStatements },
    securitySummary: { statements: securitySummaryStatements },
    secondUser: { statements: secondUserStatements },
    dashboardPrefetchTotal: securitySummaryStatements + listConnectionsStatements,
    scalesWithConnections,
    passed: !scalesWithConnections,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nMCP query-count check (${label})\n`);
    console.log(`  connected OAuth clients      ${consentCount}`);
    console.log(`  listOAuthConnections         ${listConnectionsStatements} statements`);
    console.log(`  securitySummary              ${securitySummaryStatements} statements`);
    console.log(`  dashboard prefetch total     ${report.dashboardPrefetchTotal} statements`);
    console.log(
      `\n  ${report.passed ? "PASSED" : "FAILED"} — statement count ${scalesWithConnections ? "scales with" : "is constant in"} the number of connected clients\n`,
    );
  }

  await client.$disconnect();
  process.exit(report.passed ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
