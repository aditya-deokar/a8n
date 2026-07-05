import fs from "node:fs";
import path from "node:path";
import { featureFlags, experiments, killSwitches } from "../src/config/feature-flags";

type CheckStatus = "passed" | "failed" | "warning";

type FeatureFlagCheck = {
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
  return path.join(process.cwd(), "docs", "api", "evidence", "feature-flags", dateStamp());
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

function check(
  name: string,
  passed: boolean,
  message: string,
  required = true,
  details?: unknown,
): FeatureFlagCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function weightsAreValid() {
  return Object.values(experiments).every((experiment) => {
    const total = experiment.variants.reduce((sum, variant) => sum + variant.weight, 0);
    return total === 100 && experiment.variants.length >= 2;
  });
}

function rolloutEnvNamesAreValid() {
  return Object.values(featureFlags).every((flag) =>
    /^FEATURE_FLAG_[A-Z0-9_]+_ROLLOUT_PERCENT$/.test(flag.rolloutEnv),
  );
}

function experimentOverrideEnvNamesAreValid() {
  return Object.values(experiments).every((experiment) =>
    /^EXPERIMENT_[A-Z0-9_]+_VARIANT$/.test(experiment.variantOverrideEnv),
  );
}

function buildChecks(options: Options): FeatureFlagCheck[] {
  const flagCount = Object.keys(featureFlags).length;
  const killSwitchCount = Object.keys(killSwitches).length;
  const experimentCount = Object.keys(experiments).length;

  return [
    check(
      "feature flag helper",
      fileExists("src/lib/feature-flags.ts"),
      "Server-side feature flag helper exists.",
    ),
    check(
      "feature flag registry",
      flagCount >= 3 && rolloutEnvNamesAreValid(),
      "Feature flag registry should include rollout flags with owners and explicit rollout env names.",
      true,
      { flagCount },
    ),
    check(
      "kill switches",
      killSwitchCount >= 2,
      "Kill-switch registry should include operational emergency controls.",
      true,
      { killSwitchCount },
    ),
    check(
      "experiment registry",
      experimentCount >= 1 && weightsAreValid() && experimentOverrideEnvNamesAreValid(),
      "Experiment registry should include at least one experiment with variants totaling 100 and explicit override env names.",
      true,
      { experimentCount },
    ),
    check(
      "environment template",
      fileContains(".env.example", [
        /FEATURE_FLAGS_ENABLED/,
        /FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT/,
        /EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT/,
        /KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION/,
        /KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING/,
        /KILL_SWITCH_DISABLE_MCP_MUTATIONS/,
      ]),
      ".env.example should document rollout, experiment, and kill-switch variables.",
    ),
    check(
      "workflow execution kill switch wired",
      fileContains("src/inngest/utils.ts", [/assertKillSwitchOff\("disableWorkflowExecution"\)/]),
      "Workflow dispatch should be protected by the workflow execution kill switch.",
    ),
    check(
      "webhook processing kill switch wired",
      fileContains("src/app/api/webhooks/google-form/route.ts", [/disableWebhookProcessing/]) &&
        fileContains("src/app/api/webhooks/stripe/route.ts", [/disableWebhookProcessing/]),
      "Webhook routes should return controlled responses when webhook processing is disabled.",
    ),
    check(
      "MCP mutation kill switch wired",
      fileContains("src/app/api/mcp/route.ts", [
        /disableMcpMutations/,
        /getToolContract/,
        /runtime_guardrail_denial/,
      ]),
      "MCP route should block mutating tools when the MCP mutation kill switch is enabled.",
    ),
    check(
      "feature flag runbook",
      fileContains("docs/DevOps/feature-flag-runbook.md", [
        /kill switch/i,
        /rollout/i,
        /audit/i,
      ]),
      "Feature flag runbook should cover kill switches, rollout, and audit rules.",
    ),
    check(
      "A/B testing runbook",
      fileContains("docs/DevOps/ab-testing-runbook.md", [
        /variant/i,
        /primary metric/i,
        /guardrail/i,
      ]),
      "A/B testing runbook should cover variants, primary metrics, and guardrails.",
    ),
    check(
      "feature flag audit log",
      fileExists("docs/DevOps/feature-flag-audit-log.md"),
      "Feature flag changes should have an audit log template.",
      options.strict,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "feature-flag-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "feature-flag-check",
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    passed: failed.length === 0,
    failedRequired: failed.map((item) => item.name),
    registry: {
      featureFlags: Object.keys(featureFlags),
      killSwitches: Object.keys(killSwitches),
      experiments: Object.keys(experiments),
    },
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n feature flag check");
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
