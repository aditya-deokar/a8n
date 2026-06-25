import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

type CheckResult = {
  name: string;
  command: string;
  required: boolean;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  reason?: string;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    live: args.has("--live") || process.env.MCP_CHATGPT_FULL_CHECK_LIVE === "true",
  };
}

function tsxCli() {
  return path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
}

function hasBearerToken() {
  return Boolean(
    process.env.MCP_CHATGPT_DEV_TOKEN ||
      process.env.MCP_API_KEY ||
      process.env.A8N_MCP_API_KEY,
  );
}

function runScript(
  name: string,
  scriptPath: string,
  args: string[],
  required: boolean,
): CheckResult {
  const commandArgs = [scriptPath, ...args];
  const spawnArgs = [tsxCli(), ...commandArgs];
  const command = `${process.execPath} ${spawnArgs.join(" ")}`;
  const result = spawnSync(process.execPath, spawnArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      MCP_CHATGPT_EXPECT_PROFILE:
        process.env.MCP_CHATGPT_EXPECT_PROFILE || "chatgpt",
    },
  });

  return {
    name,
    command,
    required,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdout: result.stdout?.trim(),
    stderr: result.error
      ? result.error.message
      : result.stderr?.trim(),
  };
}

function skipped(name: string, reason: string): CheckResult {
  return {
    name,
    command: "",
    required: false,
    status: "skipped",
    exitCode: null,
    reason,
  };
}

function main() {
  const options = parseArgs();
  const checks: CheckResult[] = [
    runScript("phase 5 safety policy", "scripts/mcp-safety-check.ts", ["--json"], true),
    runScript("phase 6 app evals", "scripts/mcp-chatgpt-app-eval.ts", ["--json"], true),
  ];

  if (options.live) {
    checks.push(
      runScript(
        "phase 4 OAuth metadata and challenge",
        "scripts/mcp-chatgpt-oauth-check.ts",
        ["--json"],
        true,
      ),
    );

    if (hasBearerToken()) {
      checks.push(
        runScript(
          "phase 2/3 live MCP tools and widgets",
          "scripts/mcp-chatgpt-phase1-check.ts",
          ["--json"],
          true,
        ),
      );
    } else {
      checks.push(
        skipped(
          "phase 2/3 live MCP tools and widgets",
          "Set MCP_CHATGPT_DEV_TOKEN, MCP_API_KEY, or A8N_MCP_API_KEY to run authenticated live checks.",
        ),
      );
    }
  } else {
    checks.push(
      skipped(
        "live OAuth and MCP checks",
        "Pass --live after starting the app and configuring MCP_CHATGPT_DEV_URL plus MCP_CHATGPT_DEV_TOKEN.",
      ),
    );
  }

  const failedRequired = checks.filter(
    (check) => check.required && check.status !== "passed",
  );
  const passed = failedRequired.length === 0;
  const report = {
    suite: "chatgpt-app-phase-6-full-check",
    generatedAt: new Date().toISOString(),
    liveChecksRequested: options.live,
    passed,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT Apps Phase 6 full check");
    console.log(`Live checks: ${options.live ? "enabled" : "skipped"}`);
    console.log("");
    for (const check of checks) {
      const suffix = check.status === "skipped" ? ` (${check.reason})` : "";
      console.log(`- ${check.name}: ${check.status}${suffix}`);
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
