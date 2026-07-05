import { Client } from "pg";

type Options = {
  databaseUrl: string;
  timeoutMs: number;
  intervalMs: number;
};

function readArgValue(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];

  return fallback;
}

function readPositiveInt(name: string, fallback: number) {
  const value = readArgValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(): Options {
  const databaseUrl = readArgValue("--database-url", process.env.DATABASE_URL);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to wait for Postgres.");
  }

  return {
    databaseUrl,
    timeoutMs: readPositiveInt("--timeout-ms", 60_000),
    intervalMs: readPositiveInt("--interval-ms", 1_000),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactDatabaseUrl(databaseUrl: string) {
  return databaseUrl.replace(/:\/\/.*@/, "://***@");
}

async function canConnect(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const options = parseArgs();
  const startedAt = Date.now();
  const deadline = startedAt + options.timeoutMs;
  let lastError = "Postgres is not ready yet.";

  while (Date.now() < deadline) {
    try {
      if (await canConnect(options.databaseUrl)) {
        console.log(`Postgres is ready: ${redactDatabaseUrl(options.databaseUrl)}`);
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(options.intervalMs);
  }

  throw new Error(
    `Timed out waiting for Postgres at ${redactDatabaseUrl(options.databaseUrl)}. Last error: ${lastError}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
