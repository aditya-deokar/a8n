import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test";
const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])|a8n_test/i;
const LOCAL_DOCKER_TEST_ENV_PATH = path.join(
  process.cwd(),
  "docker",
  "env",
  "test.host.env",
);

function isSafeE2EDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return false;

  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.replace(/^\//, "");
    return TEST_DATABASE_NAME_PATTERN.test(databaseName);
  } catch {
    return false;
  }
}

function isHostedCi() {
  return process.env.GITHUB_ACTIONS === "true" || process.env.VERCEL === "1";
}

function readEnvFileValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const envKey = trimmed.slice(0, separatorIndex).trim();
    if (envKey !== key) continue;

    return trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
  }

  return undefined;
}

function localDockerTestDatabaseUrl() {
  if (isHostedCi()) return undefined;

  const dockerDatabaseUrl = readEnvFileValue(
    LOCAL_DOCKER_TEST_ENV_PATH,
    "DATABASE_URL",
  );

  return isSafeE2EDatabaseUrl(dockerDatabaseUrl) ? dockerDatabaseUrl : undefined;
}

function e2eDatabaseUrl() {
  const explicitDatabaseUrl =
    process.env.API_E2E_DATABASE_URL || process.env.E2E_DATABASE_URL;
  if (explicitDatabaseUrl) return explicitDatabaseUrl;
  if (isSafeE2EDatabaseUrl(process.env.DATABASE_URL)) return process.env.DATABASE_URL;

  const dockerDatabaseUrl = localDockerTestDatabaseUrl();
  if (dockerDatabaseUrl) return dockerDatabaseUrl;

  return DEFAULT_E2E_DATABASE_URL;
}

const e2eEnv = {
  NODE_ENV: process.env.NODE_ENV || "test",
  E2E_TESTS: process.env.E2E_TESTS || "true",
  E2E_EXTERNAL_SERVICES: process.env.E2E_EXTERNAL_SERVICES || "mock",
  DATABASE_URL: e2eDatabaseUrl(),
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ||
    "test-better-auth-secret-32-characters",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
  APP_URL: process.env.APP_URL || "http://127.0.0.1:3000",
  NEXT_PUBLIC_WEBHOOK_BASE_URL:
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || "http://127.0.0.1:3000",
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY || "test-api-encryption-key-32-characters",
  POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN || "test-polar-token",
  MCP_API_KEY_HMAC_SECRET:
    process.env.MCP_API_KEY_HMAC_SECRET ||
    "test-mcp-api-key-hmac-secret-32-chars",
  MCP_OAUTH_TOKEN_HMAC_SECRET:
    process.env.MCP_OAUTH_TOKEN_HMAC_SECRET ||
    "test-mcp-oauth-token-hmac-secret-32",
  WEBHOOK_SHARED_SECRET: process.env.WEBHOOK_SHARED_SECRET || "test-webhook-secret",
  A8N_WEBHOOK_SHARED_SECRET:
    process.env.A8N_WEBHOOK_SHARED_SECRET || "test-a8n-shared-webhook-secret",
  GOOGLE_FORM_WEBHOOK_SECRET:
    process.env.GOOGLE_FORM_WEBHOOK_SECRET ||
    "test-google-form-webhook-secret",
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET || "test-stripe-webhook-secret",
  STRIPE_WEBHOOK_SHARED_SECRET:
    process.env.STRIPE_WEBHOOK_SHARED_SECRET ||
    "test-stripe-shared-webhook-secret",
};

for (const [key, value] of Object.entries(e2eEnv)) {
  process.env[key] ??= value;
}

export default defineConfig({
  testDir: "tests/e2e/api/specs",
  testMatch: "**/*.e2e.ts",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/api-e2e", open: "never" }],
    ["json", { outputFile: "test-results/api-e2e/results.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "true"
      ? undefined
      : {
          command: "pnpm dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
          env: e2eEnv,
        },
});
