import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type PerformanceCheck = {
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

type BudgetNumber = {
  value: number;
  unit: string;
};

type PerformanceBudgets = {
  api: Record<string, BudgetNumber>;
  webhooks: Record<string, BudgetNumber>;
  workflowExecution: Record<string, BudgetNumber>;
  frontend: Record<string, BudgetNumber>;
  cost: Record<string, BudgetNumber>;
};

const BUDGET_PATH = "docs/DevOps/performance-budgets.json";

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
  return path.join(process.cwd(), "docs", "api", "evidence", "performance", dateStamp());
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
): PerformanceCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function isBudgetNumber(value: unknown): value is BudgetNumber {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.value === "number" &&
    Number.isFinite(record.value) &&
    record.value >= 0 &&
    typeof record.unit === "string" &&
    record.unit.length > 0
  );
}

function readBudgets(): PerformanceBudgets | null {
  const fullPath = path.join(process.cwd(), BUDGET_PATH);
  if (!fs.existsSync(fullPath)) return null;

  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const requiredSections = ["api", "webhooks", "workflowExecution", "frontend", "cost"];
  for (const section of requiredSections) {
    const sectionValue = record[section];
    if (!sectionValue || typeof sectionValue !== "object" || Array.isArray(sectionValue)) {
      return null;
    }

    const entries = Object.values(sectionValue as Record<string, unknown>);
    if (entries.length === 0 || !entries.every(isBudgetNumber)) return null;
  }

  return record as PerformanceBudgets;
}

function budgetSummary(budgets: PerformanceBudgets | null) {
  if (!budgets) return null;
  return {
    api: Object.keys(budgets.api),
    webhooks: Object.keys(budgets.webhooks),
    workflowExecution: Object.keys(budgets.workflowExecution),
    frontend: Object.keys(budgets.frontend),
    cost: Object.keys(budgets.cost),
  };
}

function buildChecks(options: Options): PerformanceCheck[] {
  const budgets = readBudgets();

  return [
    check(
      "performance budgets",
      budgets !== null,
      "Performance budgets should exist and define numeric API, webhook, workflow, frontend, and cost thresholds.",
      true,
      budgetSummary(budgets),
    ),
    check(
      "API load test",
      fileContains("tests/load/api.k6.js", [/BASE_URL/, /http/, /not 5xx/i]),
      "API k6 load test should exist and check that backend endpoints avoid 5xx responses.",
    ),
    check(
      "webhook burst test",
      fileContains("tests/load/webhooks.k6.js", [/WEBHOOK/, /payload/, /not 5xx/i]),
      "Webhook k6 load test should exist and model burst traffic without expecting production secrets in PR CI.",
    ),
    check(
      "workflow execution load test",
      fileContains("tests/load/workflow-execution.k6.js", [/WORKFLOW_ID/, /MCP_BEARER_TOKEN/, /not 5xx/i]),
      "Workflow execution k6 test should exist with explicit workflow id and token controls.",
    ),
    check(
      "performance runbook",
      fileContains("docs/DevOps/performance-runbook.md", [
        /load test/i,
        /budget/i,
        /p95/i,
        /rollback/i,
      ]),
      "Performance runbook should cover load tests, budgets, p95 guardrails, and rollback conditions.",
    ),
    check(
      "cost control runbook",
      fileContains("docs/DevOps/cost-control-runbook.md", [
        /budget/i,
        /AI/i,
        /database/i,
        /review/i,
      ]),
      "Cost control runbook should cover budget ownership, AI/provider cost, database cost, and review cadence.",
    ),
    check(
      "slow query review template",
      fileContains("docs/DevOps/slow-query-review-template.md", [
        /query/i,
        /EXPLAIN/i,
        /index/i,
        /owner/i,
      ]),
      "Slow query review template should exist for database performance reviews.",
    ),
    check(
      "performance workflow",
      fileContains(".github/workflows/performance-nightly.yml", [
        /performance:check/,
        /load:api/,
        /performance/,
      ]),
      "Performance workflow should run readiness checks and staged load-test commands.",
      options.strict,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "performance-readiness-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "performance-readiness-check",
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
    console.log("a8n performance readiness check");
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
