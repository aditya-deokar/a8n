import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Severity = "info" | "warning" | "failure";

type Finding = {
  severity: Severity;
  ruleId: string;
  migration: string;
  line: number;
  message: string;
  evidence: string;
  recommendation: string;
};

type CommandCheck = {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  reason?: string;
};

type Options = {
  json: boolean;
  db: boolean;
  strict: boolean;
  changedOnly: boolean;
  baseRef: string;
  outDir?: string;
};

type SqlRule = {
  ruleId: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  recommendation: string;
  skip?: (line: string) => boolean;
};

type MigrationFile = {
  absolutePath: string;
  relativePath: string;
};

const destructiveRules: SqlRule[] = [
  {
    ruleId: "DB_DROP_TABLE",
    severity: "failure",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "Migration drops a table.",
    recommendation:
      "Use expand-contract: stop reads/writes first, back up data, verify no consumers remain, then remove the table in a later release.",
  },
  {
    ruleId: "DB_DROP_COLUMN",
    severity: "failure",
    pattern: /\bDROP\s+COLUMN\b/i,
    message: "Migration drops a column.",
    recommendation:
      "Keep the column during the expand phase, deploy compatible app code, backfill or drain reads, then remove it in a later contract migration.",
  },
  {
    ruleId: "DB_TRUNCATE",
    severity: "failure",
    pattern: /\bTRUNCATE\b/i,
    message: "Migration truncates data.",
    recommendation:
      "Do not truncate production data from a schema migration. Move this to an audited data migration with backup and explicit approval.",
  },
  {
    ruleId: "DB_DELETE_WITHOUT_WHERE",
    severity: "failure",
    pattern: /^\s*DELETE\s+FROM\b(?!.*\bWHERE\b)/i,
    message: "Migration deletes rows without an inline WHERE clause.",
    recommendation:
      "Use a reviewed data migration with a bounded WHERE clause, batch size, backup, and rollback or roll-forward plan.",
  },
  {
    ruleId: "DB_UPDATE_WITHOUT_WHERE",
    severity: "failure",
    pattern: /^\s*UPDATE\b(?!.*\bWHERE\b)/i,
    message: "Migration updates rows without an inline WHERE clause.",
    recommendation:
      "Use a reviewed backfill with a bounded WHERE clause or batching strategy. Avoid unbounded production updates inside schema migrations.",
    skip: (line) => /\bON\s+CONFLICT\b|\bDO\s+UPDATE\b/i.test(line),
  },
];

