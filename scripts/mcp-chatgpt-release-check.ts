import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

type CheckResult = {
  name: string;
  command: string;
  status: "passed" | "failed";
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    live: args.has("--live"),
    allowDevHosts: args.has("--allow-dev-hosts"),
    allowMissingEvidence: args.has("--allow-missing-evidence"),
    allowOpenCritical: args.has("--allow-open-critical"),
  };
}

function tsxCli() {
  return path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
}

function runScript(name: string, scriptPath: string, scriptArgs: string[]): CheckResult {
  const spawnArgs = [tsxCli(), scriptPath, ...scriptArgs];
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
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    stdout: result.stdout?.trim(),
    stderr: result.error ? result.error.message : result.stderr?.trim(),
  };
}

function main() {
  const options = parseArgs();
  const phase6Args = ["--json"];
  if (options.live) phase6Args.push("--live");

  const phase7Args = ["--json"];
  if (options.allowDevHosts) phase7Args.push("--allow-dev-hosts");

  const phase8Args = ["--json"];
  if (options.allowDevHosts) phase8Args.push("--allow-dev-hosts");
  if (options.allowMissingEvidence) phase8Args.push("--allow-missing-evidence");

  const phase9Args = ["--json"];
  if (options.allowOpenCritical) phase9Args.push("--allow-open-critical");

  const checks = [
    runScript("phase 6 tests and evals", "scripts/mcp-chatgpt-full-check.ts", phase6Args),
    runScript("phase 7 production readiness", "scripts/mcp-production-readiness-check.ts", phase7Args),
    runScript("phase 8 submission readiness", "scripts/mcp-submission-check.ts", phase8Args),
    runScript("phase 9 rollout maintenance", "scripts/mcp-rollout-check.ts", phase9Args),
  ];
  const passed = checks.every((item) => item.status === "passed");
  const report = {
    suite: "chatgpt-app-release-check",
    generatedAt: new Date().toISOString(),
    liveChecksRequested: options.live,
    passed,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT Apps release check");
    console.log(`Live checks: ${options.live ? "enabled" : "skipped"}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.status}`);
      if (item.status === "failed" && item.stderr) {
        console.log(`  ${item.stderr.split("\n")[0]}`);
      }
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
