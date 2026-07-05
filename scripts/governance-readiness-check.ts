import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type GovernanceCheck = {
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
  return path.join(process.cwd(), "docs", "api", "evidence", "governance", dateStamp());
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
): GovernanceCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function buildChecks(options: Options): GovernanceCheck[] {
  return [
    check(
      "infrastructure ownership",
      fileContains("infra/README.md", [
        /Infrastructure as Code/i,
        /environment/i,
        /review/i,
        /owner/i,
      ]),
      "Infrastructure documentation should define IaC ownership, environment boundaries, and review rules.",
    ),
    check(
      "governance runbook",
      fileContains("docs/DevOps/governance-runbook.md", [
        /operational review/i,
        /access review/i,
        /secret rotation/i,
        /threat model/i,
      ]),
      "Governance runbook should cover operational reviews, access reviews, secret rotation, and threat model refresh.",
    ),
    check(
      "operational review template",
      fileContains("docs/DevOps/operational-review-template.md", [
        /SLO/i,
        /error budget/i,
        /action items/i,
        /owner/i,
      ]),
      "Operational review template should include SLOs, error budget review, action items, and owners.",
    ),
    check(
      "access review template",
      fileContains("docs/DevOps/access-review-template.md", [
        /GitHub/i,
        /Vercel/i,
        /database/i,
        /least privilege/i,
      ]),
      "Access review template should cover GitHub, Vercel, database access, and least privilege.",
    ),
    check(
      "error budget policy",
      fileContains("docs/DevOps/error-budget-policy.md", [
        /SLO/i,
        /error budget/i,
        /release freeze/i,
        /rollback/i,
      ]),
      "Error budget policy should define SLOs, freeze behavior, and rollback expectations.",
    ),
    check(
      "release calendar",
      fileContains("docs/DevOps/release-calendar.md", [
        /Release calendar/i,
        /freeze/i,
        /hotfix/i,
        /owner/i,
      ]),
      "Release calendar should define normal release windows, freezes, hotfixes, and ownership.",
    ),
    check(
      "quarterly governance checklist",
      fileContains("docs/DevOps/quarterly-governance-checklist.md", [
        /restore drill/i,
        /secret rotation/i,
        /access review/i,
        /threat model/i,
      ]),
      "Quarterly checklist should include restore drill, secret rotation, access review, and threat model refresh.",
    ),
    check(
      "release checklist governance coverage",
      fileContains("docs/DevOps/release-checklist.md", [
        /governance:check/,
        /environment:drift:check/,
        /governance/i,
      ]),
      "Release checklist should include governance and drift detection checks.",
    ),
    check(
      "governance workflow",
      fileContains(".github/workflows/governance.yml", [
        /governance:check/,
        /environment:drift:check/,
        /governance/,
      ]),
      "Governance workflow should run readiness and environment drift checks.",
      options.strict,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "governance-readiness-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "governance-readiness-check",
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
    console.log("a8n governance readiness check");
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
