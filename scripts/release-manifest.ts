import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import packageJson from "../package.json";

type ReleaseEnvironment = "preview" | "staging" | "production";

type ReleaseManifestOptions = {
  environment: ReleaseEnvironment;
  version: string;
  deploymentUrl?: string;
  rollbackTarget?: string;
  releaseNotesUrl?: string;
  databaseMigrationStatus: string;
  apiReleaseGateStatus: string;
  apiE2eReleaseGateStatus: string;
  mcpReleaseGateStatus: string;
  productionSmokeStatus: string;
  observabilityStatus: string;
  securityStatus: string;
  featureFlagStatus: string;
  incidentStatus: string;
  restoreDrillStatus: string;
  performanceStatus: string;
  governanceStatus: string;
  environmentDriftStatus: string;
  json: boolean;
  outDir?: string;
};

function readArgValue(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];

  return fallback;
}

function readEnvironment(): ReleaseEnvironment {
  const environment = readArgValue("--environment", "production");
  if (
    environment === "preview" ||
    environment === "staging" ||
    environment === "production"
  ) {
    return environment;
  }

  throw new Error("Invalid --environment. Use preview, staging, or production.");
}

function parseArgs(): ReleaseManifestOptions {
  const args = process.argv.slice(2);
  const flags = new Set(args);
  const version =
    readArgValue("--version") ||
    process.env.RELEASE_VERSION ||
    packageJson.version ||
    "0.0.0";

  return {
    environment: readEnvironment(),
    version,
    deploymentUrl: readArgValue("--deployment-url", process.env.DEPLOYMENT_URL),
    rollbackTarget: readArgValue("--rollback-target", process.env.ROLLBACK_TARGET),
    releaseNotesUrl: readArgValue("--release-notes-url", process.env.RELEASE_NOTES_URL),
    databaseMigrationStatus: readArgValue("--database-migration-status", "unknown") || "unknown",
    apiReleaseGateStatus: readArgValue("--api-release-gate-status", "unknown") || "unknown",
    apiE2eReleaseGateStatus: readArgValue("--api-e2e-release-gate-status", "unknown") || "unknown",
    mcpReleaseGateStatus: readArgValue("--mcp-release-gate-status", "unknown") || "unknown",
    productionSmokeStatus: readArgValue("--production-smoke-status", "unknown") || "unknown",
    observabilityStatus: readArgValue("--observability-status", "unknown") || "unknown",
    securityStatus: readArgValue("--security-status", "unknown") || "unknown",
    featureFlagStatus: readArgValue("--feature-flag-status", "unknown") || "unknown",
    incidentStatus: readArgValue("--incident-status", "unknown") || "unknown",
    restoreDrillStatus: readArgValue("--restore-drill-status", "unknown") || "unknown",
    performanceStatus: readArgValue("--performance-status", "unknown") || "unknown",
    governanceStatus: readArgValue("--governance-status", "unknown") || "unknown",
    environmentDriftStatus: readArgValue("--environment-drift-status", "unknown") || "unknown",
    json: flags.has("--json"),
    outDir: readArgValue("--out-dir"),
  };
}

function dateStamp() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function gitValue(args: string[], fallback: string) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) return fallback;
  return result.stdout.trim() || fallback;
}

function currentCommit() {
  return process.env.GITHUB_SHA || gitValue(["rev-parse", "HEAD"], "unknown");
}

function currentBranch() {
  return (
    process.env.GITHUB_REF_NAME ||
    gitValue(["rev-parse", "--abbrev-ref", "HEAD"], "unknown")
  );
}

function defaultOutDir(options: ReleaseManifestOptions) {
  return path.join(
    process.cwd(),
    "docs",
    "releases",
    dateStamp(),
    options.environment,
  );
}

function writeJson(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "release-manifest.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function writeMarkdown(
  manifest: {
    version: string;
    environment: ReleaseEnvironment;
    releasedAt: string;
    commit: string;
    branch: string;
    deploymentUrl?: string;
    rollbackTarget?: string;
    gates: Record<string, string>;
  },
  outDir: string,
) {
  const notesPath = path.join(outDir, "release-manifest.md");
  const lines = [
    `# Release ${manifest.version}`,
    "",
    `Environment: ${manifest.environment}`,
    `Released at: ${manifest.releasedAt}`,
    `Commit: ${manifest.commit}`,
    `Branch: ${manifest.branch}`,
    `Deployment URL: ${manifest.deploymentUrl || "not recorded"}`,
    `Rollback target: ${manifest.rollbackTarget || "not recorded"}`,
    "",
    "## Gates",
    "",
    "| Gate | Status |",
    "|---|---|",
    ...Object.entries(manifest.gates).map(([gate, status]) => `| ${gate} | ${status} |`),
    "",
  ];
  fs.writeFileSync(notesPath, `${lines.join("\n")}\n`, "utf8");
  return notesPath;
}

function main() {
  const options = parseArgs();
  const releasedAt = new Date().toISOString();
  const manifest = {
    project: "a8n",
    version: options.version,
    environment: options.environment,
    releasedAt,
    commit: currentCommit(),
    branch: currentBranch(),
    deploymentUrl: options.deploymentUrl,
    rollbackTarget: options.rollbackTarget,
    releaseNotesUrl: options.releaseNotesUrl,
    gates: {
      databaseMigration: options.databaseMigrationStatus,
      apiReleaseGate: options.apiReleaseGateStatus,
      apiE2eReleaseGate: options.apiE2eReleaseGateStatus,
      mcpReleaseGate: options.mcpReleaseGateStatus,
      productionSmoke: options.productionSmokeStatus,
      observability: options.observabilityStatus,
      security: options.securityStatus,
      featureFlags: options.featureFlagStatus,
      incidents: options.incidentStatus,
      restoreDrill: options.restoreDrillStatus,
      performance: options.performanceStatus,
      governance: options.governanceStatus,
      environmentDrift: options.environmentDriftStatus,
    },
    artifacts: [
      "docs/api/evidence/migrations",
      "docs/api/evidence/release-gates",
      "docs/api/evidence/e2e",
      "docs/api/evidence/smoke/production",
      "docs/api/evidence/observability",
      "docs/api/evidence/security",
      "docs/api/evidence/feature-flags",
      "docs/api/evidence/incidents",
      "docs/api/evidence/disaster-recovery",
      "docs/api/evidence/performance",
      "docs/api/evidence/governance",
      "docs/api/evidence/environment-drift",
    ],
  };
  const outDir = options.outDir || defaultOutDir(options);
  const reportPath = writeJson(manifest, outDir);
  const markdownPath = writeMarkdown(manifest, outDir);

  if (options.json) {
    console.log(JSON.stringify({ ...manifest, reportPath, markdownPath }, null, 2));
  } else {
    console.log("a8n release manifest");
    console.log(`Version: ${manifest.version}`);
    console.log(`Environment: ${manifest.environment}`);
    console.log(`Commit: ${manifest.commit}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Notes: ${markdownPath}`);
  }
}

main();
