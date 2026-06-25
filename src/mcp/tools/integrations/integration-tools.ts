import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { CredentialType, NodeType, type Prisma } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { sendWorkflowExecution } from "@/inngest/utils";
import { generateGoogleFormScript as buildGoogleFormScript } from "@/features/triggers/components/google-form-trigger/utils";
import {
  getIntegrationSetupGuide,
  getNodeManifest,
  INTEGRATION_SERVICE_KEYS,
  type IntegrationServiceKey,
} from "@/features/workflows/node-manifest";
import {
  asGraphEdges,
  asGraphNodes,
  getWorkflowGraph,
  validateWorkflowGraph,
  type WorkflowGraphNode,
} from "@/mcp/tools/workflows/workflow-graph-utils";

const webhookTriggerSchema = z.enum(["google_form", "stripe"]);
const integrationServiceSchema = z.enum(INTEGRATION_SERVICE_KEYS);

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getWebhookUrl(workflowId: string, trigger: "google_form" | "stripe"): string {
  const path = trigger === "google_form" ? "google-form" : "stripe";
  return `${getAppBaseUrl()}/api/webhooks/${path}?workflowId=${workflowId}`;
}

function sampleGoogleFormPayload() {
  return {
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
  };
}

function sampleStripePayload() {
  return {
    id: "evt_sample_payment_succeeded",
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "pi_sample",
        amount: 2500,
        currency: "usd",
        customer: "cus_sample",
        status: "succeeded",
      },
    },
  };
}

function webhookInitialData(trigger: "google_form" | "stripe") {
  if (trigger === "google_form") {
    const body = sampleGoogleFormPayload();
    return {
      googleForm: {
        formId: body.formId,
        formTitle: body.formTitle,
        responseId: body.responseId,
        timestamp: body.timestamp,
        respondentEmail: body.respondentEmail,
        responses: body.responses,
        raw: body,
      },
    };
  }

  const body = sampleStripePayload();
  return {
    stripe: {
      eventId: body.id,
      eventType: body.type,
      timestamp: body.created,
      livemode: body.livemode,
      raw: body.data.object,
    },
  };
}

async function loadGraphForSetup(params: {
  userId: string;
  workflowId?: string;
  draftId?: string;
}) {
  if (params.workflowId) {
    const graph = await getWorkflowGraph(params.workflowId, params.userId);
    return {
      kind: "workflow" as const,
      name: graph.workflow.name,
      workflowId: graph.workflow.id,
      nodes: graph.nodes,
      edges: graph.edges,
    };
  }

  if (params.draftId) {
    const draft = await prisma.workflowDraft.findUniqueOrThrow({
      where: { id: params.draftId, userId: params.userId },
    });
    return {
      kind: "draft" as const,
      name: draft.name,
      workflowId: draft.workflowId,
      draftId: draft.id,
      nodes: asGraphNodes(draft.nodes),
      edges: asGraphEdges(draft.edges),
    };
  }

  throw new Error("Provide either workflowId or draftId.");
}

function credentialSetupForNode(node: WorkflowGraphNode) {
  const manifest = getNodeManifest(node.type);
  if (!manifest.credentialType) return null;

  const credentialId = node.data.credentialId;
  return {
    nodeId: node.id,
    nodeType: node.type,
    nodeLabel: manifest.label,
    requiredCredentialType: manifest.credentialType,
    credentialId: typeof credentialId === "string" && credentialId ? credentialId : null,
    status: typeof credentialId === "string" && credentialId ? "configured" : "missing",
    nextStep:
      typeof credentialId === "string" && credentialId
        ? "Run test_credential to verify this saved connection."
        : `Create or select a ${manifest.credentialType} credential, then update this node's credentialId.`,
  };
}

