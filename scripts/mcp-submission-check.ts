import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { CHATGPT_FORBIDDEN_TOOLS } from "../src/mcp/safety/app-tool-policy";
import {
  CHATGPT_APP_SCREENSHOT_REQUIREMENTS,
  CHATGPT_APP_SUBMISSION_PROMPTS,
  buildChatGptSubmissionPackage,
  type ChatGptSubmissionPromptKind,
} from "../src/mcp/apps/submission-assets";

type Check = {
  name: string;
  ok: boolean;
  severity: "required" | "manual";
  detail?: unknown;
};

const REQUIRED_PROMPT_KINDS: ChatGptSubmissionPromptKind[] = [
  "direct",
  "indirect",
  "negative",
  "security",
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    printPackage: args.has("--print-package"),
    allowDevHosts: args.has("--allow-dev-hosts"),
    allowMissingEvidence: args.has("--allow-missing-evidence"),
  };
}

function check(
  name: string,
  ok: boolean,
  severity: "required" | "manual" = "required",
  detail?: unknown,
): Check {
  return { name, ok, severity, detail };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isDevUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("ngrok") ||
    hostname.includes("loca.lt") ||
    hostname.endsWith(".local")
  );
}

function isSubmissionUrl(value: string, allowDevHosts: boolean): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  if (url.protocol === "https:" && (allowDevHosts || !isDevUrl(url))) return true;
  return allowDevHosts && url.protocol === "http:" && isDevUrl(url);
}

function containsPlaceholder(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return [
    "todo",
    "tbd",
    "your-domain",
    "a8n.example.com",
    "<callback_id>",
    "<strong-random-secret",
  ].some((pattern) => text.includes(pattern));
}

function fileExists(...parts: string[]): boolean {
  return fs.existsSync(path.join(process.cwd(), ...parts));
}

function screenshotChecks(allowMissingEvidence: boolean): Check[] {
  return CHATGPT_APP_SCREENSHOT_REQUIREMENTS.map((item) => {
    const exists = fileExists(
      "docs",
      "mcp",
      "mcp-apps",
      "evidence",
      "phase-8",
      item.filename,
    );

    return check(
      `screenshot evidence exists: ${item.filename}`,
      exists || allowMissingEvidence || !item.required,
      item.required ? "required" : "manual",
      { title: item.title, path: `docs/mcp/mcp-apps/evidence/phase-8/${item.filename}` },
    );
  });
}

function main() {
  const options = parseArgs();
  const submission = buildChatGptSubmissionPackage();
  const promptKinds = new Set(CHATGPT_APP_SUBMISSION_PROMPTS.map((item) => item.kind));
  const expectedToolNames = new Set(
    CHATGPT_APP_SUBMISSION_PROMPTS.flatMap((item) => item.expectedTools),
  );
  const toolNames = new Set(submission.tools.map((tool) => tool.name));
  const exposedForbidden = CHATGPT_FORBIDDEN_TOOLS.filter((tool) => toolNames.has(tool));

  const checks: Check[] = [
    check("app name is finalized", submission.app.name === "a8n"),
    check("short description is present", submission.app.shortDescription.length >= 40, "required", {
      length: submission.app.shortDescription.length,
    }),
    check("long description is present", submission.app.longDescription.length >= 160, "required", {
      length: submission.app.longDescription.length,
    }),
    check(
      "submission package has no placeholders",
      !containsPlaceholder({
        ...submission,
        oauth: { ...submission.oauth, redirectUriShape: "chatgpt-callback-shape" },
      }),
    ),
    check("MCP server URL is valid for submission", isSubmissionUrl(submission.app.mcpServerUrl, options.allowDevHosts), "required", {
      mcpServerUrl: submission.app.mcpServerUrl,
    }),
    check("privacy URL is valid for submission", isSubmissionUrl(submission.app.privacyUrl, options.allowDevHosts)),
    check("support URL is valid for submission", isSubmissionUrl(submission.app.supportUrl, options.allowDevHosts)),
    check("icon file exists", fileExists("public", "a8n-app-logo.svg"), "required", {
      path: "public/a8n-app-logo.svg",
    }),
    check("privacy route exists", fileExists("src", "app", "privacy", "page.tsx")),
    check("support route exists", fileExists("src", "app", "support", "page.tsx")),
    check("submission prompts include required prompt kinds", REQUIRED_PROMPT_KINDS.every((kind) => promptKinds.has(kind)), "required", {
      required: REQUIRED_PROMPT_KINDS,
      found: [...promptKinds],
    }),
    check("submission prompts cover at least 8 cases", CHATGPT_APP_SUBMISSION_PROMPTS.length >= 8, "required", {
      count: CHATGPT_APP_SUBMISSION_PROMPTS.length,
    }),
    check(
      "all prompt-expected tools exist in ChatGPT profile",
      [...expectedToolNames].every((tool) => toolNames.has(tool)),
      "required",
      { expectedTools: [...expectedToolNames] },
    ),
    check("ChatGPT profile excludes forbidden tools", exposedForbidden.length === 0, "required", {
      exposedForbidden,
    }),
    check("all four widget URIs are in submission package", submission.widgets.length >= 4, "required", {
      widgets: submission.widgets,
    }),
    check("release notes are present", submission.releaseNotes.length >= 80),
    check("reviewer notes are present", submission.reviewerNotes.length >= 80),
    check("OpenAI org verification is complete", process.env.OPENAI_ORG_VERIFIED === "true", "manual", {
      env: "OPENAI_ORG_VERIFIED",
    }),
    check("OpenAI app permissions are confirmed", process.env.OPENAI_APPS_PERMISSIONS_CONFIRMED === "true", "manual", {
      env: "OPENAI_APPS_PERMISSIONS_CONFIRMED",
      permissions: ["api.apps.write", "api.apps.read"],
    }),
    ...screenshotChecks(options.allowMissingEvidence),
  ];

  const requiredFailures = checks.filter(
    (item) => item.severity === "required" && !item.ok,
  );
  const manualOpen = checks.filter((item) => item.severity === "manual" && !item.ok);
  const passed = requiredFailures.length === 0;
  const report = {
    suite: "chatgpt-app-phase-8-submission",
    generatedAt: new Date().toISOString(),
    passed,
    allowDevHosts: options.allowDevHosts,
    allowMissingEvidence: options.allowMissingEvidence,
    requiredFailures,
    manualOpen,
    checks,
    submission: options.printPackage ? submission : undefined,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT Apps Phase 8 submission check");
    console.log(`Development hosts allowed: ${options.allowDevHosts ? "yes" : "no"}`);
    console.log(`Missing screenshot evidence allowed: ${options.allowMissingEvidence ? "yes" : "no"}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"} (${item.severity})`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
