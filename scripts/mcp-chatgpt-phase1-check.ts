/**
 * Phase 1 readiness check for connecting a8n MCP to ChatGPT developer mode.
 *
 * This script uses the official MCP Streamable HTTP client transport to verify:
 *   1. The endpoint is reachable.
 *   2. Bearer authentication works.
 *   3. MCP initialization succeeds.
 *   4. Tool discovery returns the expected read-only tools.
 *   5. Basic read-only tool calls succeed.
 *
 * Required env:
 *   MCP_CHATGPT_DEV_TOKEN=<a8n_mcp_...>
 *
 * Optional env:
 *   MCP_CHATGPT_DEV_URL=https://<host>/api/mcp
 *   MCP_ENDPOINT_URL=https://<host>/api/mcp
 *   NGROK_URL=https://<host>
 */

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CHATGPT_FORBIDDEN_TOOLS } from "../src/mcp/safety/app-tool-policy";

type ToolCheck = {
  name: string;
  required: boolean;
  call?: boolean;
  callArgs?: Record<string, unknown>;
};

const BASE_REQUIRED_TOOL_CHECKS: ToolCheck[] = [
  { name: "server_info", required: true, call: true, callArgs: {} },
  { name: "whoami", required: true, call: true, callArgs: {} },
  { name: "list_node_types", required: true, call: true, callArgs: {} },
  { name: "list_workflows", required: true, call: true, callArgs: { page: 1, pageSize: 5, search: "" } },
];

const CHATGPT_APP_TOOL_CHECKS: ToolCheck[] = [
  { name: "plan_workflow_from_goal", required: true },
  { name: "create_workflow_draft", required: true },
  { name: "preview_workflow_diff", required: true },
  { name: "apply_workflow_draft", required: true },
  { name: "execute_workflow_and_wait", required: true },
  { name: "diagnose_execution", required: true },
  { name: "render_workflow_draft_preview", required: true },
  { name: "render_workflow_setup_checklist", required: true },
  { name: "render_execution_timeline", required: true },
  { name: "render_workflow_approval", required: true },
];

const CHATGPT_WIDGET_RESOURCE_URIS = [
  "ui://a8n/workflow-draft-preview.html",
  "ui://a8n/workflow-setup-checklist.html",
  "ui://a8n/execution-timeline.html",
  "ui://a8n/workflow-approval.html",
];

function endpointFromEnv() {
  const explicit =
    process.env.MCP_CHATGPT_DEV_URL ||
    process.env.MCP_ENDPOINT_URL ||
    process.env.MCP_SERVER_URL;

  if (explicit) return explicit;

  const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
  if (ngrokUrl) return `${ngrokUrl}/api/mcp`;

  return "http://localhost:3000/api/mcp";
}

function bearerTokenFromEnv() {
  return (
    process.env.MCP_CHATGPT_DEV_TOKEN ||
    process.env.MCP_API_KEY ||
    process.env.A8N_MCP_API_KEY ||
    ""
  );
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    skipCalls: args.has("--skip-calls"),
    skipResources: args.has("--skip-resources"),
  };
}

function expectedProfileFromEnv(endpoint: string) {
  const explicit = process.env.MCP_CHATGPT_EXPECT_PROFILE;
  if (explicit) return explicit.toLowerCase();

  try {
    const url = new URL(endpoint);
    const urlProfile = url.searchParams.get("profile") || url.searchParams.get("mcp_app_profile");
    if (urlProfile) return urlProfile.toLowerCase();
  } catch {
    // Ignore invalid URL here; the transport constructor will report it later.
  }

  return (process.env.MCP_APP_PROFILE || "default").toLowerCase();
}

function summarizeToolResult(result: unknown) {
  if (!result || typeof result !== "object") return { type: typeof result };
  const record = result as Record<string, unknown>;
  const structured = record.structuredContent;
  const content = record.content;

  return {
    hasStructuredContent: Boolean(structured),
    structuredKeys:
      structured && typeof structured === "object" && !Array.isArray(structured)
        ? Object.keys(structured as Record<string, unknown>).slice(0, 12)
        : [],
    contentItems: Array.isArray(content) ? content.length : 0,
  };
}

