/**
 * Workflow Approval — MCP App widget.
 *
 * Displays the diff summary (added/changed/removed nodes),
 * validation status, and confirmation hash. Interactive — the
 * "Apply draft" button calls `apply_workflow_draft` via
 * `app.callServerTool()`.
 *
 * Data shape matches the `approvalPreview()` function in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import { html, metric, panel, setStatus, safeText } from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";
import type { App } from "@modelcontextprotocol/ext-apps";

// ── Types ──────────────────────────────────────────────────────────

interface ApprovalDiff {
  addedNodes: unknown[];
  changedNodes: unknown[];
  removedNodes: unknown[];
  addedEdges: unknown[];
  removedEdges?: unknown[];
}

interface ApprovalArgs {
  draftId: string;
  workflowId?: string;
  approved: boolean;
  confirmationHash: string;
}

interface ApprovalData {
  draft?: {
    id: string;
    name: string;
    goal?: string;
    workflowId?: string;
  };
  validation?: {
    valid: boolean;
    errors?: string[];
  };
  diff?: ApprovalDiff;
  approval?: {
    required: boolean;
    confirmationHash: string;
    tool: string;
    arguments: ApprovalArgs;
  };
}

// ── Render ──────────────────────────────────────────────────────────

function renderApproval(data: ApprovalData, app: App | null): string {
  const titleEl = document.getElementById("title");
  if (titleEl) {
    titleEl.textContent = safeText(
      data.draft?.name
        ? "Approve: " + data.draft.name
        : "Workflow Approval",
    );
  }

  const valid = Boolean(data.validation?.valid);
  setStatus(valid ? "Valid" : "Invalid", valid ? "ok" : "bad");

  const diff = data.diff || {
    addedNodes: [],
    changedNodes: [],
    removedNodes: [],
    addedEdges: [],
  };
  const hash = data.approval?.confirmationHash || "";

  // Build the apply arguments from the approval data
  const canCall = Boolean(app && data.approval?.arguments);
  const rawArgs = data.approval?.arguments;
  const applyArgs: ApprovalArgs | null = rawArgs
    ? {
        draftId: rawArgs.draftId,
        workflowId: rawArgs.workflowId,
        approved: true,
        confirmationHash: rawArgs.confirmationHash,
      }
    : null;

  // Bind the apply button after DOM update
  setTimeout(() => {
    const button = document.getElementById(
      "applyDraft",
    ) as HTMLButtonElement | null;
    if (!button) return;

    button.disabled = !canCall || !valid;

    // Only bind once
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      if (!app || !applyArgs) return;
      button.disabled = true;
      button.textContent = "Applying...";
      try {
        await app.callServerTool({
          name: "apply_workflow_draft",
          arguments: applyArgs as unknown as Record<string, unknown>,
        });
        button.textContent = "✓ Applied";
      } catch {
        button.textContent = "Apply draft";
        button.disabled = false;
      }
    });
  }, 0);

  return [
    '<div class="grid">' +
      metric("Added nodes", (diff.addedNodes || []).length) +
      metric("Changed nodes", (diff.changedNodes || []).length) +
      metric("Removed nodes", (diff.removedNodes || []).length) +
      metric("Added connections", (diff.addedEdges || []).length) +
      "</div>",
    panel(
      "Confirmation hash",
      "<p><code>" + html(hash) + "</code></p>",
    ),
    '<button id="applyDraft" type="button" disabled>Apply draft</button>',
  ].join("");
}

// ── Init ────────────────────────────────────────────────────────────

let appInstance: App | null = null;

function handleRender(renderData: WidgetRenderData): void {
  const data = (renderData.details && Object.keys(renderData.details).length > 0
    ? renderData.details
    : renderData.result) as unknown as ApprovalData;

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

  content.innerHTML = renderApproval(data, appInstance);
}

initWidget("a8n Workflow Approval", "1.0.0", handleRender)
  .then((app) => {
    appInstance = app;
  })
  .catch(console.error);
