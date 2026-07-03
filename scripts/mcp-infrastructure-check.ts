import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getMcpBackupRestoreManifest } from "../src/mcp/maintenance/production-maintenance";

type Severity = "required" | "recommended";

type Check = {
  name: string;
  ok: boolean;
  severity: Severity;
  detail?: unknown;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    strict: args.has("--strict"),
  };
}

function check(name: string, ok: boolean, severity: Severity = "required", detail?: unknown): Check {
  return { name, ok, severity, detail };
}

function fileExists(...segments: string[]) {
  return fs.existsSync(path.join(process.cwd(), ...segments));
}

function readSource(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

function lockfileHash() {
  const lockfile = path.join(process.cwd(), "pnpm-lock.yaml");
  if (!fs.existsSync(lockfile)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(lockfile)).digest("hex");
}

function migrationDirectories() {
  const root = path.join(process.cwd(), "prisma", "migrations");
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function collectSecretCandidates() {
  const roots = ["src", "scripts", "prisma"];
  const findings: Array<{ file: string; line: number; pattern: string }> = [];
  const patterns: Array<[string, RegExp]> = [
    ["openai-key", /\bsk-(?:live|test|proj)-[A-Za-z0-9_-]{20,}\b/g],
    ["mcp-key", /\ba8n_mcp_[A-Za-z0-9._-]{20,}\b/g],
    ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/gi],
    ["private-key", /-----BEGIN [^-]+PRIVATE KEY-----/g],
  ];
  const fixtureAllowlist = [
    /^Bearer should-not-survive-in-output$/i,
    /^Bearer super-secret-token-1234567890$/i,
  ];

  function lineNumber(text: string, index: number) {
    return text.slice(0, index).split(/\r?\n/).length;
  }

  function isAllowedFixture(value: string) {
    return fixtureAllowlist.some((pattern) => pattern.test(value));
  }

  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".next", "src/generated"].some((skip) => fullPath.includes(skip))) continue;
        visit(fullPath);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|sql|prisma|json|md|yml|yaml)$/.test(entry.name)) continue;
      const text = fs.readFileSync(fullPath, "utf8");
      for (const [name, pattern] of patterns) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
          const value = match[0];
          if (isAllowedFixture(value)) continue;
          findings.push({
            file: path.relative(process.cwd(), fullPath),
            line: lineNumber(text, match.index || 0),
            pattern: name,
          });
          break;
        }
      }
    }
  }

  for (const root of roots) {
    const fullRoot = path.join(process.cwd(), root);
    if (fs.existsSync(fullRoot)) visit(fullRoot);
  }

  return findings;
}

function licenseCoverage() {
  const pkg = JSON.parse(readSource("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  let checked = 0;
  let withLicense = 0;
  const missing: string[] = [];

  for (const dep of deps) {
    const packagePath = path.join(process.cwd(), "node_modules", dep, "package.json");
    if (!fs.existsSync(packagePath)) continue;
    checked++;
    const depPkg = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { license?: string; licenses?: unknown };
    if (depPkg.license || depPkg.licenses) {
      withLicense++;
    } else {
      missing.push(dep);
    }
  }

  return {
    checked,
    withLicense,
    missing: missing.slice(0, 20),
    coverage: checked === 0 ? 0 : Number((withLicense / checked).toFixed(3)),
  };
}

function main() {
  const options = parseArgs();
  const schema = readSource("prisma", "schema.prisma");
  const rateLimiter = readSource("src", "mcp", "middleware", "rate-limiter.ts");
  const route = readSource("src", "app", "api", "mcp", "route.ts");
  const maintenance = readSource("src", "mcp", "maintenance", "production-maintenance.ts");
  const manifest = getMcpBackupRestoreManifest();
  const migrationNames = migrationDirectories();
  const secretCandidates = collectSecretCandidates();
  const licenses = licenseCoverage();
  const requiredBackupTables = [
    "Workflow",
    "WorkflowDraft",
    "WorkflowVersion",
    "Credential",
    "mcp_oauth_client",
    "mcp_oauth_access_token",
    "mcp_audit_log",
  ];

  const checks = [
    check("Postgres rate-limit bucket model exists", schema.includes("model McpRateLimitBucket")),
    check(
      "distributed rate-limit migration exists",
      migrationNames.includes("20260702120000_mcp_distributed_infrastructure") &&
        readSource("prisma", "migrations", "20260702120000_mcp_distributed_infrastructure", "migration.sql").includes("mcp_rate_limit_bucket"),
    ),
    check(
      "MCP route uses async production rate-limit adapter",
      route.includes("checkRateLimitForRequest") && route.includes("await checkRateLimitForRequest"),
    ),
    check(
      "rate limiter has database and memory backends",
      rateLimiter.includes("checkDatabaseRateLimit") && rateLimiter.includes("backend: \"memory\""),
    ),
    check(
      "maintenance module cleans OAuth, audit, and rate-limit artifacts",
      maintenance.includes("cleanupExpiredOAuthArtifacts") &&
        maintenance.includes("cleanupMcpAuditLogs") &&
        maintenance.includes("cleanupExpiredRateLimitBuckets"),
    ),
    check("maintenance cron route exists", fileExists("src", "app", "api", "cron", "mcp-maintenance", "route.ts")),
    check(
      "backup/restore manifest covers critical MCP tables",
      requiredBackupTables.every((table) => manifest.tables.includes(table as (typeof manifest.tables)[number])),
      "required",
      { tables: manifest.tables },
    ),
    check("rollback plan exists", fileExists("docs", "mcp", "infrastructure", "rollback-plan.md")),
    check("dependency policy exists", fileExists("docs", "mcp", "infrastructure", "dependency-supply-chain-policy.md")),
    check("pnpm lockfile exists", fileExists("pnpm-lock.yaml"), "required", { sha256: lockfileHash() }),
    check("migration folders contain migration.sql", migrationNames.every((name) => fileExists("prisma", "migrations", name, "migration.sql"))),
    check("offline secret scan has no high-confidence findings", secretCandidates.length === 0, "required", {
      findings: secretCandidates,
    }),
    check("dependency license metadata coverage is high", licenses.coverage >= 0.9, options.strict ? "required" : "recommended", licenses),
    check("SBOM evidence folder exists", fileExists("docs", "mcp", "evidence", "sbom"), "recommended"),
  ];

  const requiredFailures = checks.filter((item) => item.severity === "required" && !item.ok);
  const passed = requiredFailures.length === 0;
  const report = {
    suite: "mcp-distributed-infrastructure",
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    passed,
    requiredFailures,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n MCP distributed infrastructure check");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"} (${item.severity})`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
