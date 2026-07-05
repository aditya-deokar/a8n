import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type ObservabilityCheck = {
  name: string;
  status: CheckStatus;
  message: string;
  required: boolean;
};

type Options = {
  json: boolean;
  strict: boolean;
  profile: "development" | "test" | "production";
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

function readProfile(): Options["profile"] {
  const profile =
    readArgValue("--profile") ||
    process.env.A8N_ENV_PROFILE ||
    process.env.NODE_ENV ||
    "development";

  if (profile === "development" || profile === "test" || profile === "production") {
    return profile;
  }

  return "development";
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const flags = new Set(args);

  return {
    json: flags.has("--json"),
    strict: flags.has("--strict"),
    profile: readProfile(),
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
  return path.join(process.cwd(), "docs", "api", "evidence", "observability", dateStamp());
}

function fileExists(relativePath: string) {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function fileContains(relativePath: string, patterns: RegExp[]) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, "utf8");
  return patterns.every((pattern) => pattern.test(content));
}

const runtimeConsoleAllowlist = new Set([
  path.join("src", "features", "triggers", "components", "google-form-trigger", "utils.ts"),
]);

function listRuntimeSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated") return [];
      return listRuntimeSourceFiles(fullPath);
    }

    return /\.(js|mjs|ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function runtimeConsoleViolations() {
  const root = process.cwd();
  const files = listRuntimeSourceFiles(path.join(root, "src"));
  const pattern = /console\.(log|error|warn|info|debug)\s*\(/;

  return files.flatMap((fullPath) => {
    const relativePath = path.relative(root, fullPath);
    if (runtimeConsoleAllowlist.has(relativePath)) return [];

    return fs
      .readFileSync(fullPath, "utf8")
      .split(/\r?\n/)
      .flatMap((line, index) =>
        pattern.test(line)
          ? [`${relativePath}:${index + 1}`]
          : [],
      );
  });
}

function hasTelemetryProvider() {
  return Boolean(
    process.env.ERROR_TRACKING_DSN ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OBSERVABILITY_METRICS_ENDPOINT ||
      process.env.OBSERVABILITY_PROVIDER,
  );
}

function check(
  name: string,
  passed: boolean,
  message: string,
  required = true,
): ObservabilityCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    message,
    required,
  };
}

function buildChecks(options: Options): ObservabilityCheck[] {
  const providerConfigured = hasTelemetryProvider();
  const consoleViolations = runtimeConsoleViolations();

  return [
    check(
      "observability utility",
      fileExists("src/lib/observability.ts"),
      "Central observability utility exists.",
    ),
    check(
      "logging foundation",
      [
        "src/lib/logging/logger.ts",
        "src/lib/logging/redaction.ts",
        "src/lib/logging/http.ts",
        "src/lib/logging/external.ts",
      ].every(fileExists),
      "Shared logger, redaction, request logging, and external provider helpers exist.",
    ),
    check(
      "observability uses shared logger",
      fileContains("src/lib/observability.ts", [/logger/, /redactLogValue/]),
      "Existing observability API routes through the shared logger and redaction layer.",
    ),
    check(
      "client log endpoint",
      fileExists("src/app/api/logs/client/route.ts"),
      "Client error log endpoint exists.",
    ),
    check(
      "logging environment controls",
      fileContains(".env.example", [
        /OBSERVABILITY_LOG_FORMAT/,
        /OBSERVABILITY_REDACTION_STRICT/,
        /OBSERVABILITY_CLIENT_LOG_ENABLED/,
        /OBSERVABILITY_SLOW_QUERY_MS/,
      ]),
      ".env.example includes logging controls.",
    ),
    check(
      "runtime console guard",
      consoleViolations.length === 0,
      consoleViolations.length === 0
        ? "Runtime source has no direct console usage outside the allowlist."
        : `Runtime console usage found: ${consoleViolations.join(", ")}`,
    ),
    check(
      "eslint console guard",
      fileContains("eslint.config.mjs", [/no-console/, /src\/\*\*\//]),
      "ESLint guards runtime source against direct console usage.",
    ),
    check(
      "next instrumentation",
      fileExists("src/instrumentation.ts"),
      "Next.js instrumentation file exists.",
    ),
    check(
      "observability runbook",
      fileContains("docs/DevOps/observability-runbook.md", [
        /structured logs/i,
        /metrics/i,
        /traces/i,
        /dashboard/i,
        /SLO/i,
      ]),
      "Observability runbook covers logs, metrics, traces, dashboards, and SLOs.",
    ),
    check(
      "alert rules",
      fileContains("docs/DevOps/alert-rules.md", [
        /API 5xx/i,
        /latency/i,
        /workflow/i,
        /webhook/i,
        /MCP/i,
        /database/i,
      ]),
      "Alert rules cover API, latency, workflow, webhook, MCP, and database alerts.",
    ),
    check(
      "logging dashboard specs",
      fileContains("docs/DevOps/logging-dashboard-specs.md", [
        /API health/i,
        /workflow/i,
        /webhook/i,
        /MCP/i,
        /database/i,
        /client/i,
      ]),
      "Logging dashboard specs cover API, workflow, webhook, MCP, database, and client health.",
    ),
    check(
      "release observability evidence",
      fileContains("docs/DevOps/production-release-runbook.md", [
        /observability/i,
        /smoke/i,
        /rollback/i,
      ]),
      "Production release runbook includes observability, smoke, and rollback.",
    ),
    check(
      "telemetry provider configuration",
      providerConfigured,
      options.profile === "production"
        ? "Production should configure ERROR_TRACKING_DSN, OTEL_EXPORTER_OTLP_ENDPOINT, OBSERVABILITY_METRICS_ENDPOINT, or OBSERVABILITY_PROVIDER."
        : "Telemetry provider is optional outside production.",
      options.profile === "production" && options.strict,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "observability-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "observability-check",
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    strict: options.strict,
    passed: failed.length === 0,
    failedRequired: failed.map((item) => item.name),
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n observability check");
    console.log(`Profile: ${options.profile}`);
    console.log(`Strict: ${options.strict ? "yes" : "no"}`);
    console.log(`Report: ${reportPath}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.status}`);
      if (item.status !== "passed") {
        console.log(`  ${item.message}`);
      }
    }
    console.log("");
    console.log(`Result: ${failed.length === 0 ? "PASS" : "FAIL"}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main();
