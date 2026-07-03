import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CHATGPT_APP_SUBMISSION_PROMPTS } from "../src/mcp/apps/submission-assets";
import { CHATGPT_WIDGET_URIS } from "../src/mcp/apps/widget-resources";
import { CHATGPT_APP_EVALS } from "../src/mcp/evals/chatgpt-app-goals";
import {
  CHATGPT_APP_TOOL_POLICY,
  CHATGPT_FORBIDDEN_TOOLS,
} from "../src/mcp/safety/app-tool-policy";
import { detectPromptInjectionWarnings } from "../src/mcp/shared/safety";

type StepStatus = "passed" | "failed" | "skipped";

type TraceStep = {
  id: string;
  title: string;
  status: StepStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  details?: unknown;
  error?: string;
};

type Trace = {
  suite: "mcp-live-eval";
  generatedAt: string;
  mode: "offline-contract" | "live-readonly" | "live-mutating";
  endpoint: string;
  requireLive: boolean;
  mutating: boolean;
  tracePath?: string;
  summary?: {
    passed: boolean;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
  steps: TraceStep[];
};

const REQUIRED_LIVE_TOOLS = [
  "server_info",
  "whoami",
  "list_node_types",
  "list_workflows",
  "create_workflow_draft",
  "validate_workflow_draft",
  "preview_workflow_diff",
  "render_workflow_draft_preview",
  "render_workflow_setup_checklist",
  "render_execution_timeline",
  "render_workflow_approval",
  "apply_workflow_draft",
  "run_workflow_test",
  "get_execution_timeline",
  "diagnose_execution",
];

const READ_ONLY_TOOL_CALLS = [
  { name: "server_info", arguments: {} },
  { name: "whoami", arguments: {} },
  { name: "list_node_types", arguments: {} },
  { name: "list_workflows", arguments: { page: 1, pageSize: 5, search: "" } },
];

const DEFAULT_DRAFT_GOAL =
  "Create a safe test workflow that accepts manual sample data, summarizes the message, and returns the summary without sending external emails or webhooks.";

function parseArgs() {
  const args = process.argv.slice(2);
  const readValue = (name: string) => {
    const prefix = `${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    json: args.includes("--json"),
    offline: args.includes("--offline"),
    requireLive: args.includes("--require-live"),
    mutating: args.includes("--mutating"),
    endpoint: readValue("--endpoint"),
    apiKey: readValue("--api-key"),
    outDir: readValue("--out-dir"),
    goal: readValue("--goal") || process.env.MCP_LIVE_EVAL_GOAL || DEFAULT_DRAFT_GOAL,
  };
}

function endpointFromEnv() {
  const explicit =
    process.env.MCP_LIVE_EVAL_URL ||
    process.env.MCP_CHATGPT_DEV_URL ||
    process.env.MCP_ENDPOINT_URL ||
    process.env.MCP_SERVER_URL;
  if (explicit) return explicit;

  const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
  if (ngrokUrl) return `${ngrokUrl}/api/mcp?profile=chatgpt`;

  return "http://localhost:3000/api/mcp?profile=chatgpt";
}

function tokenFromEnv() {
  return (
    process.env.MCP_LIVE_EVAL_TOKEN ||
    process.env.MCP_CHATGPT_DEV_TOKEN ||
    process.env.MCP_API_KEY ||
    process.env.A8N_MCP_API_KEY ||
    ""
  );
}

function dateStamp() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function defaultOutDir() {
  return path.join(process.cwd(), "docs", "mcp", "evidence", "live-evals", dateStamp());
}

function redactString(value: string, apiKey: string) {
  let output = apiKey ? value.split(apiKey).join("[REDACTED_API_KEY]") : value;
  output = output
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\b(?:xox[baprs]-|ghp_|AIza)[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_ -]?key|token|secret|authorization)(["':=\s]+)[^\s<>"']{8,}/gi, "$1$2[REDACTED]");
  return output;
}

function redactForTrace(value: unknown, apiKey: string): unknown {
  if (typeof value === "string") return redactString(value, apiKey);
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactForTrace(item, apiKey));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, apiKey),
    };
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redactForTrace(item, apiKey),
      ]),
    );
  }
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function summarizeToolResult(result: unknown) {
  const record = asRecord(result);
  const structured = asRecord(record?.structuredContent);
  const meta = asRecord(record?._meta);
  const content = Array.isArray(record?.content) ? record.content : [];

  return {
    isError: record?.isError === true,
    structuredKeys: structured ? Object.keys(structured).slice(0, 20) : [],
    contentItems: content.length,
    metaKeys: meta ? Object.keys(meta).slice(0, 20) : [],
    draftId: extractDraftId(result),
    workflowId: extractWorkflowId(result),
    confirmationHash: extractConfirmationHash(result),
  };
}

function extractDraftId(result: unknown) {
  const structured = asRecord(asRecord(result)?.structuredContent);
  const draft = asRecord(structured?.draft);
  const workflowDraft = asRecord(structured?.workflowDraft);
  return firstString(
    draft?.id,
    workflowDraft?.id,
    structured?.draftId,
    structured?.workflowDraftId,
  );
}

function extractWorkflowId(result: unknown) {
  const structured = asRecord(asRecord(result)?.structuredContent);
  const workflow = asRecord(structured?.workflow);
  const applied = asRecord(structured?.applied);
  return firstString(workflow?.id, applied?.workflowId, structured?.workflowId);
}

function extractConfirmationHash(result: unknown) {
  const structured = asRecord(asRecord(result)?.structuredContent);
  const approval = asRecord(structured?.approval);
  const diff = asRecord(structured?.diff);
  return firstString(
    approval?.confirmationHash,
    diff?.confirmationHash,
    structured?.confirmationHash,
  );
}

function looksLikeExpectedApprovalRejection(result: unknown) {
  const record = asRecord(result);
  if (record?.isError === true) return true;
  const serialized = JSON.stringify(result).toLowerCase();
  return (
    serialized.includes("approval") &&
    (serialized.includes("required") ||
      serialized.includes("approved") ||
      serialized.includes("confirmation"))
  );
}

function evaluateGoldenPrompts(liveToolNames?: Set<string>) {
  const policyTools = new Set(Object.keys(CHATGPT_APP_TOOL_POLICY));
  const forbiddenTools = new Set(CHATGPT_FORBIDDEN_TOOLS);
  const cases = CHATGPT_APP_EVALS.map((item) => {
    const errors: string[] = [];

    for (const tool of item.expected.tools) {
      const policy = CHATGPT_APP_TOOL_POLICY[tool as keyof typeof CHATGPT_APP_TOOL_POLICY];
      if (!policyTools.has(tool)) errors.push(`Expected tool missing from policy: ${tool}`);
      if (policy?.requiresApproval && !item.expected.approvalTools.includes(tool)) {
        errors.push(`Approval tool omitted from approvalTools: ${tool}`);
      }
      if (forbiddenTools.has(tool as (typeof CHATGPT_FORBIDDEN_TOOLS)[number])) {
        errors.push(`Forbidden tool appears in expected path: ${tool}`);
      }
      if (liveToolNames && !liveToolNames.has(tool)) {
        errors.push(`Expected tool missing from live server: ${tool}`);
      }
    }

    for (const approvalTool of item.expected.approvalTools) {
      const policy = CHATGPT_APP_TOOL_POLICY[approvalTool as keyof typeof CHATGPT_APP_TOOL_POLICY];
      if (!policy?.requiresApproval) {
        errors.push(`Approval tool is not contract-gated: ${approvalTool}`);
      }
    }

    for (const forbiddenTool of item.expected.forbiddenTools) {
      if (item.expected.tools.includes(forbiddenTool)) {
        errors.push(`Forbidden tool also appears in expected tools: ${forbiddenTool}`);
      }
    }

    if (item.expected.safetyPatterns.length > 0) {
      const warnings = detectPromptInjectionWarnings(item.adversarialToolOutput);
      const found = new Set(warnings.map((warning) => warning.pattern));
      for (const pattern of item.expected.safetyPatterns) {
        if (!found.has(pattern)) errors.push(`Missing safety detector pattern: ${pattern}`);
      }
    }

    return {
      id: item.id,
      passed: errors.length === 0,
      expectedTools: item.expected.tools,
      expectedWidgets: item.expected.widgets,
      approvalTools: item.expected.approvalTools,
      forbiddenTools: item.expected.forbiddenTools,
      errors,
    };
  });

  const submissionPrompts = CHATGPT_APP_SUBMISSION_PROMPTS.map((item) => {
    const errors: string[] = [];
    for (const tool of item.expectedTools) {
      if (!policyTools.has(tool)) errors.push(`Submission prompt tool missing from policy: ${tool}`);
      if (forbiddenTools.has(tool as (typeof CHATGPT_FORBIDDEN_TOOLS)[number])) {
        errors.push(`Submission prompt expects forbidden tool: ${tool}`);
      }
      if (liveToolNames && !liveToolNames.has(tool)) {
        errors.push(`Submission prompt tool missing from live server: ${tool}`);
      }
    }
    if (item.kind === "negative" && item.expectedTools.length > 0) {
      errors.push("Negative submission prompt expects tool calls.");
    }
    return {
      id: item.id,
      kind: item.kind,
      passed: errors.length === 0,
      expectedTools: item.expectedTools,
      expectedWidgets: item.expectedWidgets,
      errors,
    };
  });

  const negativePromptCases = submissionPrompts.filter((item) => item.kind === "negative");
  const failures = [
    ...cases.filter((item) => !item.passed),
    ...submissionPrompts.filter((item) => !item.passed),
  ];
  return {
    totalCases: cases.length,
    passedCases: cases.filter((item) => item.passed).length,
    negativePromptCases: negativePromptCases.map((item) => ({
      id: item.id,
      expectedTools: item.expectedTools,
      passed: item.passed && item.expectedTools.length === 0,
    })),
    failures,
    cases,
    submissionPrompts,
  };
}

async function addStep<T>(
  trace: Trace,
  apiKey: string,
  id: string,
  title: string,
  run: () => Promise<T>,
): Promise<T | undefined> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  try {
    const details = await run();
    const completed = Date.now();
    trace.steps.push({
      id,
      title,
      status: "passed",
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - started,
      details: redactForTrace(details, apiKey),
    });
    return details;
  } catch (error) {
    const completed = Date.now();
    trace.steps.push({
      id,
      title,
      status: "failed",
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - started,
      error:
        error instanceof Error
          ? redactString(error.message, apiKey)
          : redactString(String(error), apiKey),
    });
    return undefined;
  }
}

function addSkippedStep(trace: Trace, id: string, title: string, details: unknown = {}) {
  const now = new Date().toISOString();
  trace.steps.push({
    id,
    title,
    status: "skipped",
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    details,
  });
}

function writeTrace(trace: Trace, apiKey: string, outDir: string) {
  const failedSteps = trace.steps.filter((step) => step.status === "failed").length;
  const passedSteps = trace.steps.filter((step) => step.status === "passed").length;
  const skippedSteps = trace.steps.filter((step) => step.status === "skipped").length;
  trace.summary = {
    passed: failedSteps === 0,
    passedSteps,
    failedSteps,
    skippedSteps,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const tracePath = path.join(outDir, "mcp-live-eval.json");
  trace.tracePath = tracePath;
  fs.writeFileSync(
    tracePath,
    `${JSON.stringify(redactForTrace(trace, apiKey), null, 2)}\n`,
    "utf8",
  );
  return tracePath;
}

async function main() {
  const options = parseArgs();
  const endpoint = options.endpoint || endpointFromEnv();
  const apiKey = options.apiKey || tokenFromEnv();
  const outDir = options.outDir || defaultOutDir();
  const liveAvailable = !options.offline && Boolean(endpoint && apiKey);
  const mode = liveAvailable
    ? options.mutating
      ? "live-mutating"
      : "live-readonly"
    : "offline-contract";
  const trace: Trace = {
    suite: "mcp-live-eval",
    generatedAt: new Date().toISOString(),
    mode,
    endpoint: redactString(endpoint, apiKey),
    requireLive: options.requireLive,
    mutating: options.mutating,
    steps: [],
  };

  let client: Client | null = null;
  let liveToolNames: Set<string> | undefined;
  let draftId: string | undefined;
  let confirmationHash: string | undefined;
  let workflowId = process.env.MCP_LIVE_EVAL_WORKFLOW_ID || "";

  if (!liveAvailable) {
    if (options.requireLive) {
      trace.steps.push({
        id: "live-required",
        title: "Live endpoint and bearer token are required",
        status: "failed",
        startedAt: trace.generatedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        error:
          "Set MCP_LIVE_EVAL_URL and MCP_LIVE_EVAL_TOKEN, or MCP_CHATGPT_DEV_URL and MCP_CHATGPT_DEV_TOKEN.",
      });
    } else {
      addSkippedStep(trace, "live-connect", "Live MCP client checks", {
        reason: "No live MCP credential was configured; running contract harness only.",
      });
    }
  } else {
    const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });
    client = new Client(
      { name: "a8n-mcp-live-eval", version: "0.1.0" },
      { capabilities: {} },
    );

    await addStep(trace, apiKey, "initialize", "Initialize MCP client", async () => {
      await client?.connect(transport);
      return { connected: true };
    });

    await addStep(trace, apiKey, "list-tools", "List and validate MCP tools", async () => {
      if (!client) throw new Error("MCP client was not initialized.");
      const toolsResult = await client.listTools();
      liveToolNames = new Set(toolsResult.tools.map((tool) => tool.name));
      const missing = REQUIRED_LIVE_TOOLS.filter((tool) => !liveToolNames?.has(tool));
      const exposedForbidden = CHATGPT_FORBIDDEN_TOOLS.filter((tool) => liveToolNames?.has(tool));
      if (missing.length > 0) throw new Error(`Missing live tools: ${missing.join(", ")}`);
      if (exposedForbidden.length > 0) {
        throw new Error(`Forbidden tools exposed by live server: ${exposedForbidden.join(", ")}`);
      }
      return {
        toolCount: toolsResult.tools.length,
        requiredTools: REQUIRED_LIVE_TOOLS,
        forbiddenToolsAbsent: CHATGPT_FORBIDDEN_TOOLS,
      };
    });

    await addStep(trace, apiKey, "list-resources", "List widget resources", async () => {
      if (!client) throw new Error("MCP client was not initialized.");
      const resourcesResult = await client.listResources();
      const resourceUris = new Set(resourcesResult.resources.map((resource) => resource.uri));
      const missing = Object.values(CHATGPT_WIDGET_URIS).filter((uri) => !resourceUris.has(uri));
      if (missing.length > 0) throw new Error(`Missing widget resources: ${missing.join(", ")}`);
      return {
        resourceCount: resourcesResult.resources.length,
        widgetResources: Object.values(CHATGPT_WIDGET_URIS),
      };
    });

    await addStep(trace, apiKey, "read-widget-resources", "Read widget resource HTML", async () => {
      if (!client) throw new Error("MCP client was not initialized.");
      const resources = [];
      for (const uri of Object.values(CHATGPT_WIDGET_URIS)) {
        const result = await client.readResource({ uri });
        const first = result.contents[0];
        const firstRecord = asRecord(first);
        resources.push({
          uri,
          mimeType: first?.mimeType,
          hasMeta: Boolean(first?._meta),
          textLength: typeof firstRecord?.text === "string" ? firstRecord.text.length : 0,
        });
        if (first?.mimeType !== "text/html;profile=mcp-app") {
          throw new Error(`Widget ${uri} returned wrong mime type: ${first?.mimeType}`);
        }
      }
      return { resources };
    });

    await addStep(trace, apiKey, "read-only-tool-calls", "Call read-only MCP tools", async () => {
      if (!client) throw new Error("MCP client was not initialized.");
      const calls = [];
      for (const call of READ_ONLY_TOOL_CALLS) {
        const result = await client.callTool(call);
        calls.push({ name: call.name, summary: summarizeToolResult(result) });
      }
      return { calls };
    });

    if (options.mutating) {
      const createResult = await addStep(
        trace,
        apiKey,
        "create-workflow-draft",
        "Create a staging workflow draft",
        async () => {
          if (!client) throw new Error("MCP client was not initialized.");
          const result = await client.callTool({
            name: "create_workflow_draft",
            arguments: { goal: options.goal },
          });
          const summary = summarizeToolResult(result);
          if (!summary.draftId) throw new Error("create_workflow_draft did not return a draft id.");
          return { summary };
        },
      );
      draftId = asRecord(createResult)?.summary
        ? String(asRecord(asRecord(createResult)?.summary)?.draftId || "")
        : undefined;

      await addStep(trace, apiKey, "validate-workflow-draft", "Validate staging draft", async () => {
        if (!client) throw new Error("MCP client was not initialized.");
        if (!draftId) throw new Error("No draft id available for validation.");
        const result = await client.callTool({
          name: "validate_workflow_draft",
          arguments: { draftId },
        });
        return { summary: summarizeToolResult(result) };
      });

      const previewResult = await addStep(
        trace,
        apiKey,
        "preview-workflow-diff",
        "Preview staging draft diff",
        async () => {
          if (!client) throw new Error("MCP client was not initialized.");
          if (!draftId) throw new Error("No draft id available for diff preview.");
          const result = await client.callTool({
            name: "preview_workflow_diff",
            arguments: { draftId },
          });
          const summary = summarizeToolResult(result);
          if (!summary.confirmationHash) {
            throw new Error("preview_workflow_diff did not return a confirmation hash.");
          }
          return { summary };
        },
      );
      confirmationHash = asRecord(previewResult)?.summary
        ? String(asRecord(asRecord(previewResult)?.summary)?.confirmationHash || "")
        : undefined;

      await addStep(trace, apiKey, "render-draft-preview", "Render draft preview widget", async () => {
        if (!client) throw new Error("MCP client was not initialized.");
        if (!draftId) throw new Error("No draft id available for render.");
        const result = await client.callTool({
          name: "render_workflow_draft_preview",
          arguments: { draftId },
        });
        return { summary: summarizeToolResult(result) };
      });

      await addStep(trace, apiKey, "render-approval", "Render approval widget", async () => {
        if (!client) throw new Error("MCP client was not initialized.");
        if (!draftId) throw new Error("No draft id available for approval render.");
        const result = await client.callTool({
          name: "render_workflow_approval",
          arguments: { draftId },
        });
        return { summary: summarizeToolResult(result) };
      });

      await addStep(
        trace,
        apiKey,
        "reject-apply-without-approval",
        "Reject apply_workflow_draft without approval",
        async () => {
          if (!client) throw new Error("MCP client was not initialized.");
          if (!draftId || !confirmationHash) {
            throw new Error("No draft id or confirmation hash available for negative apply test.");
          }
          let result: unknown;
          try {
            result = await client.callTool({
              name: "apply_workflow_draft",
              arguments: { draftId, approved: false, confirmationHash },
            });
          } catch (error) {
            return {
              rejected: true,
              transportError: error instanceof Error ? error.message : String(error),
            };
          }
          if (!looksLikeExpectedApprovalRejection(result)) {
            throw new Error("apply_workflow_draft did not reject the unapproved call.");
          }
          return { rejected: true, summary: summarizeToolResult(result) };
        },
      );

      const applyResult = await addStep(
        trace,
        apiKey,
        "apply-with-confirmation-hash",
        "Apply staging draft with approval hash",
        async () => {
          if (!client) throw new Error("MCP client was not initialized.");
          if (!draftId || !confirmationHash) {
            throw new Error("No draft id or confirmation hash available for approved apply test.");
          }
          const result = await client.callTool({
            name: "apply_workflow_draft",
            arguments: { draftId, approved: true, confirmationHash },
          });
          const summary = summarizeToolResult(result);
          return { summary };
        },
      );
      workflowId =
        (asRecord(applyResult)?.summary
          ? String(asRecord(asRecord(applyResult)?.summary)?.workflowId || "")
          : "") ||
        workflowId ||
        "";

      if (workflowId) {
        await addStep(
          trace,
          apiKey,
          "run-workflow-test",
          "Run staging workflow test with approval",
          async () => {
            if (!client) throw new Error("MCP client was not initialized.");
            const result = await client.callTool({
              name: "run_workflow_test",
              arguments: { workflowId, trigger: "manual", approved: true },
            });
            return { summary: summarizeToolResult(result) };
          },
        );
      } else {
        addSkippedStep(trace, "run-workflow-test", "Run staging workflow test with approval", {
          reason: "No workflow id was returned or configured.",
        });
      }
    } else {
      addSkippedStep(trace, "mutating-tool-sequence", "Draft/apply/run workflow sequence", {
        reason: "Pass --mutating against a staging database to enable write and execution checks.",
      });
    }

    const executionId = process.env.MCP_LIVE_EVAL_EXECUTION_ID || "";
    if (executionId) {
      await addStep(
        trace,
        apiKey,
        "diagnose-malicious-execution",
        "Diagnose seeded adversarial failed execution",
        async () => {
          if (!client) throw new Error("MCP client was not initialized.");
          const result = await client.callTool({
            name: "diagnose_execution",
            arguments: { executionId },
          });
          return { summary: summarizeToolResult(result) };
        },
      );
    } else {
      addSkippedStep(trace, "diagnose-malicious-execution", "Diagnose seeded adversarial failed execution", {
        reason: "Set MCP_LIVE_EVAL_EXECUTION_ID to exercise a seeded failed execution.",
      });
    }
  }

  await addStep(trace, apiKey, "golden-prompt-harness", "Evaluate golden prompt policy", async () => {
    const result = evaluateGoldenPrompts(liveToolNames);
    if (result.failures.length > 0) {
      throw new Error(`Golden prompt failures: ${result.failures.map((item) => item.id).join(", ")}`);
    }
    const negativeFailures = result.negativePromptCases.filter((item) => !item.passed);
    if (negativeFailures.length > 0) {
      throw new Error(
        `Negative prompt cases expect unintended tool calls: ${negativeFailures.map((item) => item.id).join(", ")}`,
      );
    }
    return result;
  });

  if (client) {
    await client.close().catch(() => undefined);
  }

  const tracePath = writeTrace(trace, apiKey, outDir);
  const passed = trace.summary?.passed === true;

  if (options.json) {
    console.log(JSON.stringify(redactForTrace(trace, apiKey), null, 2));
  } else {
    console.log("a8n MCP live eval");
    console.log(`Mode: ${trace.mode}`);
    console.log(`Endpoint: ${trace.endpoint}`);
    console.log(`Trace: ${tracePath}`);
    console.log("");
    for (const step of trace.steps) {
      console.log(`- ${step.id}: ${step.status}`);
      if (step.error) console.log(`  ${step.error}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("MCP live eval failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