export function registerGetWorkflowSetupChecklist(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "get_workflow_setup_checklist",
    "Return a beginner-friendly setup checklist for a saved workflow or draft: missing fields, credentials, webhook URLs, test steps, risks, and estimated effort.",
    {
      workflowId: z.string().optional().describe("Saved workflow ID."),
      draftId: z.string().optional().describe("Workflow draft ID."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("get_workflow_setup_checklist", async () => {
        const graph = await loadGraphForSetup({
          userId: auth.userId,
          workflowId: args.workflowId,
          draftId: args.draftId,
        });
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes: graph.nodes,
          edges: graph.edges,
        });
        const credentialChecks = graph.nodes
          .map(credentialSetupForNode)
          .filter((item): item is NonNullable<ReturnType<typeof credentialSetupForNode>> => Boolean(item));

        const webhookSteps = graph.nodes
          .filter((node) =>
            node.type === NodeType.GOOGLE_FORM_TRIGGER ||
            node.type === NodeType.STRIPE_TRIGGER,
          )
          .map((node) => {
            const trigger = node.type === NodeType.GOOGLE_FORM_TRIGGER ? "google_form" : "stripe";
            return {
              nodeId: node.id,
              nodeType: node.type,
              webhookUrl: graph.workflowId ? getWebhookUrl(graph.workflowId, trigger) : null,
              setupGuideResource: `a8n://integrations/${trigger}/setup`,
              nextStep: graph.workflowId
                ? "Copy this webhook URL into the external service and run test_webhook_setup with approved: true for a sample run."
                : "Apply the draft first so a workflow ID exists, then generate the webhook URL.",
            };
          });

        const setupItems = [
          ...validation.missingFields.map((field) => ({
            category: "missing_field",
            nodeId: field.nodeId,
            title: `Fill ${field.label}`,
            detail: field.reason,
          })),
          ...credentialChecks.map((credential) => ({
            category: "credential",
            nodeId: credential.nodeId,
            title: `${credential.nodeLabel} needs ${credential.requiredCredentialType}`,
            detail: credential.nextStep,
          })),
          ...webhookSteps.map((webhook) => ({
            category: "webhook",
            nodeId: webhook.nodeId,
            title: `${webhook.nodeType} webhook setup`,
            detail: webhook.nextStep,
          })),
        ];

        return mcpJsonResponse({
          target: graph,
          ready: validation.valid && setupItems.length === 0,
          estimatedEffort:
            setupItems.length > 5 ? "high" : setupItems.length > 2 ? "medium" : "low",
          setupItems,
          credentialChecks,
          webhookSteps,
          testSteps: [
            "Run test_credential for every configured credential.",
            "Run test_webhook_setup for Google Form or Stripe triggers.",
            "Run run_workflow_test before sending real external data.",
          ],
          validation,
          warning:
            "Do not ask users to paste secrets into ordinary chat. Use credential forms, the dashboard, or create_credential only with explicit secret-handling awareness.",
        });
      });
    },
  );
}

export function registerGetIntegrationSetupGuide(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "get_integration_setup_guide",
    "Return plain-language setup steps for a supported integration.",
    {
      service: integrationServiceSchema.describe("Integration service key."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("get_integration_setup_guide", async () => {
        return mcpJsonResponse({
          service: args.service,
          resourceUri: `a8n://integrations/${args.service}/setup`,
          guide: getIntegrationSetupGuide(args.service as IntegrationServiceKey),
          sensitiveDataPolicy:
            "Never request API keys, passwords, tokens, webhook secrets, or service-account JSON through generic clarification prompts.",
        });
      });
    },
  );
}

export function registerGetWebhookUrl(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "get_webhook_url",
    "Return the webhook URL for a Google Form or Stripe trigger workflow.",
    {
      workflowId: z.string().describe("Saved workflow ID."),
      trigger: webhookTriggerSchema.describe("Trigger type."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("get_webhook_url", async () => {
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });

        return mcpJsonResponse({
          workflowId: args.workflowId,
          trigger: args.trigger,
          webhookUrl: getWebhookUrl(args.workflowId, args.trigger),
        });
      });
    },
  );
}

export function registerGenerateGoogleFormScript(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "generate_google_form_script",
    "Generate the Google Apps Script needed to send form submissions to an a8n workflow webhook.",
    {
      workflowId: z.string().describe("Saved workflow ID."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("generate_google_form_script", async () => {
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });
        const webhookUrl = getWebhookUrl(args.workflowId, "google_form");

        return mcpJsonResponse({
          workflowId: args.workflowId,
          webhookUrl,
          script: buildGoogleFormScript(webhookUrl),
          setupSteps: [
            "Open the Google Form.",
            "Open Apps Script.",
            "Paste this script.",
            "Create an On form submit trigger.",
            "Submit one test response.",
          ],
        });
      });
    },
  );
}

export function registerTestWebhookSetup(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "test_webhook_setup",
    "Generate a sample Google Form or Stripe webhook payload, and optionally trigger a workflow test run with that sample data after approval.",
    {
      workflowId: z.string().describe("Saved workflow ID."),
      trigger: webhookTriggerSchema.describe("Trigger type."),
      approved: z.boolean().default(false).describe("Must be true to trigger a workflow run."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:execute");

      return withErrorBoundary("test_webhook_setup", async () => {
        await prisma.workflow.findUniqueOrThrow({
          where: { id: args.workflowId, userId: auth.userId },
        });
        const samplePayload =
          args.trigger === "google_form" ? sampleGoogleFormPayload() : sampleStripePayload();
        const initialData = webhookInitialData(args.trigger);

        if (!args.approved) {
          return mcpJsonResponse({
            triggered: false,
            approvalRequired: true,
            workflowId: args.workflowId,
            trigger: args.trigger,
            webhookUrl: getWebhookUrl(args.workflowId, args.trigger),
            samplePayload,
            initialData,
            instruction:
              "Call again with approved: true to run the workflow using this generated sample data.",
          });
        }

        const event = await sendWorkflowExecution({
          workflowId: args.workflowId,
          initialData,
          testMode: true,
          testSource: args.trigger,
        });

        return mcpJsonResponse({
          triggered: true,
          workflowId: args.workflowId,
          trigger: args.trigger,
          inngestEventId: event.eventId,
          samplePayload,
          initialData,
          nextStep: "Use execute_workflow_and_wait or get_execution_timeline with the returned event ID once the execution record exists.",
        });
      });
    },
  );
}

