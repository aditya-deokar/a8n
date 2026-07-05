import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type GateStatus = "passed" | "failed" | "skipped";

type GateCheck = {
  name: string;
  required: boolean;
  command: string;
  status: GateStatus;
  exitCode: number | null;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  reason?: string;
};

let checkTimeoutMs = Number(process.env.API_E2E_RELEASE_GATE_TIMEOUT_MS || 900_000);

const API_E2E_SMOKE_SPECS = [
  "auth.e2e.ts",
  "trpc-transport.e2e.ts",
  "workflows.e2e.ts",
  "tenant-isolation.e2e.ts",
];

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test";
const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])|a8n_test/i;
const LOCAL_DOCKER_TEST_ENV_PATH = path.join(
  process.cwd(),
  "docker",
  "env",
  "test.host.env",
);

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = new Set(args);
  const readValue = (name: string, fallback?: string) => {
    const inline = args.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };

  return {
    json: flags.has("--json"),
    smoke: flags.has("--smoke"),
    includeMcp: flags.has("--include-mcp"),
    skipApiE2E: flags.has("--skip-api-e2e"),
    outDir: readValue("--out-dir"),
    checkTimeoutMs: Number(readValue("--check-timeout-ms", String(checkTimeoutMs))),
  };
}

function cliPath(...parts: string[]) {
  return path.join(process.cwd(), "node_modules", ...parts);
}

function prismaCli() {
  return cliPath("prisma", "build", "index.js");
}

function playwrightCli() {
  return cliPath("@playwright", "test", "cli.js");
}

function isSafeE2EDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return false;

  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.replace(/^\//, "");
    const looksLikeTestDatabase = TEST_DATABASE_NAME_PATTERN.test(databaseName);
    return looksLikeTestDatabase;
  } catch {
    return false;
  }
}

function isHostedCi() {
  return process.env.GITHUB_ACTIONS === "true" || process.env.VERCEL === "1";
}

function readEnvFileValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return undefined;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const envKey = trimmed.slice(0, separatorIndex).trim();
    if (envKey !== key) continue;

    return trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
  }

  return undefined;
}

function localDockerTestDatabaseUrl() {
  if (isHostedCi()) return undefined;

  const dockerDatabaseUrl = readEnvFileValue(
    LOCAL_DOCKER_TEST_ENV_PATH,
    "DATABASE_URL",
  );

  return isSafeE2EDatabaseUrl(dockerDatabaseUrl) ? dockerDatabaseUrl : undefined;
}

function e2eDatabaseUrl() {
  const explicitDatabaseUrl =
    process.env.API_E2E_DATABASE_URL || process.env.E2E_DATABASE_URL;
  if (explicitDatabaseUrl) return explicitDatabaseUrl;

  if (isSafeE2EDatabaseUrl(process.env.DATABASE_URL)) {
    return process.env.DATABASE_URL;
  }

  const dockerDatabaseUrl = localDockerTestDatabaseUrl();
  if (dockerDatabaseUrl) return dockerDatabaseUrl;

  return DEFAULT_E2E_DATABASE_URL;
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
  return path.join(process.cwd(), "docs", "api", "evidence", "e2e", dateStamp());
}

function redact(value: string | undefined) {
  if (!value) return value;

  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_DATABASE_URL]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:test-)?(?:google-form|stripe|a8n-shared)-webhook-secret\b/gi, "[REDACTED_WEBHOOK_SECRET]")
    .replace(/\bwhsec_[A-Za-z0-9_]+\b/g, "[REDACTED_STRIPE_WEBHOOK_SECRET]")
    .replace(
      /(ENCRYPTION_KEY|BETTER_AUTH_SECRET|POLAR_ACCESS_TOKEN|MCP_API_KEY_HMAC_SECRET|MCP_OAUTH_TOKEN_HMAC_SECRET)=\S+/g,
      "$1=[REDACTED]",
    )
    .slice(0, 20_000);
}

function run(
  name: string,
  args: string[],
  required = true,
  env: NodeJS.ProcessEnv = process.env,
): GateCheck {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    timeout: checkTimeoutMs,
  });
  const durationMs = Date.now() - started;

  return {
    name,
    required,
    command: `${process.execPath} ${args.join(" ")}`,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs,
    stdout: redact(result.stdout?.trim()),
    stderr: redact(result.error ? result.error.message : result.stderr?.trim()),
  };
}

