import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type RestoreCheck = {
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
  return path.join(
    process.cwd(),
    "docs",
    "api",
    "evidence",
    "disaster-recovery",
    dateStamp(),
  );
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
): RestoreCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function buildChecks(options: Options): RestoreCheck[] {
  return [
    check(
      "disaster recovery runbook",
      fileContains("docs/DevOps/disaster-recovery.md", [/RPO/i, /RTO/i, /restore drill/i, /backup/i]),
      "Disaster recovery runbook should define RPO, RTO, backups, and restore drills.",
    ),
    check(
      "database restore runbook",
      fileContains("docs/DevOps/database-restore-runbook.md", [
        /point-in-time/i,
        /staging/i,
        /integrity/i,
        /production approval/i,
      ]),
      "Database restore runbook should cover PITR, staging rehearsal, integrity checks, and production approval.",
    ),
    check(
      "restore drill workflow",
      fileContains(".github/workflows/restore-drill.yml", [
        /workflow_dispatch/,
        /restore:drill:check/,
        /incident:check/,
        /disaster-recovery/,
      ]),
      "Restore drill workflow should run DR readiness checks and upload DR evidence.",
      options.strict,
    ),
    check(
      "backup verification checklist",
      fileContains("docs/DevOps/disaster-recovery.md", [
        /Backup Verification/i,
        /restore point/i,
        /quarterly/i,
      ]),
      "DR runbook should include recurring backup verification and restore point checks.",
    ),
    check(
      "rollback before restore",
      fileContains("docs/DevOps/rollback-runbook.md", [/restore/i, /last resort/i, /roll forward/i]),
      "Rollback runbook should make database restore a last-resort option after safer rollback paths.",
    ),
    check(
      "release checklist restore coverage",
      fileContains("docs/DevOps/release-checklist.md", [
        /restore point/i,
        /restore:drill:check/,
        /disaster recovery/i,
      ]),
      "Release checklist should cover restore readiness and disaster recovery evidence.",
    ),
    check(
      "restore drill evidence path",
      fileExists("docs/DevOps/disaster-recovery.md") &&
        fileContains("docs/DevOps/disaster-recovery.md", [/docs\/api\/evidence\/disaster-recovery/]),
      "Disaster recovery runbook should name the restore drill evidence path.",
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "restore-drill-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "restore-drill-check",
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
    console.log("a8n restore drill check");
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
