import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  CHATGPT_TOOL_CONTRACTS,
  FORBIDDEN_CHATGPT_TOOL_CONTRACTS,
  MCP_TOOL_CONTRACTS,
} from "../src/mcp/contracts/tools.manifest";
import { MCP_RESOURCE_CONTRACTS } from "../src/mcp/contracts/resources.manifest";
import { MCP_PROMPT_CONTRACTS } from "../src/mcp/contracts/prompts.manifest";
import { isContractOutputSchemaName } from "../src/mcp/contracts/schemas";
import {
  CHATGPT_APP_TOOL_COUNT,
  CHATGPT_APP_TOOL_POLICY,
  CHATGPT_FORBIDDEN_TOOLS,
} from "../src/mcp/safety/app-tool-policy";

type Check = {
  name: string;
  ok: boolean;
  severity: "required" | "warning";
  detail?: unknown;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    strictNativeSchemas: args.has("--strict-native-schemas"),
  };
}

function check(
  name: string,
  ok: boolean,
  severity: Check["severity"] = "required",
  detail?: unknown,
): Check {
  return { name, ok, severity, detail };
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function registeredToolNamesFromSource(): string[] {
  const roots = ["src/mcp/tools", "src/mcp/apps"];
  const names: string[] = [];
  const pattern = /server\.(?:registerTool|tool)\(\s*(?:"([^"]+)"|'([^']+)')/g;

  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content))) {
        names.push(match[1] || match[2]);
      }
    }
  }

  for (const root of roots) {
    if (fs.existsSync(root)) visit(root);
  }

  return [...new Set(names)].sort();
}

function sourceHasNativeOutputSchema(source: string, toolName: string): boolean {
  if (!fs.existsSync(source)) return false;
  const content = fs.readFileSync(source, "utf8");
  const index = content.indexOf(`"${toolName}"`);
  const singleIndex = content.indexOf(`'${toolName}'`);
  const start = index >= 0 ? index : singleIndex;
  if (start < 0) return false;
  const slice = content.slice(start, start + 1800);
  return slice.includes("outputSchema");
}

