/**
 * Workflow Approval — MCP App widget.
 *
 * The confirmation step before a draft is written to a real workflow. Shows
 * what would change, why it cannot be applied when it cannot, and the
 * confirmation hash the server checks.
 *
 * Data shape matches `approvalPreview()` in
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
  keyValues,
  list,
  metric,
  metricRow,
  panel,
  setHeader,
  setStatus,
  skeleton,
} from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";

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

function renderApproval(
  data: ApprovalData,
  app: WidgetRenderData["app"],
): string {
  const draft = data.draft;
  setHeader(
    draft?.name ? `Apply “${draft.name}”?` : "Workflow approval",
    draft?.workflowId
      ? "This updates an existing workflow."
      : "This creates a new workflow.",
  );

  const valid = Boolean(data.validation?.valid);
  setStatus(valid ? "Ready to apply" : "Cannot apply yet", valid ? "ok" : "bad");

  const diff = data.diff ?? {
    addedNodes: [],
    changedNodes: [],
    removedNodes: [],
    addedEdges: [],
  };
  const removedCount = (diff.removedNodes ?? []).length;
  const errors = data.validation?.errors ?? [];
  const hash = data.approval?.confirmationHash || "";

  const changes = panel(
    "What changes",
    metricRow([
      metric("Added", (diff.addedNodes ?? []).length, "ok"),
      metric("Changed", (diff.changedNodes ?? []).length, "warn"),
      metric("Removed", removedCount, removedCount > 0 ? "bad" : "neutral"),
      metric("New connections", (diff.addedEdges ?? []).length),
    ]) +
      (removedCount > 0
        ? `<p class="muted">Removing ${html(removedCount)} step${removedCount === 1 ? "" : "s"} cannot be undone from here.</p>`
        : ""),
  );

  const blockers = valid
    ? ""
    : panel(
        "Why it cannot be applied",
        list(
          errors,
          (item) => `<li>${html(item)}</li>`,
          "The server reported this draft as invalid without listing reasons.",
        ),
        { tone: "bad" },
      );

  const confirmation = panel(
    "Confirmation",
    keyValues([
      ["Draft", code(draft?.id || "—")],
      ["Hash", code(hash || "—")],
    ]) +
      '<p class="muted">The server re-checks this hash, so an approval cannot be replayed against a draft that changed.</p>',
  );

  const canApply = Boolean(app && data.approval?.arguments && valid);
  const action = panel(
    "Approval",
    actionButton("applyDraft", "Apply this draft", {
      disabled: !canApply,
      hint: !valid
        ? "Fix the problems above first."
        : app
          ? "Applies the draft to your workspace."
          : "Connecting to the host…",
    }),
  );

  return [changes, blockers, confirmation, action].join("");
}

// ── Init ────────────────────────────────────────────────────────────

function payloadOf(renderData: WidgetRenderData): ApprovalData | null {
  const candidate =
    renderData.details && Object.keys(renderData.details).length > 0
      ? renderData.details
      : renderData.result;

  if (!candidate || Object.keys(candidate).length === 0) return null;
  return candidate as unknown as ApprovalData;
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
      "Nothing to approve",
      "Ask to apply a workflow draft and the approval appears here.",
    );
    return;
  }

  const app = renderData.app;
  content.innerHTML = renderApproval(data, app);

  const rawArgs = data.approval?.arguments;
  if (app && rawArgs && data.validation?.valid) {
    bindAction(
      "applyDraft",
      async () => {
        await app.callServerTool({
          name: data.approval?.tool || "apply_workflow_draft",
          arguments: {
            draftId: rawArgs.draftId,
            workflowId: rawArgs.workflowId,
            approved: true,
            confirmationHash: rawArgs.confirmationHash,
          },
        });
      },
      {
        idle: "Apply this draft",
        busy: "Applying…",
        done: "Applied",
      },
    );
  }
}

initWidget("a8n Workflow Approval", "1.0.0", handleRender);