export function registerTestCredential(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "test_credential",
    "Validate a saved credential without returning its secret. Dry-run validates shape; live mode calls the provider or verifies SMTP/Google Sheets access.",
    {
      credentialId: z.string().describe("Credential ID."),
      live: z.boolean().default(false).describe("Whether to call the provider. Dry-run is safer and default."),
      spreadsheetId: z.string().optional().describe("Google Sheets live test spreadsheet ID."),
      sheetName: z.string().optional().describe("Google Sheets live test sheet name."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "credentials:read");

      return withErrorBoundary("test_credential", async () => {
        const credential = await prisma.credential.findUniqueOrThrow({
          where: { id: args.credentialId, userId: auth.userId },
        });
        const secret = decrypt(credential.value);
        const result: Record<string, unknown> = {
          credentialId: credential.id,
          type: credential.type,
          live: args.live,
          ok: false,
          checks: [],
        };
        const checks: Array<{ name: string; status: string; detail?: string }> = [];

        try {
          if (credential.type === CredentialType.SMTP_EMAIL) {
            const smtp = JSON.parse(secret) as {
              host?: string;
              port?: number | string;
              secure?: boolean;
              user?: string;
              pass?: string;
            };
            for (const field of ["host", "port", "user", "pass"]) {
              checks.push({
                name: `smtp.${field}`,
                status: smtp[field as keyof typeof smtp] ? "ok" : "missing",
              });
            }
            if (args.live) {
              const transporter = nodemailer.createTransport({
                host: smtp.host,
                port: Number(smtp.port),
                secure: smtp.secure ?? Number(smtp.port) === 465,
                auth: { user: smtp.user, pass: smtp.pass },
              });
              await transporter.verify();
              checks.push({ name: "smtp.verify", status: "ok" });
            }
          } else if (credential.type === CredentialType.GOOGLE_SHEETS) {
            const serviceAccount = JSON.parse(secret) as {
              client_email?: string;
              private_key?: string;
            };
            checks.push({
              name: "service_account.client_email",
              status: serviceAccount.client_email ? "ok" : "missing",
            });
            checks.push({
              name: "service_account.private_key",
              status: serviceAccount.private_key ? "ok" : "missing",
            });
            if (args.live && args.spreadsheetId && args.sheetName) {
              const authClient = new google.auth.JWT({
                email: serviceAccount.client_email,
                key: serviceAccount.private_key,
                scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
              });
              const sheets = google.sheets({ version: "v4", auth: authClient });
              await sheets.spreadsheets.values.get({
                spreadsheetId: args.spreadsheetId,
                range: `${args.sheetName}!A1:A1`,
              });
              checks.push({ name: "google_sheets.read", status: "ok" });
            } else if (args.live) {
              checks.push({
                name: "google_sheets.read",
                status: "skipped",
                detail: "Provide spreadsheetId and sheetName for a live access test.",
              });
            }
          } else {
            checks.push({
              name: "api_key.present",
              status: secret.trim().length > 0 ? "ok" : "missing",
            });
            if (args.live) {
              let response: Response;
              if (credential.type === CredentialType.OPENAI) {
                response = await fetch("https://api.openai.com/v1/models", {
                  headers: { Authorization: `Bearer ${secret}` },
                });
              } else if (credential.type === CredentialType.ANTHROPIC) {
                response = await fetch("https://api.anthropic.com/v1/models", {
                  headers: {
                    "x-api-key": secret,
                    "anthropic-version": "2023-06-01",
                  },
                });
              } else {
                response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`,
                );
              }
              checks.push({
                name: "provider.connection",
                status: response.ok ? "ok" : "error",
                detail: `HTTP ${response.status}`,
              });
            }
          }

          result.checks = checks;
          result.ok = checks.every((check) => check.status === "ok" || check.status === "skipped");
          result.nextStep = result.ok
            ? "Use this credential in the matching workflow node."
            : "Fix missing fields or recreate the credential, then test again.";
          return mcpJsonResponse(result);
        } catch (error) {
          return mcpJsonResponse({
            ...result,
            checks,
            ok: false,
            error: error instanceof Error ? error.message : "Credential test failed",
          });
        }
      });
    },
  );
}