function main() {
  const options = parseArgs();
  const manifestNames = MCP_TOOL_CONTRACTS.map((tool) => tool.name);
  const registeredNames = registeredToolNamesFromSource();
  const manifestNameSet = new Set(manifestNames);
  const registeredNameSet = new Set(registeredNames);
  const chatgptNames = CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name);
  const forbiddenNames = FORBIDDEN_CHATGPT_TOOL_CONTRACTS.map((tool) => tool.name);
  const policyNames = Object.keys(CHATGPT_APP_TOOL_POLICY).sort();
  const resourceNames = MCP_RESOURCE_CONTRACTS.map((resource) => resource.name);
  const resourceUris = MCP_RESOURCE_CONTRACTS.map((resource) => resource.uri);
  const promptNames = MCP_PROMPT_CONTRACTS.map((prompt) => prompt.name);
  const highRiskApprovalGaps = MCP_TOOL_CONTRACTS.filter((tool) => {
    return (
      tool.externalSideEffect ||
      tool.destructive ||
      tool.risk === "approval_gated_write"
    ) && !tool.requiresApproval;
  }).map((tool) => tool.name);
  const destructiveConfirmationGaps = MCP_TOOL_CONTRACTS.filter((tool) =>
    tool.destructive &&
    !Object.prototype.hasOwnProperty.call(tool.exampleInput, "confirmationHash"),
  ).map((tool) => tool.name);
  const nativeSchemaGaps = CHATGPT_TOOL_CONTRACTS.filter((tool) => {
    return tool.nativeOutputSchema !== sourceHasNativeOutputSchema(tool.source, tool.name);
  }).map((tool) => tool.name);

  const checks: Check[] = [
    check("tool contract names are unique", duplicateValues(manifestNames).length === 0, "required", {
      duplicates: duplicateValues(manifestNames),
    }),
    check("source-registered tools are all in manifest", registeredNames.every((name) => manifestNameSet.has(name)), "required", {
      missing: registeredNames.filter((name) => !manifestNameSet.has(name)),
    }),
    check("manifest tools are all source-registered", manifestNames.every((name) => registeredNameSet.has(name)), "required", {
      missing: manifestNames.filter((name) => !registeredNameSet.has(name)),
    }),
    check("every tool has at least one profile", MCP_TOOL_CONTRACTS.every((tool) => tool.profiles.length > 0)),
    check("every tool declares required scopes", MCP_TOOL_CONTRACTS.every((tool) => tool.requiredScopes.length > 0)),
    check("every tool declares known output schema", MCP_TOOL_CONTRACTS.every((tool) => isContractOutputSchemaName(tool.outputSchema))),
    check("ChatGPT profile has 28 tools", CHATGPT_TOOL_CONTRACTS.length === 28, "required", {
      count: CHATGPT_TOOL_CONTRACTS.length,
    }),
    check("ChatGPT policy is generated from contract", CHATGPT_APP_TOOL_COUNT === CHATGPT_TOOL_CONTRACTS.length && policyNames.join("|") === [...chatgptNames].sort().join("|")),
    check("forbidden tools are absent from ChatGPT profile", forbiddenNames.every((name) => !chatgptNames.includes(name)), "required", {
      forbiddenNames,
    }),
    check("forbidden list is generated from contract", [...CHATGPT_FORBIDDEN_TOOLS].sort().join("|") === forbiddenNames.sort().join("|")),
    check("approval-gated tools require approval", MCP_TOOL_CONTRACTS.filter((tool) => tool.risk === "approval_gated_write").every((tool) => tool.requiresApproval)),
    check("side-effect and destructive tools require approval", highRiskApprovalGaps.length === 0, "required", {
      missingApproval: highRiskApprovalGaps,
    }),
    check("destructive tools declare confirmation examples", destructiveConfirmationGaps.length === 0, "required", {
      missingConfirmationHash: destructiveConfirmationGaps,
    }),
    check("destructive tools are not in ChatGPT profile", MCP_TOOL_CONTRACTS.filter((tool) => tool.destructive).every((tool) => !tool.profiles.includes("chatgpt"))),
    check("admin tools are not in ChatGPT profile", MCP_TOOL_CONTRACTS.filter((tool) => tool.admin).every((tool) => !tool.profiles.includes("chatgpt"))),
    check("resource names are unique", duplicateValues(resourceNames).length === 0, "required", {
      duplicates: duplicateValues(resourceNames),
    }),
    check("resource URIs are unique", duplicateValues(resourceUris).length === 0, "required", {
      duplicates: duplicateValues(resourceUris),
    }),
    check("widget resources use MCP app MIME type", MCP_RESOURCE_CONTRACTS.filter((resource) => resource.kind === "widget").every((resource) => resource.mimeType === "text/html;profile=mcp-app")),
    check("prompt names are unique", duplicateValues(promptNames).length === 0, "required", {
      duplicates: duplicateValues(promptNames),
    }),
    check("prompts do not ask for secrets in chat", MCP_PROMPT_CONTRACTS.every((prompt) => !prompt.asksForSecretsInChat)),
    check("native outputSchema flags match source", nativeSchemaGaps.length === 0, options.strictNativeSchemas ? "required" : "warning", {
      mismatches: nativeSchemaGaps,
      note: "Use --strict-native-schemas after every app-facing tool registration has native MCP outputSchema metadata.",
    }),
  ];

  const requiredFailures = checks.filter((item) => item.severity === "required" && !item.ok);
  const warnings = checks.filter((item) => item.severity === "warning" && !item.ok);
  const passed = requiredFailures.length === 0;
  const report = {
    suite: "mcp-contract-check",
    generatedAt: new Date().toISOString(),
    passed,
    registeredToolCount: registeredNames.length,
    manifestToolCount: MCP_TOOL_CONTRACTS.length,
    chatgptToolCount: CHATGPT_TOOL_CONTRACTS.length,
    warnings,
    requiredFailures,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n MCP contract check");
    console.log(`Registered tools: ${registeredNames.length}`);
    console.log(`Manifest tools: ${MCP_TOOL_CONTRACTS.length}`);
    console.log(`ChatGPT tools: ${CHATGPT_TOOL_CONTRACTS.length}`);
    console.log("");
    for (const item of checks) {
      const suffix = item.severity === "warning" ? " (warning)" : "";
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"}${suffix}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
