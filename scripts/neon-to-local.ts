import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Options = {
  neonUrl: string;
  localUrl: string;
  yes: boolean;
  dumpDir: string;
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
  const neonUrl = readArgValue("--neon-url", process.env.NEON_DATABASE_URL);
  if (!neonUrl) {
    throw new Error(
      "Missing Neon URL. Set NEON_DATABASE_URL or pass --neon-url='postgresql://...'.",
    );
  }

  return {
    neonUrl,
    localUrl:
      readArgValue("--local-url", process.env.LOCAL_DATABASE_URL) ||
      "postgresql://a8n_dev:a8n_dev@127.0.0.1:5432/a8n_dev",
    yes: args.includes("--yes"),
    dumpDir: readArgValue("--dump-dir", path.join(process.cwd(), "tmp", "db-dumps"))!,
  };
}

function run(command: string, args: string[], options: { sensitive?: boolean } = {}) {
  const displayArgs = options.sensitive ? ["<redacted>"] : args;
  console.log(`$ ${command} ${displayArgs.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? 1}.`);
  }
}

function capture(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} failed.`);
  }
  return result.stdout.trim();
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function dockerHostPath(input: string) {
  const resolved = path.resolve(input);
  return process.platform === "win32" ? resolved.replace(/\\/g, "/") : resolved;
}

function assertLocalDatabaseUrl(localUrl: string) {
  if (!/(localhost|127\.0\.0\.1|db-local)/i.test(localUrl)) {
    throw new Error(
      "Refusing to restore into a non-local database URL. Pass a localhost LOCAL_DATABASE_URL.",
    );
  }
}

function toContainerLocalUrl(localUrl: string) {
  return localUrl.replace("@127.0.0.1:", "@127.0.0.1:").replace("@localhost:", "@127.0.0.1:");
}

function main() {
  const options = parseArgs();
  assertLocalDatabaseUrl(options.localUrl);

  if (!options.yes) {
    throw new Error(
      "This overwrites the local Docker database. Re-run with --yes when you are ready.",
    );
  }

  fs.mkdirSync(options.dumpDir, { recursive: true });
  const dumpFile = `neon-${timestamp()}.dump`;
  const dumpPath = path.join(options.dumpDir, dumpFile);
  const dockerDumpPath = `/dump/${dumpFile}`;

  console.log("Starting local Postgres container...");
  run("docker", ["compose", "up", "-d", "db-local"]);

  console.log("Dumping Neon database with pg_dump inside a temporary Postgres container...");
  run(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${dockerHostPath(options.dumpDir)}:/dump`,
      "postgres:16-alpine",
      "pg_dump",
      options.neonUrl,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      dockerDumpPath,
    ],
    { sensitive: true },
  );

  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Expected dump file was not created: ${dumpPath}`);
  }

  const containerId = capture("docker", ["compose", "ps", "-q", "db-local"]);
  if (!containerId) throw new Error("Could not find db-local container id.");

  console.log("Restoring dump into local Docker Postgres...");
  run("docker", [
    "run",
    "--rm",
    "-v",
    `${dockerHostPath(options.dumpDir)}:/dump`,
    "--network",
    `container:${containerId}`,
    "postgres:16-alpine",
    "pg_restore",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    toContainerLocalUrl(options.localUrl),
    dockerDumpPath,
  ]);

  console.log("");
  console.log(`Local restore complete: ${dumpPath}`);
  console.log("Run `pnpm db:local:migrate` if your local schema needs committed migrations reapplied.");
}

main();
