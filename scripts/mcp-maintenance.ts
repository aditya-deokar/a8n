import "dotenv/config";
import { runMcpProductionMaintenance } from "../src/mcp/maintenance/production-maintenance";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const retentionArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--audit-retention-days="));
  const retentionDays = retentionArg
    ? Number(retentionArg.split("=")[1])
    : undefined;
  return {
    json: args.has("--json"),
    dryRun: args.has("--dry-run"),
    auditRetentionDays:
      Number.isFinite(retentionDays) && retentionDays && retentionDays > 0
        ? retentionDays
        : undefined,
  };
}

async function main() {
  const options = parseArgs();
  const report = await runMcpProductionMaintenance({
    dryRun: options.dryRun,
    auditRetentionDays: options.auditRetentionDays,
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("a8n MCP production maintenance");
  console.log(`Dry run: ${report.dryRun ? "yes" : "no"}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("MCP maintenance failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
