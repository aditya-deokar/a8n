import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { ExecutionStatus, NodeType, type Prisma } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { sendWorkflowExecution } from "@/inngest/utils";
import {
  asGraphEdges,
  asGraphNodes,
  createWorkflowVersion,
  getWorkflowGraph,
  replaceWorkflowGraph,
  stableHash,
  validateWorkflowGraph,
  type WorkflowGraphEdge,
  type WorkflowGraphNode,
} from "@/mcp/tools/workflows/workflow-graph-utils";
import { getNodeManifest } from "@/features/workflows/node-manifest";

const testTriggerSchema = z.enum(["manual", "google_form", "stripe"]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleInitialData(trigger: "manual" | "google_form" | "stripe", sampleData?: Record<string, unknown>) {
  if (sampleData) return sampleData;
  if (trigger === "google_form") {
    return {
      googleForm: {
        formId: "sample-form-id",
        formTitle: "Sample Customer Feedback",
        responseId: "sample-response-id",
        timestamp: new Date().toISOString(),
        respondentEmail: "student@example.com",
        responses: {
          Name: "Alex",
          Feedback: "I need help understanding automation setup.",
          Score: "8",
        },
        raw: { source: "mcp-test" },
      },
    };
  }
  if (trigger === "stripe") {
    return {
      stripe: {
        eventId: "evt_sample_payment_succeeded",
        eventType: "payment_intent.succeeded",
        timestamp: Math.floor(Date.now() / 1000),
        livemode: false,
        raw: {
          id: "pi_sample",
          amount: 2500,
          currency: "usd",
          customer: "cus_sample",
          status: "succeeded",
        },
      },
    };
  }
  return {};
}

async function waitForExecutionByEventId(params: {
  userId: string;
  inngestEventId: string;
  timeoutMs: number;
  pollMs: number;
}) {
  const started = Date.now();
  let execution = null;

  while (Date.now() - started <= params.timeoutMs) {
    execution = await prisma.execution.findFirst({
      where: {
        inngestEventId: params.inngestEventId,
        workflow: { userId: params.userId },
      },
      include: { workflow: { select: { id: true, name: true } } },
    });

    if (execution && execution.status !== ExecutionStatus.RUNNING) {
      return { execution, timedOut: false };
    }

    await sleep(params.pollMs);
  }

  return { execution, timedOut: true };
}

async function loadExecutionForUser(params: {
  userId: string;
  executionId?: string;
  inngestEventId?: string;
}) {
  if (!params.executionId && !params.inngestEventId) {
    throw new Error("Provide executionId or inngestEventId.");
  }

  const execution = await prisma.execution.findFirstOrThrow({
    where: {
      id: params.executionId,
      inngestEventId: params.inngestEventId,
      workflow: { userId: params.userId },
    },
    include: {
      workflow: {
        include: {
          nodes: true,
          connections: true,
        },
      },
    },
  });

  return execution;
}

function summarizeOutput(output: unknown) {
  if (!output || typeof output !== "object") return output ?? null;
  return Object.entries(output as Record<string, unknown>).map(([key, value]) => ({
    key,
    type: Array.isArray(value) ? "array" : typeof value,
    preview:
      typeof value === "string"
        ? value.slice(0, 240)
        : JSON.stringify(value).slice(0, 240),
  }));
}

function classifyExecutionError(error?: string | null) {
  const message = (error || "").toLowerCase();
  if (!message) {
    return {
      category: "none",
      beginnerExplanation: "No error was recorded.",
      likelyCause: "The execution may still be running or completed successfully.",
      fixOptions: [],
      safeToAutoApply: false,
    };
  }

  if (message.includes("credential") && (message.includes("missing") || message.includes("required") || message.includes("not found"))) {
    return {
      category: "missing_credential",
      beginnerExplanation: "A step needs a saved connection before it can run.",
      likelyCause: error,
      fixOptions: [
        "Create or select the required credential.",
        "Update the node's credentialId.",
        "Run test_credential before testing again.",
      ],
      safeToAutoApply: false,
    };
  }
  if (message.includes("json")) {
    return {
      category: "invalid_json",
      beginnerExplanation: "A field that should contain JSON is not valid after variables were filled in.",
      likelyCause: error,
      fixOptions: [
        "Check HTTP request body or Google Sheets row JSON.",
        "Use quotes around text template variables.",
        "Run validate_workflow_draft after editing.",
      ],
      safeToAutoApply: false,
    };
  }
  if (message.includes("not configured") || message.includes("missing") || message.includes("required")) {
    return {
      category: "missing_field",
      beginnerExplanation: "A step is missing required setup information.",
      likelyCause: error,
      fixOptions: [
        "Open the setup checklist.",
        "Fill the missing field with answer_workflow_draft_questions or update_node_config.",
      ],
      safeToAutoApply: false,
    };
  }
  if (message.includes("http") || message.includes("fetch") || message.includes("request failed")) {
    return {
      category: "http_failure",
      beginnerExplanation: "An external API call failed.",
      likelyCause: error,
      fixOptions: [
        "Check the URL, method, and request body.",
        "Confirm the API is reachable.",
        "Run the workflow with a small test payload.",
      ],
      safeToAutoApply: false,
    };
  }
  if (message.includes("openai") || message.includes("anthropic") || message.includes("gemini") || message.includes("api key")) {
    return {
      category: "provider_api_failure",
      beginnerExplanation: "An AI provider call failed.",
      likelyCause: error,
      fixOptions: [
        "Run test_credential for the AI credential.",
        "Check provider quota and key permissions.",
        "Simplify the prompt and retry.",
      ],
      safeToAutoApply: false,
    };
  }
  if (message.includes("cycle")) {
    return {
      category: "cycle_or_graph_error",
      beginnerExplanation: "The workflow graph has an invalid loop.",
      likelyCause: error,
      fixOptions: ["Remove the loop with disconnect_workflow_nodes."],
      safeToAutoApply: false,
    };
  }
  if (message.includes("timeout")) {
    return {
      category: "timeout",
      beginnerExplanation: "A step took too long to finish.",
      likelyCause: error,
      fixOptions: [
        "Retry once.",
        "Check whether an external service is slow.",
        "Reduce the size of data sent to external APIs.",
      ],
      safeToAutoApply: false,
    };
  }

  return {
    category: "unknown",
    beginnerExplanation: "The workflow failed, but the error does not match a known pattern yet.",
    likelyCause: error,
    fixOptions: [
      "Read get_execution_timeline.",
      "Inspect the failing node's required fields.",
      "Create a repair draft with suggest_workflow_fix.",
    ],
    safeToAutoApply: false,
  };
}

function buildTimeline(execution: Awaited<ReturnType<typeof loadExecutionForUser>>) {
  const nodes = execution.workflow.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position as { x?: number; y?: number },
      data: (node.data as Record<string, unknown>) || {},
    }))
    .sort((a, b) => (a.position.x || 0) - (b.position.x || 0));
  const diagnosis = classifyExecutionError(execution.error);

  return nodes.map((node, index) => {
    const manifest = getNodeManifest(node.type);
    const failedHere =
      execution.status === ExecutionStatus.FAILED &&
      execution.error?.toLowerCase().includes(node.type.toLowerCase().replaceAll("_", " "));

    return {
      order: index + 1,
      nodeId: node.id,
      nodeType: node.type,
      label: manifest.label,
      status:
        execution.status === ExecutionStatus.SUCCESS
          ? "success"
          : failedHere
            ? "failed"
            : execution.status === ExecutionStatus.RUNNING
              ? "unknown_running"
              : "unknown",
      visibleConfig: Object.fromEntries(
        Object.entries(node.data).filter(([key]) =>
          ["variableName", "method", "endpoint", "to", "subject", "sheetName", "spreadsheetId"].includes(key),
        ),
      ),
      outputSummary:
        execution.status === ExecutionStatus.SUCCESS && node.data.variableName
          ? summarizeOutput((execution.output as Record<string, unknown> | null)?.[String(node.data.variableName)])
          : null,
      error: failedHere ? execution.error : null,
      diagnosisCategory: failedHere ? diagnosis.category : null,
    };
  });
}

