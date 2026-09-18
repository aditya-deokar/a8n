/**
 * MCP Runtime Audit
 *
 * Boots the real MCP server for every app profile and introspects what is
 * actually registered at runtime, instead of grepping source files.
 *
 * The existing `mcp:contract:check` script parses source with regexes, so it
 * cannot catch registration that is skipped at runtime, widget resources that
 * a tool points at but that were never registered, or profile drift. This
 * script closes that gap.
 *
 * Run:  pnpm mcp:runtime:audit           (human summary)
 *       pnpm mcp:runtime:audit --json    (machine-readable report)
 *
 * Exit code is non-zero when a required check fails, so it can gate a release.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpServer } from "../src/mcp";
import type { McpAppProfile } from "../src/mcp/app-profile";
import {
  CHATGPT_TOOL_CONTRACTS,
  DEFAULT_TOOL_CONTRACTS,
  MCP_TOOL_CONTRACTS,
} from "../src/mcp/contracts/tools.manifest";
import { CHATGPT_FORBIDDEN_TOOLS } from "../src/mcp/safety/app-tool-policy";
import { listChatGptWidgetSpecs } from "../src/mcp/apps/widget-resources";

type Severity = "required" | "warning";

type Check = {
  name: string;
  ok: boolean;
  severity: Severity;
  detail?: unknown;
};

type RegisteredTool = {
  title?: string;
  description?: string;
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

/** SDK keys `_registeredResources` by URI; the value carries name + metadata. */
type RegisteredResource = {
  name?: string;
  metadata?: { mimeType?: string };
};

type ServerInternals = {
  _registeredTools?: Record<string, RegisteredTool>;
  _registeredResources?: Record<string, RegisteredResource>;
  _registeredResourceTemplates?: Record<string, unknown>;
  _registeredPrompts?: Record<string, unknown>;
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return { json: args.has("--json") };
}

function check(
  name: string,
  ok: boolean,
  severity: Severity = "required",
  detail?: unknown,
): Check {
  return { name, ok, severity, detail };
}

function introspect(profile: McpAppProfile) {
  const server = createMcpServer(undefined, { appProfile: profile });
  const internals = server as unknown as ServerInternals;

  const tools = internals._registeredTools ?? {};
  const resources = internals._registeredResources ?? {};
  const templates = internals._registeredResourceTemplates ?? {};
  const prompts = internals._registeredPrompts ?? {};

  return {
    profile,
    toolNames: Object.keys(tools).sort(),
    tools,
    // `_registeredResources` is keyed by resource URI.
    resourceUris: Object.keys(resources).sort(),
    resources,
    resourceNames: Object.values(resources)
      .map((resource) => resource.name)
      .filter((name): name is string => typeof name === "string")
      .sort(),
    templateNames: Object.keys(templates).sort(),
    promptNames: Object.keys(prompts).sort(),
  };
}

/** Read the widget resource URI a tool points at, from either metadata key. */
function widgetUriForTool(tool: RegisteredTool): string | null {
  const meta = tool._meta ?? {};
  const ui = meta.ui as { resourceUri?: string } | undefined;
  const fromUi = ui?.resourceUri;
  const fromLegacy = meta["ui/resourceUri"];
  const fromOpenAi = meta["openai/outputTemplate"];

  for (const candidate of [fromUi, fromLegacy, fromOpenAi]) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

/**
 * Files whose text the model reads as the tool surface. A removed tool left
 * behind here makes the model call something that does not exist.
 */
const MODEL_FACING_SOURCES = [
  "src/mcp/resources/api-docs.resource.ts",
  "src/mcp/resources/app-resources.resource.ts",
  "src/mcp/contracts/prompts.manifest.ts",
  "src/mcp/apps/submission-assets.ts",
  "src/mcp/prompts/create-workflow.prompt.ts",
  "src/mcp/prompts/debug-execution.prompt.ts",
  "src/mcp/prompts/setup-integration.prompt.ts",
];

/** snake_case identifiers that read like tool names. */
const TOOL_SHAPED = /\b([a-z][a-z0-9]*(?:_[a-z0-9]+){1,4})\b/g;
const TOOL_VERBS =
  /^(get|list|create|update|delete|run|execute|render|plan|apply|explain|preview|validate|answer|diagnose|suggest|test|search|revoke|add|remove|connect|disconnect|move|duplicate|rollback|generate)_/;
const NON_TOOL_SUFFIX = /_(id|at|url|ms|key|name|type|hash|count|path|dir|file|mode|script|secret|token)$/;

function danglingToolReferences(known: Set<string>) {
  const findings: Array<{ tool: string; location: string }> = [];

  for (const source of MODEL_FACING_SOURCES) {
    const filePath = path.resolve(PROJECT_ROOT, source);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(TOOL_SHAPED)) {
        const name = match[1];
        if (known.has(name)) continue;
        if (!TOOL_VERBS.test(name)) continue;
        if (NON_TOOL_SUFFIX.test(name)) continue;
        findings.push({ tool: name, location: `${source}:${index + 1}` });
      }
    });
  }

  return findings;
}

