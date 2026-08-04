/**
 * Workflow Setup Checklist — MCP App widget.
 *
 * Displays credential checks, webhook URLs, missing fields, and test
 * steps for a saved workflow. Interactive — can call `test_credential`
 * and `test_webhook_setup` via `app.callServerTool()`.
 *
 * Data shape matches the `setupChecklist()` function in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import { html, list, panel, setStatus, safeText } from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";
import type { App } from "@modelcontextprotocol/ext-apps";

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

interface SetupData {
  workflow?: {
    id: string;
    name: string;
  };
  ready?: boolean;
  validation?: {
    valid: boolean;
    missingFields: Array<{ label: string; nodeType: string }>;
  };
  credentialChecks?: CredentialCheck[];
  webhookSteps?: WebhookStep[];
  testSteps?: string[];
}

// ── Render ──────────────────────────────────────────────────────────

function renderSetup(data: SetupData, app: App | null): string {
  const titleEl = document.getElementById("title");
  if (titleEl) {
    titleEl.textContent = safeText(
      data.workflow?.name
        ? "Setup: " + data.workflow.name
        : "Setup Checklist",
    );
  }

  setStatus(
    data.ready ? "Ready" : "Needs setup",
    data.ready ? "ok" : "warn",
  );

  const credentials = list(data.credentialChecks, (item) => {
    const c = item as CredentialCheck;
    const statusClass = c.status === "configured" ? "ok" : "warn";
    return (
      '<li><strong>' +
      html(c.nodeLabel || c.nodeType) +
      '</strong>: <span class="pill ' + statusClass + '">' +
      html(c.status) +
      "</span></li>"
    );
  });

  const webhooks = list(data.webhookSteps, (item) => {
    const w = item as WebhookStep;
    return (
      "<li><strong>" +
      html(w.nodeType) +
      "</strong><br><code>" +
      html(w.webhookUrl || "Apply draft first") +
      "</code></li>"
    );
  });

  const tests = list(data.testSteps, (item) => {
    return "<li>" + html(item) + "</li>";
  });

  // Interactive buttons for app.callServerTool()
  let actions = "";
  if (app) {
    actions =
      '<div class="row" style="margin-top: 12px;">' +
      '<button id="testCredBtn" type="button">Test credentials</button>' +
      '<button id="testWebhookBtn" type="button">Test webhooks</button>' +
      "</div>";
  }

  // Bind interactive buttons after DOM update
  setTimeout(() => {
    const credBtn = document.getElementById("testCredBtn");
    const webhookBtn = document.getElementById("testWebhookBtn");

    if (credBtn && app) {
      credBtn.addEventListener("click", async () => {
        credBtn.textContent = "Testing...";
        (credBtn as HTMLButtonElement).disabled = true;
        try {
          const checks = data.credentialChecks || [];
          for (const check of checks) {
            if (check.credentialId) {
              await app.callServerTool({
                name: "test_credential",
                arguments: { credentialId: check.credentialId },
              });
            }
          }
          credBtn.textContent = "Done";
        } catch {
          credBtn.textContent = "Test credentials";
          (credBtn as HTMLButtonElement).disabled = false;
        }
      });
    }

    if (webhookBtn && app) {
      webhookBtn.addEventListener("click", async () => {
        webhookBtn.textContent = "Testing...";
        (webhookBtn as HTMLButtonElement).disabled = true;
        try {
          if (data.workflow?.id) {
            await app.callServerTool({
              name: "test_webhook_setup",
              arguments: { workflowId: data.workflow.id },
            });
          }
          webhookBtn.textContent = "Done";
        } catch {
          webhookBtn.textContent = "Test webhooks";
          (webhookBtn as HTMLButtonElement).disabled = false;
        }
      });
    }
  }, 0);

  return [
    panel("Credentials", credentials),
    panel("Webhooks", webhooks),
    panel("Test steps", tests),
    actions,
  ].join("");
}

// ── Init ────────────────────────────────────────────────────────────

let appInstance: App | null = null;

function handleRender(renderData: WidgetRenderData): void {
  const data = (renderData.details && Object.keys(renderData.details).length > 0
    ? renderData.details
    : renderData.result) as unknown as SetupData;

  const content = document.getElementById("content");
  if (!content) return;

  if (!data || Object.keys(data).length === 0) {
    setStatus("Waiting", "warn");
    content.innerHTML = panel(
      "Status",
      '<p class="subtle">Waiting for widget data.</p>',
    );
    return;
  }

  content.innerHTML = renderSetup(data, appInstance);
}

initWidget("a8n Setup Checklist", "1.0.0", handleRender)
  .then((app) => {
    appInstance = app;
  })
  .catch(() => undefined);