export function registerExecuteWorkflowAndWait(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "execute_workflow_and_wait",
    "Execute a workflow and poll until success, failure, or timeout. Returns execution status, event ID, output summary, and next action.",
    {
      workflowId: z.string(),
      timeoutMs: z.number().min(1000).max(120000).default(30000),
      pollMs: z.number().min(250).max(5000).default(1000),
      initialData: z.record(z.string(), z.unknown()).optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:execute");
      requireScope(auth, "executions:read");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "execute_workflow_and_wait",
        input: { workflowId: args.workflowId, timeoutMs: args.timeoutMs },
      });

      return withErrorBoundary("execute_workflow_and_wait", async () => {
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });
        const event = await sendWorkflowExecution({
          workflowId: args.workflowId,
          initialData: args.initialData || {},
        });
        const waited = await waitForExecutionByEventId({
          userId: auth.userId,
          inngestEventId: event.eventId,
          timeoutMs: args.timeoutMs,
          pollMs: args.pollMs,
        });

        audit.success();
        return mcpJsonResponse({
          workflowId: workflow.id,
          workflowName: workflow.name,
          inngestEventId: event.eventId,
          timedOut: waited.timedOut,
          execution: waited.execution
            ? {
                id: waited.execution.id,
                status: waited.execution.status,
                startedAt: waited.execution.startedAt,
                completedAt: waited.execution.completedAt,
                error: waited.execution.error,
                outputSummary: summarizeOutput(waited.execution.output),
              }
            : null,
          nextAction: waited.timedOut
            ? "Call get_execution_timeline later with the returned event ID."
            : waited.execution?.status === ExecutionStatus.FAILED
              ? "Call diagnose_execution for beginner-friendly repair guidance."
              : "Review the output summary.",
        });
      });
    },
  );
}

