import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type ReadinessCheck = {
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
  return path.join(process.cwd(), "docs", "api", "evidence", "incidents", dateStamp());
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
): ReadinessCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function buildChecks(options: Options): ReadinessCheck[] {
  return [
    check(
      "incident response runbook",
      fileContains("docs/DevOps/incident-response-runbook.md", [
        /SEV1/i,
        /incident commander/i,
        /communication/i,
        /postmortem/i,
      ]),
      "Incident response runbook should define severity, roles, communication, and postmortems.",
    ),
    check(
      "incident template",
      fileContains("docs/DevOps/incidents/incident-template.md", [
        /severity/i,
        /commander/i,
        /timeline/i,
        /customer impact/i,
      ]),
      "Incident template should capture severity, commander, timeline, and customer impact.",
    ),
    check(
      "postmortem template",
      fileContains("docs/DevOps/incidents/postmortem-template.md", [
        /root cause/i,
        /impact/i,
        /action items/i,
        /follow-up/i,
      ]),
      "Postmortem template should capture root cause, impact, action items, and follow-up ownership.",
    ),
    check(
      "rollback runbook",
      fileContains("docs/DevOps/rollback-runbook.md", [
        /feature flag/i,
        /deployment rollback/i,
        /database/i,
        /validation/i,
      ]),
      "Rollback runbook should cover feature flags, deployment rollback, database decisions, and validation.",
    ),
    check(
      "secret leak runbook",
      fileContains("docs/DevOps/secret-leak-runbook.md", [
        /revoke/i,
        /rotate/i,
        /audit/i,
        /notify/i,
      ]),
      "Secret leak runbook should cover revoke, rotate, audit, and notification steps.",
    ),
    check(
      "incident issue template",
      fileContains(".github/ISSUE_TEMPLATE/incident.md", [
        /Severity/i,
        /Timeline/i,
        /Owner/i,
      ]),
      "GitHub incident issue template should exist for tracking incidents.",
      options.strict,
    ),
    check(
      "release checklist incident coverage",
      fileContains("docs/DevOps/release-checklist.md", [
        /incident:check/,
        /restore:drill:check/,
        /Rollback Decision/,
      ]),
      "Release checklist should include incident readiness, restore readiness, and rollback decision checks.",
    ),
    check(
      "production workflow incident gate",
      fileContains(".github/workflows/production-deploy.yml", [/incident:check/, /restore:drill:check/]),
      "Production deploy workflow should run incident and restore readiness checks.",
      options.strict,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "incident-readiness-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "incident-readiness-check",
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
    console.log("a8n incident readiness check");
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
