/**
 * Workflow Setup Checklist — MCP App widget.
 *
 * What is still needed before a saved workflow can run for real: credentials,
 * required fields, and webhook wiring. Offers to test the credentials and the
 * webhook triggers when the host supports tool calls.
 *
 * Data shape matches `setupChecklist()` in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import {
  actionButton,
  bindAction,
  code,
  emptyState,
  errorState,
  html,
  list,
  metric,
  metricRow,
  panel,
  pill,
  setHeader,
  setStatus,
  skeleton,
  steps,
  toneForStatus,
} from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";

// ── Types ──────────────────────────────────────────────────────────

interface CredentialCheck {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  requiredCredentialType: string;
  credentialId: string | null;
  status: string;
}

interface WebhookStep {
  nodeId: string;
  nodeType: string;
  webhookUrl: string;
  verification: string;
}

interface MissingField {
  label: string;
  nodeType: string;
  reason?: string;
}

interface SetupData {
  workflow?: {
    id: string;
    name: string;
  };
  ready?: boolean;
  validation?: {
    valid: boolean;
    missingFields: MissingField[];
  };
  credentialChecks?: CredentialCheck[];
  webhookSteps?: WebhookStep[];
  testSteps?: string[];
}

function triggerFor(nodeType: string): "stripe" | "google_form" {
  return nodeType === "STRIPE_TRIGGER" ? "stripe" : "google_form";
}

// ── Render ──────────────────────────────────────────────────────────

function renderSetup(data: SetupData, app: WidgetRenderData["app"]): string {
  setHeader(
    data.workflow?.name ? `Set up ${data.workflow.name}` : "Setup checklist",
    "What this workflow still needs before it can run.",
  );

  const ready = Boolean(data.ready);
  setStatus(ready ? "Ready to test" : "Needs setup", ready ? "ok" : "warn");

  const credentials = data.credentialChecks ?? [];
  const webhooks = data.webhookSteps ?? [];
  const missingFields = data.validation?.missingFields ?? [];
  const missingCredentials = credentials.filter(
    (item) => item.status !== "configured",
  );
  const configuredCredentials = credentials.filter(
    (item) => item.status === "configured" && item.credentialId,
  );

  const overview = panel(
    "Status",
    metricRow([
      metric(
        "Credentials",
        `${credentials.length - missingCredentials.length}/${credentials.length}`,
        missingCredentials.length > 0 ? "warn" : "ok",
      ),
      metric(
        "Missing fields",
        missingFields.length,
        missingFields.length > 0 ? "warn" : "ok",
      ),
      metric("Webhooks", webhooks.length),
    ]),
  );

  const credentialPanel = panel(
    "Credentials",
    steps(
      credentials,
      (item) => {
        const check = item as CredentialCheck;
        const tone = toneForStatus(check.status);
        return {
          title: check.nodeLabel || check.nodeType,
          meta: `Needs ${check.requiredCredentialType}`,
          tone,
          trailing: pill(check.status, tone),
        };
      },
      "This workflow needs no credentials.",
    ),
    { tone: missingCredentials.length > 0 ? "warn" : undefined },
  );

  const fieldsPanel =
    missingFields.length > 0
      ? panel(
          "Fields still to fill",
          list(missingFields, (item) => {
            const field = item as MissingField;
            return `<li><span class="step__title">${html(field.label)}</span><span class="step__meta">${html(field.nodeType)}${field.reason ? ` — ${html(field.reason)}` : ""}</span></li>`;
          }),
          { tone: "warn" },
        )
      : "";

  const webhookPanel =
    webhooks.length > 0
      ? panel(
          "Webhooks",
          list(webhooks, (item) => {
            const webhook = item as WebhookStep;
            return `<li><span class="step__title">${html(webhook.nodeType)}</span>${code(webhook.webhookUrl || "Apply the draft first")}<span class="step__meta">${html(webhook.verification)}</span></li>`;
          }),
        )
      : "";

  const testsPanel = panel(
    "How to test",
    list(
      data.testSteps,
      (item) => `<li>${html(item)}</li>`,
      "No test steps were suggested.",
    ),
  );

  // Only offer a test when there is something to test. The previous version
  // fired a google_form test even for workflows with no webhook trigger.
  const canTestCredentials = Boolean(app) && configuredCredentials.length > 0;
  const canTestWebhooks = Boolean(app) && webhooks.length > 0 && Boolean(data.workflow?.id);

  const actions =
    canTestCredentials || canTestWebhooks
      ? panel(
          "Run a check",
          [
            canTestCredentials
              ? actionButton("testCredBtn", "Test credentials", {
                  hint: `Checks ${configuredCredentials.length} configured credential${configuredCredentials.length === 1 ? "" : "s"}.`,
                })
              : "",
            canTestWebhooks
              ? actionButton("testWebhookBtn", "Send a test event", {
                  variant: "secondary",
                  hint: "Runs the workflow with sample trigger data.",
                })
              : "",
          ].join(""),
        )
      : "";

  return [
    overview,
    credentialPanel,
    fieldsPanel,
    webhookPanel,
    testsPanel,
    actions,
  ].join("");
}

// ── Init ────────────────────────────────────────────────────────────

function payloadOf(renderData: WidgetRenderData): SetupData | null {
  const candidate =
    renderData.details && Object.keys(renderData.details).length > 0
      ? renderData.details
      : renderData.result;

  if (!candidate || Object.keys(candidate).length === 0) return null;
  return candidate as unknown as SetupData;
}

function handleRender(renderData: WidgetRenderData): void {
  const content = document.getElementById("content");
  if (!content) return;

  const data = payloadOf(renderData);

  if (!data) {
    if (renderData.connectionError) {
      setStatus("Disconnected", "bad");
      content.innerHTML = errorState(
        "Could not reach the host",
        renderData.connectionError,
      );
      return;
    }

    if (renderData.isPartial) {
      setStatus("Loading", "warn");
      content.innerHTML = skeleton();
      return;
    }

    setStatus("Waiting", "neutral");
    content.innerHTML = emptyState(
      "No checklist yet",
      "Ask for a workflow setup checklist and it appears here.",
    );
    return;
  }

  const app = renderData.app;
  content.innerHTML = renderSetup(data, app);
  if (!app) return;

  const configured = (data.credentialChecks ?? []).filter(
    (check) => check.status === "configured" && check.credentialId,
  );
  if (configured.length > 0) {
    bindAction(
      "testCredBtn",
      async () => {
        for (const check of configured) {
          await app.callServerTool({
            name: "test_credential",
            arguments: { credentialId: check.credentialId },
          });
        }
      },
      { idle: "Test credentials", busy: "Testing…", done: "Tested" },
    );
  }

  const workflowId = data.workflow?.id;
  const webhooks = data.webhookSteps ?? [];
  if (workflowId && webhooks.length > 0) {
    bindAction(
      "testWebhookBtn",
      async () => {
        // De-duplicate: two triggers of the same kind need only one test run.
        const triggers = [...new Set(webhooks.map((step) => triggerFor(step.nodeType)))];
        for (const trigger of triggers) {
          await app.callServerTool({
            name: "run_workflow_test",
            arguments: { workflowId, trigger, approved: true },
          });
        }
      },
      { idle: "Send a test event", busy: "Sending…", done: "Test sent" },
    );
  }
}

initWidget("a8n Setup Checklist", "1.0.0", handleRender);