export function registerRunWorkflowTest(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "run_workflow_test",
    "Run a workflow with manual, Google Form, or Stripe sample data. Requires approval because workflow steps may send messages, emails, or external API calls.",
    {
      workflowId: z.string(),
      trigger: testTriggerSchema.default("manual"),
      sampleData: z.record(z.string(), z.unknown()).optional(),
      wait: z.boolean().default(true),
      timeoutMs: z.number().min(1000).max(120000).default(30000),
      approved: z.boolean().default(false),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:execute");
      if (args.wait) requireScope(auth, "executions:read");

      return withErrorBoundary("run_workflow_test", async () => {
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });
        const initialData = sampleInitialData(args.trigger, args.sampleData);

        if (!args.approved) {
          return mcpJsonResponse({
            triggered: false,
            approvalRequired: true,
            workflowId: args.workflowId,
            trigger: args.trigger,
            initialData,
            warning:
              "Running a workflow can trigger side effects such as email, Slack, Discord, HTTP requests, or Google Sheets writes.",
            instruction: "Call again with approved: true after the user approves this test run.",
          });
        }

        const event = await sendWorkflowExecution({
          workflowId: args.workflowId,
          initialData,
          testMode: true,
          testSource: args.trigger,
        });

        if (!args.wait) {
          return mcpJsonResponse({
            triggered: true,
            workflowId: args.workflowId,
            trigger: args.trigger,
            inngestEventId: event.eventId,
            initialData,
          });
        }

        const waited = await waitForExecutionByEventId({
          userId: auth.userId,
          inngestEventId: event.eventId,
          timeoutMs: args.timeoutMs,
          pollMs: 1000,
        });

        return mcpJsonResponse({
          triggered: true,
          workflowId: args.workflowId,
          trigger: args.trigger,
          inngestEventId: event.eventId,
          initialData,
          timedOut: waited.timedOut,
          execution: waited.execution
            ? {
                id: waited.execution.id,
                status: waited.execution.status,
                error: waited.execution.error,
                outputSummary: summarizeOutput(waited.execution.output),
              }
            : null,
        });
      });
    },
  );
}

export function registerGetExecutionTimeline(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "get_execution_timeline",
    "Return a node-by-node execution timeline with visible config, output summary, error context, and total duration.",
    {
      executionId: z.string().optional(),
      inngestEventId: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "executions:read");

      return withErrorBoundary("get_execution_timeline", async () => {
        const execution = await loadExecutionForUser({
          userId: auth.userId,
          executionId: args.executionId,
          inngestEventId: args.inngestEventId,
        });
        const durationMs = execution.completedAt
          ? execution.completedAt.getTime() - execution.startedAt.getTime()
          : null;

        return mcpJsonResponse({
          executionId: execution.id,
          inngestEventId: execution.inngestEventId,
          workflowId: execution.workflowId,
          workflowName: execution.workflow.name,
          status: execution.status,
          durationMs,
          timeline: buildTimeline(execution),
          outputSummary: summarizeOutput(execution.output),
          error: execution.error,
        });
      });
    },
  );
}

export function registerDiagnoseExecution(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "diagnose_execution",
    "Classify an execution failure and return beginner explanation, likely cause, fix options, and whether the fix is safe to auto-apply.",
    {
      executionId: z.string().optional(),
      inngestEventId: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "executions:read");

      return withErrorBoundary("diagnose_execution", async () => {
        const execution = await loadExecutionForUser({
          userId: auth.userId,
          executionId: args.executionId,
          inngestEventId: args.inngestEventId,
        });
        const nodes = execution.workflow.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position as { x: number; y: number },
          data: (node.data as Record<string, unknown>) || {},
        }));
        const edges = execution.workflow.connections.map((connection) => ({
          id: connection.id,
          source: connection.fromNodeId,
          target: connection.toNodeId,
          sourceHandle: connection.fromOutput,
          targetHandle: connection.toInput,
        }));
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes,
          edges,
        });
        const diagnosis = classifyExecutionError(execution.error);

        return mcpJsonResponse({
          executionId: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          diagnosis,
          validation,
          timeline: buildTimeline(execution),
          nextAction:
            execution.status === ExecutionStatus.FAILED
              ? "Call suggest_workflow_fix to create a repair draft, or make an approved partial edit."
              : "No repair needed unless validation reports warnings.",
        });
      });
    },
  );
}