const reviewRules: SqlRule[] = [
  {
    ruleId: "DB_PRISMA_WARNING",
    severity: "warning",
    pattern: /Warnings:/i,
    message: "Prisma generated a migration warning.",
    recommendation:
      "Read the generated warning and document why the migration is safe for current production data.",
  },
  {
    ruleId: "DB_ADD_REQUIRED_COLUMN",
    severity: "warning",
    pattern: /\bADD\s+COLUMN\b.*\bNOT\s+NULL\b(?!.*\bDEFAULT\b)/i,
    message: "Migration adds a required column without a default.",
    recommendation:
      "Prefer expand-contract: add the column nullable or with a safe default, backfill, then enforce NOT NULL in a later migration.",
  },
  {
    ruleId: "DB_SET_NOT_NULL",
    severity: "warning",
    pattern: /\bSET\s+NOT\s+NULL\b/i,
    message: "Migration adds a NOT NULL constraint.",
    recommendation:
      "Verify existing rows are backfilled and the check has been rehearsed on staging data before production.",
  },
  {
    ruleId: "DB_CREATE_UNIQUE_INDEX",
    severity: "warning",
    pattern: /\bCREATE\s+UNIQUE\s+INDEX\b/i,
    message: "Migration creates a unique index.",
    recommendation:
      "Verify duplicate production data cannot exist. For large tables, consider a concurrent index workflow outside a transaction.",
  },
  {
    ruleId: "DB_CREATE_INDEX_NON_CONCURRENT",
    severity: "info",
    pattern: /\bCREATE\s+INDEX\b(?!.*\bCONCURRENTLY\b)/i,
    message: "Migration creates a non-concurrent index.",
    recommendation:
      "For large production tables, consider a concurrent index migration plan to reduce write locking.",
  },
  {
    ruleId: "DB_ENUM_VALUE",
    severity: "warning",
    pattern: /\bALTER\s+TYPE\b.*\bADD\s+VALUE\b/i,
    message: "Migration changes a PostgreSQL enum.",
    recommendation:
      "Ensure old and new app versions tolerate the enum value. Removing enum values later is not a simple rollback.",
  },
  {
    ruleId: "DB_RENAME",
    severity: "warning",
    pattern: /\bRENAME\s+(COLUMN|TABLE)\b/i,
    message: "Migration renames a table or column.",
    recommendation:
      "Prefer add-copy-read-switch-drop so old and new deployments can run safely during rollout.",
  },
  {
    ruleId: "DB_DROP_CONSTRAINT",
    severity: "warning",
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    message: "Migration drops a database constraint.",
    recommendation:
      "Document why the constraint can be removed and how data integrity is protected during rollback.",
  },
];

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
  const defaultBaseRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/main";
  const baseRef =
    readArgValue("--base-ref", defaultBaseRef) ||
    defaultBaseRef;

  return {
    json: flags.has("--json"),
    db: flags.has("--db"),
    strict: flags.has("--strict") || flags.has("--fail-on-warnings"),
    changedOnly: flags.has("--changed-only"),
    baseRef,
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
  return path.join(process.cwd(), "docs", "api", "evidence", "migrations", dateStamp());
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}

function listAllMigrations(): MigrationFile[] {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) return [];

  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDir, entry.name, "migration.sql"))
    .filter((migrationPath) => fs.existsSync(migrationPath))
    .sort((left, right) => left.localeCompare(right))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: normalizePath(path.relative(process.cwd(), absolutePath)),
    }));
}

function listChangedMigrations(baseRef: string): {
  migrations: MigrationFile[];
  check: CommandCheck;
} {
  const started = Date.now();
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=AMRT", `${baseRef}...HEAD`, "--", "prisma/migrations"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  const check: CommandCheck = {
    name: "changed migration discovery",
    command: `git diff --name-only --diff-filter=AMRT ${baseRef}...HEAD -- prisma/migrations`,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - started,
    stdout: result.stdout?.trim(),
    stderr: result.error ? result.error.message : result.stderr?.trim(),
  };

  if (result.status !== 0) {
    return { migrations: [], check };
  }

  const migrations = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("/migration.sql") || line.endsWith("\\migration.sql"))
    .map((relativePath) => path.join(process.cwd(), relativePath))
    .filter((migrationPath) => fs.existsSync(migrationPath))
    .sort((left, right) => left.localeCompare(right))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: normalizePath(path.relative(process.cwd(), absolutePath)),
    }));

  return { migrations, check };
}

function findLineNumber(sql: string, index: number) {
  return sql.slice(0, index).split(/\r?\n/).length;
}

function scanWithRules(
  migration: MigrationFile,
  sql: string,
  rules: SqlRule[],
): Finding[] {
  const findings: Finding[] = [];
  const lines = sql.split(/\r?\n/);

  for (const rule of rules) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (rule.skip?.(line)) continue;
      if (!rule.pattern.test(line)) continue;

      findings.push({
        severity: rule.severity,
        ruleId: rule.ruleId,
        migration: migration.relativePath,
        line: index + 1,
        message: rule.message,
        evidence: line.trim().slice(0, 500),
        recommendation: rule.recommendation,
      });
    }
  }

  return findings;
}