async function main() {
  const options = parseArgs();
  const endpoint = endpointFromEnv();
  const bearerToken = bearerTokenFromEnv();
  const expectedProfile = expectedProfileFromEnv(endpoint);
  const requireChatGptProfile = expectedProfile === "chatgpt";
  const requiredToolChecks = requireChatGptProfile
    ? [...BASE_REQUIRED_TOOL_CHECKS, ...CHATGPT_APP_TOOL_CHECKS]
    : BASE_REQUIRED_TOOL_CHECKS;

  if (!bearerToken) {
    throw new Error(
      [
        "Missing MCP bearer token.",
        "Set MCP_CHATGPT_DEV_TOKEN to an a8n MCP API key.",
        "Create one with: pnpm mcp:seed-key",
      ].join(" "),
    );
  }

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  const client = new Client(
    {
      name: "a8n-chatgpt-phase1-check",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );

  const report = {
    phase: requireChatGptProfile ? "chatgpt-app-phase-2-3" : "chatgpt-app-phase-1",
    endpoint,
    expectedProfile,
    generatedAt: new Date().toISOString(),
    connected: false,
    toolCount: 0,
    requiredTools: [] as Array<{ name: string; found: boolean }>,
    forbiddenTools: [] as Array<{ name: string; absent: boolean }>,
    widgetResources: [] as Array<{
      uri: string;
      found: boolean;
      read?: boolean;
      appMime?: boolean;
      hasMeta?: boolean;
      error?: string;
    }>,
    toolCalls: [] as Array<{ name: string; ok: boolean; summary?: unknown; error?: string }>,
  };

  try {
    await client.connect(transport);
    report.connected = true;

    const toolsResult = await client.listTools();
    const toolNames = new Set(toolsResult.tools.map((tool) => tool.name));
    report.toolCount = toolsResult.tools.length;
    report.requiredTools = requiredToolChecks.map((tool) => ({
      name: tool.name,
      found: toolNames.has(tool.name),
    }));
    report.forbiddenTools = requireChatGptProfile
      ? CHATGPT_FORBIDDEN_TOOLS.map((name) => ({
          name,
          absent: !toolNames.has(name),
        }))
      : [];

    const missing = report.requiredTools.filter((tool) => !tool.found);
    if (missing.length > 0) {
      throw new Error(`Missing required tools: ${missing.map((tool) => tool.name).join(", ")}`);
    }

    const exposedForbidden = report.forbiddenTools.filter((tool) => !tool.absent);
    if (exposedForbidden.length > 0) {
      throw new Error(
        `ChatGPT profile exposed forbidden tools: ${exposedForbidden.map((tool) => tool.name).join(", ")}`,
      );
    }

    if (requireChatGptProfile && !options.skipResources) {
      const resourcesResult = await client.listResources();
      const resourceUris = new Set(resourcesResult.resources.map((resource) => resource.uri));
      for (const uri of CHATGPT_WIDGET_RESOURCE_URIS) {
        const resourceReport = {
          uri,
          found: resourceUris.has(uri),
          read: false,
          appMime: false,
          hasMeta: false,
          error: undefined as string | undefined,
        };

        if (resourceReport.found) {
          try {
            const readResult = await client.readResource({ uri });
            const first = readResult.contents[0];
            resourceReport.read = Boolean(first);
            resourceReport.appMime = first?.mimeType === "text/html;profile=mcp-app";
            resourceReport.hasMeta = Boolean(first?._meta);
          } catch (error) {
            resourceReport.error = error instanceof Error ? error.message : String(error);
          }
        }
        report.widgetResources.push(resourceReport);
      }
    }

    if (!options.skipCalls) {
      for (const tool of requiredToolChecks.filter((item) => item.call)) {
        try {
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.callArgs || {},
          });
          report.toolCalls.push({
            name: tool.name,
            ok: true,
            summary: summarizeToolResult(result),
          });
        } catch (error) {
          report.toolCalls.push({
            name: tool.name,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } finally {
    await client.close().catch(() => undefined);
  }

  const failedCalls = report.toolCalls.filter((call) => !call.ok);
  const failedResources = report.widgetResources.filter(
    (resource) =>
      !resource.found || !resource.read || !resource.appMime || !resource.hasMeta,
  );
  const passed =
    report.connected &&
    report.requiredTools.every((tool) => tool.found) &&
    report.forbiddenTools.every((tool) => tool.absent) &&
    failedResources.length === 0 &&
    failedCalls.length === 0;

  if (options.json) {
    console.log(JSON.stringify({ ...report, passed }, null, 2));
  } else {
    console.log(
      `a8n ChatGPT Apps ${requireChatGptProfile ? "Phase 2/3" : "Phase 1"} readiness check`,
    );
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Expected profile: ${expectedProfile}`);
    console.log(`Connected: ${report.connected ? "yes" : "no"}`);
    console.log(`Discovered tools: ${report.toolCount}`);
    console.log("");
    console.log("Required tools:");
    for (const tool of report.requiredTools) {
      console.log(`- ${tool.name}: ${tool.found ? "found" : "missing"}`);
    }
    if (report.forbiddenTools.length > 0) {
      console.log("");
      console.log("Forbidden tools:");
      for (const tool of report.forbiddenTools) {
        console.log(`- ${tool.name}: ${tool.absent ? "absent" : "exposed"}`);
      }
    }
    if (report.widgetResources.length > 0) {
      console.log("");
      console.log("Widget resources:");
      for (const resource of report.widgetResources) {
        const ok = resource.found && resource.read && resource.appMime && resource.hasMeta;
        console.log(`- ${resource.uri}: ${ok ? "ok" : "failed"}`);
      }
    }
    if (!options.skipCalls) {
      console.log("");
      console.log("Tool calls:");
      for (const call of report.toolCalls) {
        console.log(`- ${call.name}: ${call.ok ? "ok" : `failed (${call.error})`}`);
      }
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("ChatGPT Apps readiness check failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