export function registerSuggestWorkflowFix(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "suggest_workflow_fix",
    "Create a repair draft from the current workflow and execution diagnosis. Does not mutate the live workflow.",
    {
      executionId: z.string().optional(),
      inngestEventId: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");
      requireScope(auth, "executions:read");

      return withErrorBoundary("suggest_workflow_fix", async () => {
        const execution = await loadExecutionForUser({
          userId: auth.userId,
          executionId: args.executionId,
          inngestEventId: args.inngestEventId,
        });
        const diagnosis = classifyExecutionError(execution.error);
        const nodes = execution.workflow.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position as { x: number; y: number },
          data: (node.data as Record<string, unknown>) || {},
        }));
        const edges = execution.workflow.connections.map((connection) => ({
          id: connection.id,
          source: connection.fromNodeId,
          target: connection.toNodeId,
          sourceHandle: connection.fromOutput,
          targetHandle: connection.toInput,
        }));
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes,
          edges,
        });

        const draft = await prisma.workflowDraft.create({
          data: {
            name: `${execution.workflow.name} repair draft`,
            goal: `Repair execution ${execution.id}: ${diagnosis.beginnerExplanation}`,
            workflowId: execution.workflowId,
            userId: auth.userId,
            plan: {
              sourceExecutionId: execution.id,
              diagnosis,
              suggestedFixes: diagnosis.fixOptions,
            } as Prisma.InputJsonValue,
            nodes: nodes as unknown as Prisma.InputJsonValue,
            edges: edges as unknown as Prisma.InputJsonValue,
            missingFields: validation.missingFields as unknown as Prisma.InputJsonValue,
            validation: validation as unknown as Prisma.InputJsonValue,
            status: validation.valid ? "READY" : "DRAFT",
          },
        });

        return mcpJsonResponse({
          draftId: draft.id,
          workflowId: execution.workflowId,
          diagnosis,
          validation,
          suggestedFixes: diagnosis.fixOptions,
          nextStep:
            "Use answer_workflow_draft_questions or safe partial-edit tools to update the repair draft/live workflow, then apply_workflow_fix or apply_workflow_draft after approval.",
        });
      });
    },
  );
}

export function registerApplyWorkflowFix(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "apply_workflow_fix",
    "Apply a repair draft to its workflow after explicit approval and a matching confirmation hash.",
    {
      draftId: z.string(),
      approved: z.boolean().default(false),
      confirmationHash: z.string().optional(),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("apply_workflow_fix", async () => {
        const draft = await prisma.workflowDraft.findUniqueOrThrow({
          where: { id: args.draftId, userId: auth.userId },
        });
        if (!draft.workflowId) {
          throw new Error("Repair drafts must target an existing workflow.");
        }

        const nodes = asGraphNodes(draft.nodes);
        const edges = asGraphEdges(draft.edges);
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes,
          edges,
        });
        const confirmationSummary = {
          toolName: "apply_workflow_fix",
          draftId: draft.id,
          workflowId: draft.workflowId,
          nodes,
          edges,
          validationValid: validation.valid,
        };
        const expectedHash = stableHash(confirmationSummary);

        if (!validation.valid) {
          return mcpJsonResponse({
            applied: false,
            reason: "Repair draft validation failed.",
            validation,
          });
        }

        if (!args.approved || args.confirmationHash !== expectedHash) {
          return mcpJsonResponse({
            applied: false,
            approvalRequired: true,
            confirmationHash: expectedHash,
            validation,
            instruction:
              "Call again with approved: true and this confirmationHash after user approval.",
          });
        }

        await createWorkflowVersion({
          workflowId: draft.workflowId,
          userId: auth.userId,
          createdByTool: "apply_workflow_fix",
          summary: `Before applying repair draft ${draft.id}`,
        });
        await replaceWorkflowGraph({
          workflowId: draft.workflowId,
          nodes,
          edges,
        });
        await prisma.workflowDraft.update({
          where: { id: draft.id },
          data: {
            status: "APPLIED",
            appliedAt: new Date(),
            validation: validation as unknown as Prisma.InputJsonValue,
          },
        });

        return mcpJsonResponse({
          applied: true,
          workflowId: draft.workflowId,
          draftId: draft.id,
          validation,
        });
      });
    },
  );
}
