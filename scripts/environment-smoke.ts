import fs from "node:fs";
import path from "node:path";

type SmokeStatus = "passed" | "failed";

type SmokeCheck = {
  name: string;
  method: "GET" | "POST";
  url: string;
  status: SmokeStatus;
  httpStatus: number | null;
  durationMs: number;
  expectation: string;
  error?: string;
  bodySample?: string;
};

type SmokeOptions = {
  profile: "preview" | "staging" | "production";
  baseUrl: string;
  json: boolean;
  outDir?: string;
  timeoutMs: number;
};

function readArgValue(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];

  return fallback;
}

function readProfile(): SmokeOptions["profile"] {
  const profile = readArgValue("--profile", "staging");
  if (profile === "preview" || profile === "staging" || profile === "production") {
    return profile;
  }

  throw new Error("Invalid --profile. Use preview, staging, or production.");
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function parseArgs(): SmokeOptions {
  const args = process.argv.slice(2);
  const flags = new Set(args);
  const profile = readProfile();
  const baseUrl = normalizeBaseUrl(
    readArgValue("--base-url") ||
      process.env.PREVIEW_URL ||
      process.env.STAGING_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL,
  );

  if (!baseUrl) {
    throw new Error(
      "Missing smoke target. Pass --base-url or set PREVIEW_URL, STAGING_URL, APP_URL, NEXT_PUBLIC_APP_URL, or VERCEL_URL.",
    );
  }

  const timeoutMs = Number(readArgValue("--timeout-ms", "15000"));

  return {
    profile,
    baseUrl,
    json: flags.has("--json"),
    outDir: readArgValue("--out-dir"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
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

function defaultOutDir(profile: SmokeOptions["profile"]) {
  return path.join(process.cwd(), "docs", "api", "evidence", "smoke", profile, dateStamp());
}

function buildUrl(baseUrl: string, route: string) {
  return new URL(route, `${baseUrl}/`).toString();
}

function redact(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[REDACTED_DATABASE_URL]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(ENCRYPTION_KEY|BETTER_AUTH_SECRET|POLAR_ACCESS_TOKEN)=\S+/g, "$1=[REDACTED]")
    .slice(0, 2000);
}

function bodyLooksSafe(body: string) {
  const leakedInternalPatterns = [
    /PrismaClientKnownRequestError/i,
    /PrismaClientInitializationError/i,
    /DATABASE_URL/i,
    /BETTER_AUTH_SECRET/i,
    /ENCRYPTION_KEY/i,
    /POLAR_ACCESS_TOKEN/i,
    /node_modules[\\/]/i,
  ];

  return leakedInternalPatterns.every((pattern) => !pattern.test(body));
}

async function smokeFetch(
  check: Omit<SmokeCheck, "status" | "httpStatus" | "durationMs" | "bodySample" | "error"> & {
    body?: string;
    headers?: Record<string, string>;
    timeoutMs: number;
  },
): Promise<SmokeCheck> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), check.timeoutMs);

  try {
    const response = await fetch(check.url, {
      method: check.method,
      body: check.body,
      headers: check.headers,
      signal: controller.signal,
    });
    const body = await response.text();
    const passed = response.status < 500 && bodyLooksSafe(body);

    return {
      name: check.name,
      method: check.method,
      url: check.url,
      status: passed ? "passed" : "failed",
      httpStatus: response.status,
      durationMs: Date.now() - started,
      expectation: check.expectation,
      bodySample: redact(body),
    };
  } catch (error) {
    return {
      name: check.name,
      method: check.method,
      url: check.url,
      status: "failed",
      httpStatus: null,
      durationMs: Date.now() - started,
      expectation: check.expectation,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function trpcInput() {
  return encodeURIComponent(
    JSON.stringify({ "0": { json: { page: 1, pageSize: 1, search: "" } } }),
  );
}

async function runSmokeChecks(options: SmokeOptions) {
  const checks = [
    smokeFetch({
      name: "application shell",
      method: "GET",
      url: buildUrl(options.baseUrl, "/"),
      expectation: "The app shell responds without a 5xx or internal error leak.",
      timeoutMs: options.timeoutMs,
    }),
    smokeFetch({
      name: "anonymous tRPC guard",
      method: "GET",
      url: buildUrl(
        options.baseUrl,
        `/api/trpc/workflows.getMany?batch=1&input=${trpcInput()}`,
      ),
      expectation:
        "Protected tRPC route returns a controlled response, usually 401/403, without a 5xx or internal error leak.",
      timeoutMs: options.timeoutMs,
    }),
    smokeFetch({
      name: "anonymous MCP guard",
      method: "POST",
      url: buildUrl(options.baseUrl, "/api/mcp"),
      expectation:
        "MCP route returns a controlled auth/protocol response without a 5xx or internal error leak.",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke",
        method: "tools/list",
        params: {},
      }),
      timeoutMs: options.timeoutMs,
    }),
  ];

  return Promise.all(checks);
}

function writeReport(report: unknown, outDir: string, profile: SmokeOptions["profile"]) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `${profile}-smoke.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function main() {
  const options = parseArgs();
  const checks = await runSmokeChecks(options);
  const failed = checks.filter((check) => check.status === "failed");
  const report = {
    suite: "environment-smoke",
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
    passed: failed.length === 0,
    failedChecks: failed.map((check) => check.name),
    checks,
  };
  const reportPath = writeReport(report, options.outDir || defaultOutDir(options.profile), options.profile);

  if (options.json) {
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } else {
    console.log("a8n environment smoke");
    console.log(`Profile: ${options.profile}`);
    console.log(`Base URL: ${options.baseUrl}`);
    console.log(`Report: ${reportPath}`);
    console.log("");
    for (const check of checks) {
      console.log(`- ${check.name}: ${check.status} (${check.httpStatus ?? "no response"})`);
      if (check.status === "failed") {
        console.log(`  ${check.error || check.expectation}`);
      }
    }
    console.log("");
    console.log(`Result: ${failed.length === 0 ? "PASS" : "FAIL"}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("a8n environment smoke");
  console.error("Result: FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
