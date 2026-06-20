/**
 * Starts an ngrok tunnel for the local demo app and updates demo URL env vars.
 *
 * Run:
 *   pnpm demo:ngrok
 */

import "dotenv/config";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/db";

const USER_EMAIL = "adityadeokar80@gmail.com";
const WORKFLOW_NAME = "All Nodes Demo - AI Operations Command Center";
const PORT = Number(process.env.DEMO_PORT || process.env.PORT || 3000);
const ENV_PATH = path.join(process.cwd(), ".env");
const NGROK_BIN_DIR = path.join(process.cwd(), "node_modules", "ngrok", "bin");
let ngrokProcess: ChildProcessWithoutNullStreams | undefined;

const quoteEnvValue = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

function updateEnvFile(updates: Record<string, string>) {
  const original = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8")
    : "";
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original ? original.split(/\r?\n/) : [];
  const touched = new Set<string>();

  const updatedLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=.*/);
    if (!match) return line;

    const key = match[1];
    if (!(key in updates)) return line;

    touched.add(key);
    return `${key}=${quoteEnvValue(updates[key])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!touched.has(key)) {
      updatedLines.push(`${key}=${quoteEnvValue(value)}`);
    }
  }

  fs.writeFileSync(ENV_PATH, updatedLines.join(newline));
}

function ensureNgrokWindowsBinary() {
  if (process.platform !== "win32") return;

  const extensionlessBinary = path.join(NGROK_BIN_DIR, "ngrok");
  const windowsBinary = path.join(NGROK_BIN_DIR, "ngrok.exe");

  if (fs.existsSync(windowsBinary) || !fs.existsSync(extensionlessBinary)) {
    return;
  }

  fs.copyFileSync(extensionlessBinary, windowsBinary);
}

function getNgrokBinaryPath() {
  ensureNgrokWindowsBinary();

  return path.join(
    NGROK_BIN_DIR,
    process.platform === "win32" ? "ngrok.exe" : "ngrok",
  );
}

function parseNgrokUrl(line: string) {
  try {
    const parsed = JSON.parse(line) as { url?: unknown; msg?: unknown };
    if (typeof parsed.url === "string" && parsed.url.startsWith("https://")) {
      return parsed.url;
    }
  } catch {
    const match = line.match(/https:\/\/[^\s"]+\.ngrok[^\s"]*/);
    if (match) return match[0];
  }

  return null;
}

function startNgrokCli() {
  return new Promise<{ publicUrl: string; child: ChildProcessWithoutNullStreams }>(
    (resolve, reject) => {
      const args = [
        "http",
        String(PORT),
        "--log=stdout",
        "--log-format=json",
      ];

      if (process.env.NGROK_AUTHTOKEN) {
        args.push(`--authtoken=${process.env.NGROK_AUTHTOKEN}`);
      }

      const child = spawn(getNgrokBinaryPath(), args, {
        windowsHide: true,
      });

      let resolved = false;
      let lastOutput = "";

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        lastOutput += text;

        for (const line of text.split(/\r?\n/)) {
          const publicUrl = parseNgrokUrl(line.trim());
          if (!publicUrl || resolved) continue;

          resolved = true;
          resolve({ publicUrl, child });
        }
      };

      child.stdout.on("data", handleOutput);
      child.stderr.on("data", handleOutput);
      child.on("error", reject);
      child.on("exit", (code) => {
        if (!resolved) {
          reject(
            new Error(
              `ngrok exited before publishing a tunnel URL (code ${code}). ${lastOutput}`,
            ),
          );
        }
      });
    },
  );
}

async function findDemoWorkflowId() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true },
  });

  if (!user) return null;

  const workflow = await prisma.workflow.findFirst({
    where: {
      userId: user.id,
      name: WORKFLOW_NAME,
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return workflow?.id || null;
}

async function shutdown() {
  if (ngrokProcess && !ngrokProcess.killed) {
    ngrokProcess.kill();
  }
  await prisma.$disconnect().catch(() => undefined);
}

async function main() {
  const tunnel = await startNgrokCli();
  ngrokProcess = tunnel.child;
  ngrokProcess.on("exit", async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });

  const publicUrl = tunnel.publicUrl;

  updateEnvFile({
    NGROK_URL: publicUrl,
    NEXT_PUBLIC_WEBHOOK_BASE_URL: publicUrl,
  });

  const workflowId = await findDemoWorkflowId();

  console.log(`ngrok tunnel started: ${publicUrl} -> http://localhost:${PORT}`);
  console.log(".env updated: NGROK_URL, NEXT_PUBLIC_WEBHOOK_BASE_URL");
  console.log("");

  if (workflowId) {
    console.log("Demo webhook URLs:");
    console.log(
      `Google Form: ${publicUrl}/api/webhooks/google-form?workflowId=${workflowId}`,
    );
    console.log(
      `Stripe:      ${publicUrl}/api/webhooks/stripe?workflowId=${workflowId}`,
    );
  } else {
    console.log(
      `Demo workflow not found. Run "pnpm seed:showcase", then use ${publicUrl}/api/webhooks/<provider>?workflowId=<id>.`,
    );
  }

  console.log("");
  console.log("Keep this process running while testing external webhooks.");
  console.log("Restart the Next.js dev server after env changes if it was already running.");
  console.log("Press Ctrl+C to stop the tunnel.");

  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });

  await new Promise(() => undefined);
}

main().catch(async (error) => {
  console.error("Failed to start demo ngrok tunnel:", error);
  await shutdown();
  process.exit(1);
});
