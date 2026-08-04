import fs from "node:fs";
import path from "node:path";

type CheckStatus = "passed" | "failed" | "warning";

type SecurityCheck = {
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

type SecretFinding = {
  file: string;
  pattern: string;
  line: number;
  sample: string;
};

const SCAN_ROOTS = ["src", "scripts", "tests/load", ".github", "docs/DevOps", "prisma"];
const IGNORED_PARTS = [
  "src/generated",
  "src/agent/__tests__",
  "src/agent/eval",
  "node_modules",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
  "docs/api/evidence",
];

const SECRET_PATTERNS = [
  { name: "OpenAI-style secret", pattern: /\bsk-(?:live|test|proj)-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_]{20,}\b/g },
  { name: "MCP raw API key", pattern: /\ba8n_mcp_[A-Za-z0-9._-]{20,}\b/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{30,}\b/g },
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
  return path.join(process.cwd(), "docs", "api", "evidence", "security", dateStamp());
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}

function fileExists(relativePath: string) {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function readJson(relativePath: string): unknown {
  const fullPath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
}

function readTextIfExists(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function walkFiles(root: string): string[] {
  const absoluteRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files: string[] = [];
  const visit = (current: string) => {
    const relative = normalizePath(path.relative(process.cwd(), current));
    if (IGNORED_PARTS.some((part) => relative.startsWith(part))) return;

    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        visit(path.join(current, entry));
      }
      return;
    }

    if (stat.isFile() && /\.(ts|tsx|js|mjs|cjs|yml|yaml|md|json|prisma|sql)$/.test(current)) {
      files.push(current);
    }
  };

  visit(absoluteRoot);
  return files;
}

function isAllowedSecretSample(sample: string) {
  const allowed = [
    "test-",
    "replace",
    "example",
    "placeholder",
    "${{ secrets.",
    "${{secrets.",
    "REDACTED",
  ];

  return allowed.some((value) => sample.includes(value));
}

function scanSecrets(): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const files = SCAN_ROOTS.flatMap(walkFiles);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const item of SECRET_PATTERNS) {
        item.pattern.lastIndex = 0;
        const matches = line.match(item.pattern) || [];
        for (const match of matches) {
          if (isAllowedSecretSample(match) || isAllowedSecretSample(line)) continue;
          findings.push({
            file: normalizePath(path.relative(process.cwd(), file)),
            pattern: item.name,
            line: lineIndex + 1,
            sample: match.slice(0, 12) + "[REDACTED]",
          });
        }
      }
    }
  }

  return findings;
}

function check(
  name: string,
  passed: boolean,
  message: string,
  required = true,
  details?: unknown,
): SecurityCheck {
  return {
    name,
    status: passed ? "passed" : required ? "failed" : "warning",
    required,
    message,
    details,
  };
}

function hasPackageManagerControls() {
  const pkg = readJson("package.json") as {
    pnpm?: { onlyBuiltDependencies?: string[] };
  };

  if (pkg.pnpm?.onlyBuiltDependencies?.length) return true;

  const workspaceConfig = readTextIfExists("pnpm-workspace.yaml");
  const onlyBuiltDependencies = workspaceConfig.match(
    /(?:^|\n)onlyBuiltDependencies:\s*\n((?:\s+-\s+["']?[^"'\n]+["']?\s*\n?)+)/,
  );

  return Boolean(onlyBuiltDependencies?.[1]?.trim());
}

function buildChecks(options: Options): SecurityCheck[] {
  const secretFindings = scanSecrets();

  return [
    check(
      "security workflow",
      fileExists(".github/workflows/security.yml"),
      "GitHub security workflow exists.",
    ),
    check(
      "dependabot configuration",
      fileExists(".github/dependabot.yml"),
      "Dependabot keeps npm and GitHub Actions dependencies current.",
    ),
    check(
      "supply-chain policy",
      fileExists("docs/DevOps/supply-chain-policy.md"),
      "Supply-chain policy exists.",
    ),
    check(
      "security release checklist",
      fileExists("docs/DevOps/security-release-checklist.md"),
      "Security release checklist exists.",
    ),
    check(
      "threat model",
      fileExists("docs/DevOps/threat-model.md"),
      "Threat model exists for production-sensitive surfaces.",
      options.strict,
    ),
    check(
      "package manager build controls",
      hasPackageManagerControls(),
      "pnpm onlyBuiltDependencies is configured to reduce install-script risk.",
    ),
    check(
      "local secret scan",
      secretFindings.length === 0,
      "No obvious raw secrets were found in source-controlled security scan paths.",
      true,
      secretFindings,
    ),
  ];
}

function writeReport(report: unknown, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "security-release-check.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs();
  const checks = buildChecks(options);
  const failed = checks.filter((item) => item.required && item.status !== "passed");
  const report = {
    suite: "security-release-check",
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
    console.log("a8n security release check");
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
