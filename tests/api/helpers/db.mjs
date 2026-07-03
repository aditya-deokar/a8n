const TEST_DATABASE_NAME_PATTERN = /(^|[_-])test($|[_-])|a8n_test/i;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function apiDatabaseTestsEnabled() {
  return process.env.API_DATABASE_TESTS === "true";
}

export function assertSafeTestDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for API database tests.");
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const isLocalHost = LOCAL_DATABASE_HOSTS.has(parsed.hostname);
  const looksLikeTestDatabase = TEST_DATABASE_NAME_PATTERN.test(databaseName);

  if (!isLocalHost && !looksLikeTestDatabase) {
    throw new Error(
      `Refusing to run API database tests against non-local, non-test database "${databaseName}".`,
    );
  }

  if (!looksLikeTestDatabase) {
    throw new Error(
      `Refusing to run API database tests because database name "${databaseName}" does not look like a test database.`,
    );
  }
}
