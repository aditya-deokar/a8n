import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { ZodError } from "zod";
import type { EnvValidationOptions } from "../src/env";

type EnvProfile = NonNullable<EnvValidationOptions["profile"]>;

function readArgValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];

  return undefined;
}

function readProfile(): EnvProfile | undefined {
  const value = readArgValue("--profile");
  if (!value) return undefined;
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error(
    `Invalid --profile '${value}'. Use development, test, or production.`,
  );
}

function formatIssue(issue: ZodError["issues"][number]) {
  const key = issue.path.length > 0 ? issue.path.join(".") : "environment";
  return `- ${key}: ${issue.message}`;
}

loadDotenv({ path: resolve(process.cwd(), ".env") });

const profile = readProfile();

async function main() {
  const { resolveEnvProfile, validateEnv } = await import("../src/env");
  const parsed = validateEnv(process.env, { profile });
  const effectiveProfile = profile || resolveEnvProfile(process.env);

  console.log("a8n environment check");
  console.log(`Profile: ${effectiveProfile}`);
  console.log(`App URL: ${parsed.NEXT_PUBLIC_APP_URL}`);
  console.log(`Database: ${parsed.DATABASE_URL.replace(/:\/\/.*@/, "://***@")}`);
  console.log("Result: PASS");
}

main().catch((error) => {
  console.error("a8n environment check");
  console.error(`Profile: ${profile || process.env.NODE_ENV || "development"}`);

  if (error instanceof ZodError) {
    console.error("Result: FAIL");
    console.error(error.issues.map(formatIssue).join("\n"));
    process.exit(1);
  }

  console.error("Result: FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
