import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type DriftCheck = {
  name: string;
  status: CheckStatus;
  required: boolean;
  message: string;
  details?: unknown;
};

type Options = {
  json: boolean;
  strict: boolean;
  outDir?: string;
};

type EnvSource = "env-file" | "github-variable" | "github-secret" | "runtime-default";

type EnvVarDefinition = {
  name: string;
  source: EnvSource;
  required: boolean;
  secret: boolean;
};

type EnvironmentDefinition = {
  purpose: string;
  variables: EnvVarDefinition[];
};

type Baseline = {
  version: number;
  owner: string;
  reviewCadence: string;
  environments: Record<string, EnvironmentDefinition>;
};

type BaselineRead = {
  baseline: Baseline | null;
  error?: string;
};

const BASELINE_PATH = "infra/environment-baseline.json";
const REQUIRED_ENVIRONMENTS = ["local", "test", "preview", "staging", "production"];
const PRODUCTION_CRITICAL_NAMES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "ENCRYPTION_KEY",
  "MCP_API_KEY_HMAC_SECRET",
  "MCP_OAUTH_TOKEN_HMAC_SECRET",
];

function readArgValue(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];

  return fallback;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const flags = new Set(args);

  return {
    json: flags.has("--json"),
    strict: flags.has("--strict"),
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

function defaultOutDir() {
  return path.join(
    process.cwd(),
    "docs",
    "api",
    "evidence",
    "environment-drift",
    dateStamp(),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEnvSource(value: unknown): value is EnvSource {
  return (
    value === "env-file" ||
    value === "github-variable" ||
    value === "github-secret" ||
    value === "runtime-default"
  );
}

function isEnvVarDefinition(value: unknown): value is EnvVarDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    isEnvSource(value.source) &&
    typeof value.required === "boolean" &&
    typeof value.secret === "boolean"
  );
}

function isEnvironmentDefinition(value: unknown): value is EnvironmentDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.purpose === "string" &&
    value.purpose.length > 0 &&
    Array.isArray(value.variables) &&
    value.variables.length > 0 &&
    value.variables.every(isEnvVarDefinition)
  );
}

function isBaseline(value: unknown): value is Baseline {
  if (!isRecord(value)) return false;
  if (
    typeof value.version !== "number" ||
    typeof value.owner !== "string" ||
    typeof value.reviewCadence !== "string" ||
    !isRecord(value.environments)
  ) {
    return false;
  }

  return REQUIRED_ENVIRONMENTS.every((environment) =>
    isEnvironmentDefinition(value.environments[environment]),
  );
}

function readBaseline(): BaselineRead {
  const fullPath = path.join(process.cwd(), BASELINE_PATH);
  if (!fs.existsSync(fullPath)) {
    return { baseline: null, error: `${BASELINE_PATH} does not exist.` };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!isBaseline(parsed)) {
      return { baseline: null, error: `${BASELINE_PATH} has an invalid shape.` };
    }
    return { baseline: parsed };
  } catch (error) {
    return {
      baseline: null,
      error: error instanceof Error ? error.message : "Failed to parse baseline.",
    };
  }
}

function fileContains(relativePath: string, patterns: RegExp[]) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, "utf8");
  return patterns.every((pattern) => pattern.test(content));
}

function fileText(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
}

function check(
  name: string,
  passed: boolean,
  message: string,
  required = true,
  details?: unknown,
): DriftCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function variableNames(environment: EnvironmentDefinition | undefined) {
  return new Set((environment?.variables || []).map((item) => item.name));
}

function missingNames(names: Set<string>, requiredNames: string[]) {
  return requiredNames.filter((name) => !names.has(name));
}

function hasSeparateEnvironmentNames(workflowText: string) {
  return (
    /STAGING_DATABASE_URL/.test(workflowText) &&
    /PRODUCTION_DATABASE_URL/.test(workflowText) &&
    /STAGING_APP_URL/.test(workflowText) &&
    /PRODUCTION_APP_URL/.test(workflowText)
  );
}

function buildChecks(options: Options): DriftCheck[] {
  const baselineRead = readBaseline();
  const baseline = baselineRead.baseline;
  const productionNames = variableNames(baseline?.environments.production);
  const stagingWorkflow = fileText(".github/workflows/staging-deploy.yml");
  const productionWorkflow = fileText(".github/workflows/production-deploy.yml");
  const combinedWorkflowText = `${stagingWorkflow}\n${productionWorkflow}`;
  const missingProductionNames = missingNames(productionNames, PRODUCTION_CRITICAL_NAMES);

  return [
    check(
      "environment baseline",
      baseline !== null,
      "Environment baseline should exist with local, test, preview, staging, and production definitions.",
      true,
      baselineRead.error || {
        owner: baseline?.owner,
        reviewCadence: baseline?.reviewCadence,
        environments: Object.keys(baseline?.environments || {}),
      },
    ),
    check(
      "production critical variables",
      missingProductionNames.length === 0,
      "Production baseline should include all critical runtime secrets and URLs.",
      true,
      { missing: missingProductionNames },
    ),
    check(
      "environment separation",
      hasSeparateEnvironmentNames(combinedWorkflowText),
      "Staging and production workflows should use separate GitHub variables and secrets.",
    ),
    check(
      "env example local baseline",
      fileContains(".env.example", [
        /DATABASE_URL/,
        /BETTER_AUTH_SECRET/,
        /NEXT_PUBLIC_APP_URL/,
        /ENCRYPTION_KEY/,
        /MCP_API_KEY_HMAC_SECRET/,
      ]),
      ".env.example should document critical local runtime variables.",
    ),
    check(
      "runtime env schema",
      fileContains("src/env.ts", [
        /DATABASE_URL/,
        /BETTER_AUTH_SECRET/,
        /NEXT_PUBLIC_APP_URL/,
        /ENCRYPTION_KEY/,
        /MCP_API_KEY_HMAC_SECRET/,
      ]),
      "Runtime env schema should validate critical backend and platform variables.",
    ),
    check(
      "drift runbook",
      fileContains("docs/DevOps/environment-drift-runbook.md", [
        /drift/i,
        /baseline/i,
        /staging/i,
        /production/i,
      ]),
      "Environment drift runbook should describe baseline ownership and staging/production drift response.",
    ),
    check(
      "drift workflow",
      fileContains(".github/workflows/governance.yml", [
        /environment:drift:check/,
        /governance/,
        /environment-drift/,
      ]),
      "Governance workflow should run environment drift detection and upload drift evidence.",
      options.strict,
    ),
    check(
      "release workflow drift gate",
      fileContains(".github/workflows/production-deploy.yml", [
        /environment:drift:check/,
        /governance:check/,
        /environment-drift-status/,
      ]),
      "Production workflow should include governance and environment drift release gates.",
      options.strict,
    ),
    check(
      "infra ownership",
      fileContains(".github/CODEOWNERS", [/infra\//, /environment-drift-check/]),
      "CODEOWNERS should require review for infra and drift detection changes.",
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "environment-drift-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "environment-drift-check",
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    passed: failed.length === 0,
    failedRequired: failed.map((item) => item.name),
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n environment drift check");
    console.log(`Strict: ${options.strict ? "yes" : "no"}`);
    console.log(`Report: ${reportPath}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.status}`);
      if (item.status !== "passed") console.log(`  ${item.message}`);
    }
    console.log("");
    console.log(`Result: ${failed.length === 0 ? "PASS" : "FAIL"}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main();