function skipped(name: string, reason: string, required = false): GateCheck {
  return {
    name,
    required,
    command: "",
    status: "skipped",
    exitCode: null,
    durationMs: 0,
    reason,
  };
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "api-e2e-release-gate.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function e2eEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "true",
    NODE_ENV: "test",
    NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
    E2E_TESTS: "true",
    E2E_EXTERNAL_SERVICES: "mock",
    DATABASE_URL: e2eDatabaseUrl(),
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-32-characters",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    APP_URL: process.env.APP_URL || "http://127.0.0.1:3000",
    NEXT_PUBLIC_WEBHOOK_BASE_URL:
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || "http://127.0.0.1:3000",
    ENCRYPTION_KEY:
      process.env.ENCRYPTION_KEY || "test-api-encryption-key-32-characters",
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN || "test-polar-token",
    MCP_AUDIT_DB_ENABLED: process.env.MCP_AUDIT_DB_ENABLED || "false",
    MCP_AUDIT_LOG_ENABLED: process.env.MCP_AUDIT_LOG_ENABLED || "false",
    MCP_API_KEY_HMAC_SECRET:
      process.env.MCP_API_KEY_HMAC_SECRET || "ci-mcp-api-key-hmac-secret-32-chars",
    MCP_OAUTH_TOKEN_HMAC_SECRET:
      process.env.MCP_OAUTH_TOKEN_HMAC_SECRET || "ci-mcp-oauth-token-hmac-secret-32",
    A8N_WEBHOOK_SHARED_SECRET:
      process.env.A8N_WEBHOOK_SHARED_SECRET || "test-a8n-shared-webhook-secret",
    GOOGLE_FORM_WEBHOOK_SECRET:
      process.env.GOOGLE_FORM_WEBHOOK_SECRET || "test-google-form-webhook-secret",
    STRIPE_WEBHOOK_SECRET:
      process.env.STRIPE_WEBHOOK_SECRET || "test-stripe-webhook-secret",
    STRIPE_WEBHOOK_SHARED_SECRET:
      process.env.STRIPE_WEBHOOK_SHARED_SECRET || "test-stripe-shared-webhook-secret",
  };
}

function main() {
  const options = parseArgs();
  checkTimeoutMs =
    Number.isFinite(options.checkTimeoutMs) && options.checkTimeoutMs > 0
      ? options.checkTimeoutMs
      : checkTimeoutMs;

  const env = e2eEnv();
  const apiE2EArgs = [
    playwrightCli(),
    "test",
    "--config",
    "playwright.api-e2e.config.mjs",
    ...(options.smoke ? API_E2E_SMOKE_SPECS : []),
  ];

  const checks: GateCheck[] = [
    run("prisma validate", [prismaCli(), "validate", "--schema", "prisma/schema.prisma"], true, env),
    run("prisma migrate status", [prismaCli(), "migrate", "status", "--schema", "prisma/schema.prisma"], true, env),
  ];

  if (options.skipApiE2E) {
    checks.push(skipped("API E2E", "Skipped by --skip-api-e2e.", true));
  } else {
    checks.push(
      run(
        options.smoke ? "API E2E smoke" : "API E2E full",
        apiE2EArgs,
        true,
        env,
      ),
    );
  }

  if (options.includeMcp) {
    checks.push(
      run(
        "MCP widget E2E",
        [playwrightCli(), "test", "--config", "playwright.config.mjs", "mcp"],
        true,
        env,
      ),
    );
  } else {
    checks.push(skipped("MCP widget E2E", "Pass --include-mcp to include MCP browser E2E."));
  }

  const failedRequired = checks.filter((check) => check.required && check.status !== "passed");
  const passed = failedRequired.length === 0;
  const report = {
    suite: "api-e2e-release-gate",
    generatedAt: new Date().toISOString(),
    mode: options.smoke ? "smoke" : "full",
    includeMcp: options.includeMcp,
    checkTimeoutMs,
    passed,
    failedRequired: failedRequired.map((check) => check.name),
    stopShipCriteria: [
      "Anonymous users cannot reach protected backend data.",
      "Free users cannot call premium-only backend mutations.",
      "Cross-tenant workflow, credential, execution, API-key, and OAuth access cannot succeed.",
      "Raw credential values, API key hashes, OAuth token hashes, and webhook secrets are absent from responses and artifacts.",
      "Workflow dispatch happens only after ownership checks pass.",
      "Webhooks reject missing, wrong, malformed, stale, or unsigned traffic.",
      "Malformed requests and simulated backend failures do not expose environment secrets.",
      "The E2E database schema matches committed Prisma migrations.",
    ],
    artifacts: [
      "playwright-report/api-e2e",
      "test-results/api-e2e",
      "docs/api/evidence/e2e",
    ],
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n API E2E release gate");
    console.log(`Mode: ${options.smoke ? "smoke" : "full"}`);
    console.log(`MCP E2E: ${options.includeMcp ? "enabled" : "skipped"}`);
    console.log(`Report: ${reportPath}`);
    console.log("");
    for (const check of checks) {
      console.log(`- ${check.name}: ${check.status}${check.required ? "" : " (optional)"}`);
      if (check.status === "failed" && check.stderr) {
        console.log(`  ${check.stderr.split("\n")[0]}`);
      }
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
