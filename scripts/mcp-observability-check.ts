import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateMcpAlertRules,
  getMcpDashboardSpecs,
  getMcpObservabilitySnapshot,
  getMcpRuntimeFeatureFlags,
  recordMcpRuntimeEvent,
  resetMcpObservabilityForTests,
} from "../src/mcp/observability/runtime-guardrails";

type Check = {
  name: string;
  ok: boolean;
  detail?: unknown;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return { json: args.has("--json") };
}

function check(name: string, ok: boolean, detail?: unknown): Check {
  return { name, ok, detail };
}

function readSource(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

function main() {
  const options = parseArgs();
  resetMcpObservabilityForTests();

  recordMcpRuntimeEvent({
    type: "tool_call",
    tool: "list_workflows",
    risk: "read_only",
    profile: "chatgpt",
    status: "success",
    durationMs: 42,
  });
  recordMcpRuntimeEvent({
    type: "prompt_injection_warning",
    status: "warning",
    count: 1,
    error: "ignore-instructions",
  });

  const snapshot = getMcpObservabilitySnapshot();
  const dashboards = getMcpDashboardSpecs();
  const alerts = evaluateMcpAlertRules();
  const flags = getMcpRuntimeFeatureFlags();
  const errorBoundarySource = readSource("src", "mcp", "middleware", "error-boundary.ts");
  const auditSource = readSource("src", "mcp", "middleware", "audit-logger.ts");
  const sanitizeSource = readSource("src", "mcp", "shared", "sanitize.ts");

  const checks = [
    check("observability snapshot records tool calls", snapshot.metrics.toolCallCount >= 1, {
      toolCallCount: snapshot.metrics.toolCallCount,
    }),
    check(
      "observability snapshot records prompt-injection warnings",
      snapshot.metrics.promptInjectionWarningCount >= 1,
      { promptInjectionWarningCount: snapshot.metrics.promptInjectionWarningCount },
    ),
    check(
      "alert rules cover required production signals",
      [
        "mcp-auth-failure-spike",
        "mcp-scope-denial-spike",
        "mcp-prompt-injection-spike",
        "mcp-approval-bypass-attempts",
        "mcp-tool-error-rate",
        "mcp-rate-limit-saturation",
        "mcp-oauth-token-errors",
        "mcp-audit-persistence-failed",
      ].every((id) => alerts.some((alert) => alert.id === id)),
      { alertIds: alerts.map((alert) => alert.id) },
    ),
    check("dashboard specs cover six operator views", dashboards.length >= 6, {
      dashboardIds: dashboards.map((dashboard) => dashboard.id),
    }),
    check(
      "runtime feature flags are exposed",
      Object.keys(flags).length === 5 &&
        "disableSideEffectTools" in flags &&
        "forceReadOnlyChatGptProfile" in flags,
      flags,
    ),
    check(
      "central tool guardrail is wired into error boundary",
      errorBoundarySource.includes("assertMcpRuntimeGuardrailForTool(toolName)"),
    ),
    check(
      "audit logger emits observability events",
      auditSource.includes("recordMcpRuntimeEvent") &&
        auditSource.includes("inferRuntimeEventType"),
    ),
    check(
      "sanitizer emits prompt-injection warning events",
      sanitizeSource.includes('type: "prompt_injection_warning"'),
    ),
  ];

  const passed = checks.every((item) => item.ok);
  const report = {
    suite: "mcp-observability-runtime-guardrails",
    generatedAt: new Date().toISOString(),
    passed,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n MCP observability check");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
