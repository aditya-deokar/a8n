import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { ADVERSARIAL_CASES } from "../src/mcp/evals/adversarial";

type EvalPoint = {
  file: string;
  suite: string;
  generatedAt: string | null;
  passed: boolean | null;
  passRate: number | null;
  averageScore: number | null;
  failedRequired: string[];
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const outDirArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--out-dir="));
  return {
    json: args.has("--json"),
    noWrite: args.has("--no-write"),
    outDir: outDirArg?.split("=").slice(1).join("="),
  };
}

function evidenceRoot() {
  return path.join(process.cwd(), "docs", "mcp", "evidence");
}

function defaultOutDir() {
  return path.join(evidenceRoot(), "eval-dashboard");
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];

  function visit(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.name.endsWith(".json")) files.push(fullPath);
    }
  }

  visit(dir);
  return files.sort();
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function extractFailedRequired(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && "name" in item) {
      const name = (item as { name?: unknown }).name;
      return typeof name === "string" ? [name] : [];
    }
    return [];
  });
}

function parseEvalPoint(file: string): EvalPoint | null {
  if (file.includes(`${path.sep}eval-dashboard${path.sep}`)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const suite =
      typeof parsed.suite === "string"
        ? parsed.suite
        : typeof parsed.phase === "string"
          ? parsed.phase
          : path.basename(file, ".json");
    const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
    const checkPassRate =
      checks.length > 0
        ? checks.filter((check) => (check as { ok?: unknown; status?: unknown }).ok === true || (check as { status?: unknown }).status === "passed").length /
          checks.length
        : null;

    return {
      file: path.relative(process.cwd(), file),
      suite,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      passed: toBoolean(parsed.passed),
      passRate: toNumber(parsed.passRate) ?? checkPassRate,
      averageScore: toNumber(parsed.averageScore),
      failedRequired: extractFailedRequired(parsed.failedRequired),
    };
  } catch {
    return null;
  }
}

function trend(points: EvalPoint[]) {
  const sorted = [...points].sort((a, b) =>
    String(a.generatedAt || a.file).localeCompare(String(b.generatedAt || b.file)),
  );
  const latest = sorted.at(-1) || null;
  const previous = sorted.at(-2) || null;
  const passRateDelta =
    latest?.passRate !== null &&
    latest?.passRate !== undefined &&
    previous?.passRate !== null &&
    previous?.passRate !== undefined
      ? Number((latest.passRate - previous.passRate).toFixed(4))
      : null;

  return { latest, previous, passRateDelta };
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFor(item);
    grouped[key] ||= [];
    grouped[key].push(item);
  }
  return grouped;
}

function main() {
  const options = parseArgs();
  const files = collectJsonFiles(evidenceRoot());
  const points = files
    .map(parseEvalPoint)
    .filter((point): point is EvalPoint => Boolean(point));
  const bySuite = groupBy(points, (point) => point.suite);
  const attackCoverage = Object.entries(
    groupBy(ADVERSARIAL_CASES, (item) => item.category),
  )
    .map(([category, cases]) => ({
      category,
      cases: cases?.length || 0,
      p0Cases: cases?.filter((item) => item.severity === "p0").length || 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const suites = Object.entries(bySuite)
    .map(([suite, suitePoints]) => ({
      suite,
      count: suitePoints?.length || 0,
      ...trend(suitePoints || []),
    }))
    .sort((a, b) => a.suite.localeCompare(b.suite));
  const regressions = points.filter(
    (point) =>
      point.passed === false ||
      (point.passRate !== null && point.passRate < 1) ||
      point.failedRequired.length > 0,
  );
  const report = {
    suite: "mcp-eval-trend-report",
    generatedAt: new Date().toISOString(),
    evidenceFiles: files.length,
    parsedReports: points.length,
    suites,
    attackCoverage,
    regressions,
    passed: regressions.length === 0,
  };

  let reportPath: string | undefined;
  if (!options.noWrite) {
    const outDir = options.outDir || defaultOutDir();
    fs.mkdirSync(outDir, { recursive: true });
    reportPath = path.join(outDir, "mcp-eval-trends.json");
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n MCP eval trend report");
    console.log(`Evidence files: ${files.length}`);
    console.log(`Parsed reports: ${points.length}`);
    console.log(`Regressions: ${regressions.length}`);
    if (reportPath) console.log(`Report: ${reportPath}`);
    console.log("");
    console.log(`Result: ${report.passed ? "PASS" : "FAIL"}`);
  }

  if (!report.passed) process.exitCode = 1;
}

main();
