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

let checkTimeoutMs = Number(process.env.API_RELEASE_GATE_CHECK_TIMEOUT_MS || 600_000);

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
    strict: flags.has("--strict"),
    skipLint: flags.has("--skip-lint"),
    skipTests: flags.has("--skip-tests"),
    skipCoverage: flags.has("--skip-coverage"),
    db: flags.has("--db") || process.env.API_DATABASE_TESTS === "true",
    staging: flags.has("--staging") || Boolean(process.env.API_RELEASE_GATE_STAGING_URL),
    stagingUrl: readValue("--staging-url", process.env.API_RELEASE_GATE_STAGING_URL),
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

function tscCli() {
  return cliPath("typescript", "bin", "tsc");
}

function eslintCli() {
  return cliPath("eslint", "bin", "eslint.js");
}

function vitestCli() {
  return cliPath("vitest", "vitest.mjs");
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
  return path.join(process.cwd(), "docs", "api", "evidence", "release-gates", dateStamp());
}

function redact(value: string | undefined) {
  if (!value) return value;

  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_DATABASE_URL]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(ENCRYPTION_KEY|BETTER_AUTH_SECRET|POLAR_ACCESS_TOKEN)=\S+/g, "$1=[REDACTED]")
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
  const reportPath = path.join(outDir, "api-release-gate.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function stagingSmokeCheck(stagingUrl: string | undefined): GateCheck {
  if (!stagingUrl) {
    return skipped(
      "staging smoke check",
      "Set API_RELEASE_GATE_STAGING_URL or pass --staging-url to run staging smoke checks.",
    );
  }

  const started = Date.now();

  return {
    name: "staging smoke check",
    required: false,
    command: `fetch ${stagingUrl.replace(/\/$/, "")}/api/trpc/workflows.getMany?batch=1&input=${encodeURIComponent(
      JSON.stringify({ "0": { json: { page: 1, pageSize: 1, search: "" } } }),
    )}`,
    status: "skipped",
    exitCode: null,
    durationMs: Date.now() - started,
    reason:
      "Staging tRPC smoke checks require authenticated cookies or bearer session fixtures. Keep this gate wired, but run it from CI with project-specific auth bootstrap before making it required.",
  };
}

function main() {
  const options = parseArgs();
  checkTimeoutMs =
    Number.isFinite(options.checkTimeoutMs) && options.checkTimeoutMs > 0
      ? options.checkTimeoutMs
      : checkTimeoutMs;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: "true",
    NODE_ENV: "test" as NodeJS.ProcessEnv["NODE_ENV"],
    NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test",
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-32-characters",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    APP_URL: process.env.APP_URL || "http://127.0.0.1:3000",
    ENCRYPTION_KEY:
      process.env.ENCRYPTION_KEY || "test-api-encryption-key-32-characters",
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN || "test-polar-token",
    MCP_API_KEY_HMAC_SECRET:
      process.env.MCP_API_KEY_HMAC_SECRET || "ci-mcp-api-key-hmac-secret-32-chars",
    MCP_OAUTH_TOKEN_HMAC_SECRET:
      process.env.MCP_OAUTH_TOKEN_HMAC_SECRET || "ci-mcp-oauth-token-hmac-secret-32",
  };

  const checks: GateCheck[] = [
    run("prisma validate", [prismaCli(), "validate", "--schema", "prisma/schema.prisma"], true, env),
    run("typecheck", ["--max-old-space-size=4096", tscCli(), "--noEmit", "--pretty", "false"], true, env),
  ];

  if (options.skipLint) {
    checks.push(skipped("lint", "Skipped by --skip-lint.", options.strict));
  } else {
    checks.push(run("lint", [eslintCli(), "."], options.strict, env));
  }

  if (options.skipTests) {
    checks.push(skipped("API unit and contract tests", "Skipped by --skip-tests.", true));
    checks.push(skipped("API integration, transport, and security tests", "Skipped by --skip-tests.", true));
  } else {
    checks.push(
      run(
        "API unit and contract tests",
        [
          vitestCli(),
          "run",
          "--config",
          "vitest.api.config.mjs",
          "tests/api/unit",
          "tests/api/contract",
        ],
        true,
        env,
      ),
    );
    checks.push(
      run(
        "API integration, transport, and security tests",
        [
          vitestCli(),
          "run",
          "--config",
          "vitest.api.config.mjs",
          "tests/api/integration",
          "tests/api/transport",
          "tests/api/security",
        ],
        true,
        env,
      ),
    );
  }

  if (options.skipCoverage || options.skipTests) {
    checks.push(skipped("API coverage", "Skipped by --skip-coverage or --skip-tests.", options.strict));
  } else {
    checks.push(
      run(
        "API coverage",
        [vitestCli(), "run", "--config", "vitest.api.config.mjs", "--coverage"],
        options.strict,
        env,
      ),
    );
  }

  if (options.db) {
    const dbEnv: NodeJS.ProcessEnv = { ...env, API_DATABASE_TESTS: "true" };
    checks.push(
      run("prisma migrate status", [prismaCli(), "migrate", "status", "--schema", "prisma/schema.prisma"], true, dbEnv),
    );
    checks.push(
      run(
        "API database integrity tests",
        [
          vitestCli(),
          "run",
          "--config",
          "vitest.api.config.mjs",
          "tests/api/integration/database-integrity.test.mjs",
        ],
        true,
        dbEnv,
      ),
    );
  } else {
    checks.push(skipped("prisma migrate status", "Pass --db or set API_DATABASE_TESTS=true."));
    checks.push(skipped("API database integrity tests", "Pass --db or set API_DATABASE_TESTS=true."));
  }

  if (options.staging) {
    checks.push(stagingSmokeCheck(options.stagingUrl));
  } else {
    checks.push(skipped("staging smoke check", "Pass --staging with API_RELEASE_GATE_STAGING_URL."));
  }

  const failedRequired = checks.filter((check) => check.required && check.status !== "passed");
  const passed = failedRequired.length === 0;
  const report = {
    suite: "api-release-gate",
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    db: options.db,
    staging: options.staging,
    checkTimeoutMs,
    passed,
    failedRequired: failedRequired.map((check) => check.name),
    stopShipCriteria: [
      "Anonymous access cannot reach protected or premium procedures.",
      "Free users cannot call premium procedures.",
      "Cross-tenant read or write access cannot succeed.",
      "Raw credential values are never persisted, returned, logged, or stored in artifacts.",
      "Workflow execution dispatch happens only after ownership lookup succeeds.",
      "API key hashes, OAuth token hashes, and raw keys are not exposed by list/read procedures.",
      "Destructive mutations include the authenticated user id in the ownership boundary.",
      "The real test database schema matches committed Prisma migrations.",
    ],
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n internal API release gate");
    console.log(`Strict: ${options.strict ? "yes" : "no"}`);
    console.log(`DB checks: ${options.db ? "enabled" : "skipped"}`);
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
