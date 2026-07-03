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

let releaseGateCheckTimeoutMs = Number(process.env.MCP_RELEASE_GATE_CHECK_TIMEOUT_MS || 600_000);

function parseArgs() {
  const args = process.argv.slice(2);
  const readValue = (name: string, fallback?: string) => {
    const inline = args.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const flags = new Set(args);
  return {
    json: flags.has("--json"),
    strict: flags.has("--strict"),
    live: flags.has("--live"),
    skipTests: flags.has("--skip-tests"),
    skipLint: flags.has("--skip-lint"),
    allowDevHosts: flags.has("--allow-dev-hosts"),
    profile: readValue("--profile", "chatgpt") || "chatgpt",
    outDir: readValue("--out-dir"),
    checkTimeoutMs: Number(readValue("--check-timeout-ms", String(releaseGateCheckTimeoutMs))),
  };
}

function tsxCli() {
  return path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
}

function prismaCli() {
  return path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
}

function tscCli() {
  return path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");
}

function eslintCli() {
  return path.join(process.cwd(), "node_modules", "eslint", "bin", "eslint.js");
}

function vitestCli() {
  return path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
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
  return path.join(process.cwd(), "docs", "mcp", "evidence", "release-gates", dateStamp());
}

function redact(value: string | undefined) {
  if (!value) return value;
  return value
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
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
    timeout: releaseGateCheckTimeoutMs,
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

function runTsx(
  name: string,
  script: string,
  args: string[] = [],
  required = true,
  env: NodeJS.ProcessEnv = process.env,
) {
  return run(name, [tsxCli(), script, ...args], required, env);
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "mcp-release-gate.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  releaseGateCheckTimeoutMs =
    Number.isFinite(options.checkTimeoutMs) && options.checkTimeoutMs > 0
      ? options.checkTimeoutMs
      : releaseGateCheckTimeoutMs;
  const env = {
    ...process.env,
    MCP_APP_PROFILE: options.profile,
    MCP_CHATGPT_EXPECT_PROFILE: options.profile,
  };
  const productionArgs = ["--json"];
  if (options.allowDevHosts) productionArgs.push("--allow-dev-hosts");

  const checks: GateCheck[] = [
    run("prisma validate", [prismaCli(), "validate", "--schema", "prisma/schema.prisma"], true, env),
    run("typecheck", ["--max-old-space-size=4096", tscCli(), "--noEmit", "--pretty", "false"], true, env),
    runTsx("MCP contract check", "scripts/mcp-contract-check.ts", ["--json"], true, env),
    runTsx("MCP eval", "scripts/mcp-eval.ts", ["--json"], true, env),
    runTsx("MCP safety check", "scripts/mcp-safety-check.ts", ["--json"], true, env),
    runTsx("ChatGPT app eval", "scripts/mcp-chatgpt-app-eval.ts", ["--json"], true, env),
    runTsx("MCP adversarial eval", "scripts/mcp-adversarial-eval.ts", ["--json"], true, env),
    runTsx("MCP observability check", "scripts/mcp-observability-check.ts", ["--json"], true, env),
    runTsx("MCP infrastructure check", "scripts/mcp-infrastructure-check.ts", options.strict ? ["--json", "--strict"] : ["--json"], true, env),
    runTsx("MCP eval trend report", "scripts/mcp-eval-trend-report.ts", ["--json", "--no-write"], true, env),
    runTsx("MCP continuous improvement check", "scripts/mcp-continuous-improvement-check.ts", ["--json"], true, env),
    runTsx("production readiness check", "scripts/mcp-production-readiness-check.ts", productionArgs, true, env),
    runTsx("rollout check", "scripts/mcp-rollout-check.ts", ["--json"], true, env),
  ];

  if (options.skipLint) {
    checks.splice(2, 0, skipped("lint", "Skipped by --skip-lint."));
  } else {
    checks.splice(2, 0, run("lint", [eslintCli(), "."], options.strict, env));
  }

  if (options.skipTests) {
    checks.splice(3, 0, skipped("MCP unit/integration tests", "Skipped by --skip-tests.", options.strict));
  } else {
    checks.splice(
      3,
      0,
      run("MCP unit/integration tests", [vitestCli(), "run", "--config", "vitest.config.mjs", "tests/mcp"], options.strict, env),
    );
  }

  if (options.live) {
    checks.push(runTsx("live MCP eval", "scripts/mcp-live-eval.ts", ["--require-live", "--json"], true, env));
  } else {
    checks.push(skipped("live MCP eval", "Pass --live with staging MCP env vars to run live checks."));
  }

  const failedRequired = checks.filter((check) => check.required && check.status !== "passed");
  const passed = failedRequired.length === 0;
  const report = {
    suite: "mcp-release-gate",
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    strict: options.strict,
    live: options.live,
    checkTimeoutMs: releaseGateCheckTimeoutMs,
    passed,
    failedRequired: failedRequired.map((check) => check.name),
    stopShipCriteria: [
      "No secrets in MCP output, audit logs, widget HTML, or test artifacts.",
      "No cross-tenant reads or writes.",
      "No destructive or external side-effect tool runs without the required approval.",
      "OAuth rejects wrong resource, client, redirect URI, expired token, reused code, and revoked token.",
      "ChatGPT profile does not expose forbidden tools.",
      "Prompt-injection regressions do not trigger unsafe tool calls.",
      "Production CORS is not wildcard.",
      "Audit persistence is enabled in production.",
      "Multi-instance production does not use the in-memory rate limiter.",
    ],
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n MCP release gate");
    console.log(`Profile: ${options.profile}`);
    console.log(`Strict: ${options.strict ? "yes" : "no"}`);
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