function scanSql(migration: MigrationFile): Finding[] {
  const sql = fs.readFileSync(migration.absolutePath, "utf8");
  const findings = [
    ...scanWithRules(migration, sql, destructiveRules),
    ...scanWithRules(migration, sql, reviewRules),
  ];

  const alterColumnTypeMatch = /\bALTER\s+TABLE\b[\s\S]{0,500}\bALTER\s+COLUMN\b[\s\S]{0,500}\bTYPE\b/i.exec(sql);
  if (alterColumnTypeMatch?.index !== undefined) {
    findings.push({
      severity: "warning",
      ruleId: "DB_ALTER_COLUMN_TYPE",
      migration: migration.relativePath,
      line: findLineNumber(sql, alterColumnTypeMatch.index),
      message: "Migration changes a column type.",
      evidence: alterColumnTypeMatch[0].replace(/\s+/g, " ").slice(0, 500),
      recommendation:
        "Verify rewrite/lock impact on staging data and prefer a new-column backfill when the table can be large.",
    });
  }

  return findings;
}

function prismaCli() {
  return path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
}

function redact(value: string | undefined) {
  if (!value) return value;

  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_DATABASE_URL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .slice(0, 20_000);
}

function runPrismaMigrateStatus(): CommandCheck {
  const started = Date.now();
  const args = [prismaCli(), "migrate", "status", "--schema", "prisma/schema.prisma"];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    timeout: Number(process.env.MIGRATION_PREFLIGHT_TIMEOUT_MS || 600_000),
  });

  return {
    name: "prisma migrate status",
    command: `${process.execPath} ${args.join(" ")}`,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - started,
    stdout: redact(result.stdout?.trim()),
    stderr: redact(result.error ? result.error.message : result.stderr?.trim()),
  };
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "migration-preflight.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function summarizeFindings(findings: Finding[], severity: Severity) {
  return findings.filter((finding) => finding.severity === severity).length;
}

function main() {
  const options = parseArgs();
  const discovery = options.changedOnly ? listChangedMigrations(options.baseRef) : undefined;
  const migrations = options.changedOnly ? discovery?.migrations || [] : listAllMigrations();
  const findings = migrations.flatMap(scanSql);
  const checks: CommandCheck[] = [];

  if (discovery) {
    checks.push(discovery.check);
  }

  if (options.db) {
    checks.push(runPrismaMigrateStatus());
  } else {
    checks.push({
      name: "prisma migrate status",
      command: "",
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      reason: "Pass --db when DATABASE_URL points at a disposable CI/staging database.",
    });
  }

  const failureCount = summarizeFindings(findings, "failure");
  const warningCount = summarizeFindings(findings, "warning");
  const failedChecks = checks.filter((check) => check.status === "failed");
  const passed =
    failureCount === 0 &&
    failedChecks.length === 0 &&
    (!options.strict || warningCount === 0);

  const report = {
    suite: "database-migration-preflight",
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    changedOnly: options.changedOnly,
    baseRef: options.baseRef,
    db: options.db,
    migrationsScanned: migrations.map((migration) => migration.relativePath),
    summary: {
      failures: failureCount,
      warnings: warningCount,
      info: summarizeFindings(findings, "info"),
      failedChecks: failedChecks.map((check) => check.name),
    },
    passed,
    stopShipCriteria: [
      "Migration drops a table or column without a documented expand-contract plan.",
      "Migration deletes, truncates, or rewrites production data without bounded review.",
      "Migration status reports schema drift or unapplied migrations in the target environment.",
      "Production migration lacks backup or restore-point confirmation.",
      "Old and new application versions cannot both run safely during rollout.",
    ],
    checks,
    findings,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir());

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n database migration preflight");
    console.log(`Mode: ${options.changedOnly ? "changed migrations" : "all migrations"}`);
    console.log(`Strict: ${options.strict ? "yes" : "no"}`);
    console.log(`DB status: ${options.db ? "enabled" : "skipped"}`);
    console.log(`Report: ${reportPath}`);
    console.log("");
    console.log(`Migrations scanned: ${migrations.length}`);
    console.log(`Failures: ${failureCount}`);
    console.log(`Warnings: ${warningCount}`);
    console.log(`Info: ${summarizeFindings(findings, "info")}`);
    for (const check of checks) {
      console.log(`- ${check.name}: ${check.status}`);
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
