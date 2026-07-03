const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])|a8n_test/i;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isE2EMode() {
  return process.env.E2E_TESTS === "true";
}

export function assertSafeE2EDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!isE2EMode()) return;

  if (!databaseUrl) {
    throw new Error("E2E_TESTS=true requires DATABASE_URL.");
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const isLocalHost = LOCAL_DATABASE_HOSTS.has(parsed.hostname);
  const looksLikeTestDatabase = TEST_DATABASE_NAME_PATTERN.test(databaseName);

  if (!isLocalHost && !looksLikeTestDatabase) {
    throw new Error(
      `Refusing to run E2E mode against non-local, non-test database "${databaseName}".`,
    );
  }

  if (!looksLikeTestDatabase) {
    throw new Error(
      `Refusing to run E2E mode because database name "${databaseName}" does not look like a test database.`,
    );
  }
}

export function assertSafeE2EExternalServices() {
  if (!isE2EMode()) return;

  if (process.env.E2E_EXTERNAL_SERVICES !== "mock") {
    throw new Error("E2E_TESTS=true requires E2E_EXTERNAL_SERVICES=mock.");
  }
}

export function assertSafeE2EEnvironment() {
  assertSafeE2EDatabaseUrl();
  assertSafeE2EExternalServices();
}