function missing<T>(expected: T[], actual: T[]): T[] {
  const present = new Set(actual);
  return expected.filter((item) => !present.has(item));
}

function main() {
  const { json } = parseArgs();
  const profiles: McpAppProfile[] = ["default", "chatgpt", "embedded_agent"];
  const snapshots = profiles.map((profile) => introspect(profile));
  const byProfile = new Map(snapshots.map((snapshot) => [snapshot.profile, snapshot]));

  const checks: Check[] = [];

  // ── Every profile registers a usable surface ──────────────────────
  for (const snapshot of snapshots) {
    checks.push(
      check(
        `[${snapshot.profile}] registers at least one tool`,
        snapshot.toolNames.length > 0,
        "required",
        { toolCount: snapshot.toolNames.length },
      ),
    );
    checks.push(
      check(
        `[${snapshot.profile}] registers resources`,
        snapshot.resourceUris.length > 0,
        "required",
        { resourceCount: snapshot.resourceUris.length },
      ),
    );
  }

  // ── Widget resources are readable by the tools that point at them ─
  for (const snapshot of snapshots) {
    const danglingWidgets: Array<{ tool: string; uri: string }> = [];
    for (const [toolName, tool] of Object.entries(snapshot.tools)) {
      const uri = widgetUriForTool(tool);
      if (!uri) continue;
      if (!snapshot.resourceUris.includes(uri)) {
        danglingWidgets.push({ tool: toolName, uri });
      }
    }
    checks.push(
      check(
        `[${snapshot.profile}] every widget tool points at a registered resource`,
        danglingWidgets.length === 0,
        "required",
        danglingWidgets,
      ),
    );
  }

  // ── Widget HTML bundles exist and are not the build-missing stub ──
  const widgetSpecs = listChatGptWidgetSpecs();
  const widgetBundleProblems = widgetSpecs.flatMap((spec) => {
    const filePath = path.resolve(PROJECT_ROOT, "dist/mcp-apps", spec.htmlFile ?? "");
    if (!spec.htmlFile) return [{ widget: spec.name, problem: "spec has no htmlFile" }];
    if (!fs.existsSync(filePath)) {
      return [{ widget: spec.name, problem: `missing bundle ${spec.htmlFile}` }];
    }
    const html = fs.readFileSync(filePath, "utf-8");
    if (html.includes("Widget build missing")) {
      return [{ widget: spec.name, problem: "bundle is the build-missing placeholder" }];
    }
    if (!html.includes("<script")) {
      return [{ widget: spec.name, problem: "bundle has no inlined script" }];
    }
    return [];
  });
  checks.push(
    check(
      "widget HTML bundles are built and self-contained",
      widgetBundleProblems.length === 0,
      "required",
      widgetBundleProblems,
    ),
  );

  // ── Contract manifest matches what the server actually registers ──
  const defaultSnapshot = byProfile.get("default");
  if (defaultSnapshot) {
    const expected = DEFAULT_TOOL_CONTRACTS.map((contract) => contract.name);
    const notRegistered = missing(expected, defaultSnapshot.toolNames);
    const undocumented = missing(
      defaultSnapshot.toolNames,
      MCP_TOOL_CONTRACTS.map((contract) => contract.name),
    );
    checks.push(
      check(
        "[default] every contracted tool is registered at runtime",
        notRegistered.length === 0,
        "required",
        notRegistered,
      ),
    );
    checks.push(
      check(
        "[default] no tool is registered without a contract entry",
        undocumented.length === 0,
        "required",
        undocumented,
      ),
    );
  }

  const chatgptSnapshot = byProfile.get("chatgpt");
  if (chatgptSnapshot) {
    const expected = CHATGPT_TOOL_CONTRACTS.map((contract) => contract.name);
    const notRegistered = missing(expected, chatgptSnapshot.toolNames);
    const forbiddenExposed = chatgptSnapshot.toolNames.filter((name) =>
      CHATGPT_FORBIDDEN_TOOLS.includes(name),
    );
    checks.push(
      check(
        "[chatgpt] every contracted ChatGPT tool is registered at runtime",
        notRegistered.length === 0,
        "required",
        notRegistered,
      ),
    );
    checks.push(
      check(
        "[chatgpt] no forbidden tool is exposed at runtime",
        forbiddenExposed.length === 0,
        "required",
        forbiddenExposed,
      ),
    );
  }

  // ── Tools that declare an output schema must be annotated ─────────
  for (const snapshot of snapshots) {
    const untitled = Object.entries(snapshot.tools)
      .filter(([, tool]) => !tool.title && !tool.description)
      .map(([name]) => name);
    checks.push(
      check(
        `[${snapshot.profile}] every tool has a title or description`,
        untitled.length === 0,
        "required",
        untitled,
      ),
    );

    const unannotated = Object.entries(snapshot.tools)
      .filter(([, tool]) => !tool.annotations)
      .map(([name]) => name);
    checks.push(
      check(
        `[${snapshot.profile}] every tool carries behavior annotations`,
        unannotated.length === 0,
        "warning",
        unannotated,
      ),
    );
  }

  // ── Model-facing docs must not name tools that were removed ──────
  const danglingDocs = danglingToolReferences(
    new Set(MCP_TOOL_CONTRACTS.map((contract) => contract.name)),
  );
  checks.push(
    check(
      "model-facing docs and prompts only name registered tools",
      danglingDocs.length === 0,
      "required",
      danglingDocs,
    ),
  );

  // ── Registering twice must not be possible (idempotence guard) ────
  let doubleRegistrationError: string | null = null;
  try {
    const server = createMcpServer(undefined, { appProfile: "default" });
    const raw = server.server as unknown as { oninitialized?: () => void };
    raw.oninitialized?.();
  } catch (error) {
    doubleRegistrationError = error instanceof Error ? error.message : String(error);
  }
  checks.push(
    check(
      "client-initialized hook does not double-register resources",
      doubleRegistrationError === null,
      "required",
      doubleRegistrationError,
    ),
  );

  const requiredFailures = checks.filter((item) => item.severity === "required" && !item.ok);
  const warnings = checks.filter((item) => item.severity === "warning" && !item.ok);
  const passed = requiredFailures.length === 0;

  const report = {
    suite: "mcp-runtime-audit",
    generatedAt: new Date().toISOString(),
    passed,
    profiles: snapshots.map((snapshot) => ({
      profile: snapshot.profile,
      tools: snapshot.toolNames.length,
      resources: snapshot.resourceUris.length,
      resourceTemplates: snapshot.templateNames.length,
      prompts: snapshot.promptNames.length,
      toolNames: snapshot.toolNames,
      resourceUris: snapshot.resourceUris,
    })),
    checks,
    requiredFailures,
    warnings,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nMCP runtime audit\n");
    for (const snapshot of snapshots) {
      console.log(
        `  profile ${snapshot.profile.padEnd(16)} tools=${String(snapshot.toolNames.length).padStart(3)}  resources=${String(snapshot.resourceUris.length).padStart(3)}  templates=${String(snapshot.templateNames.length).padStart(2)}  prompts=${String(snapshot.promptNames.length).padStart(2)}`,
      );
    }
    console.log("");
    for (const item of checks) {
      const mark = item.ok ? "PASS" : item.severity === "required" ? "FAIL" : "WARN";
      console.log(`  [${mark}] ${item.name}`);
      if (!item.ok && item.detail !== undefined) {
        console.log(`         ${JSON.stringify(item.detail)}`);
      }
    }
    console.log(
      `\n  ${passed ? "PASSED" : "FAILED"} — ${requiredFailures.length} required failure(s), ${warnings.length} warning(s)\n`,
    );
  }

  process.exit(passed ? 0 : 1);
}

main();
