/**
 * Workflow Draft Preview — MCP App widget.
 *
 * Displays draft name, goal, node list, validation status, and
 * beginner-friendly explanation. Read-only — supports streaming input
 * (`ontoolinputpartial`) and host display mode toggle (`app.requestDisplayMode`).
 *
 * Data shape matches the `draftPreview()` function in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget, setupFullscreenToggle } from "../shared/bridge";
import { html, list, panel, setStatus, safeText } from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";

// ── Types (mirror server-side data shape) ──────────────────────────

interface DraftNode {
  id: string;
  type: string;
  label?: string;
  description?: string;
}

interface DraftData {
  draft?: {
    id: string;
    name: string;
    goal?: string;
    status: string;
    workflowId?: string;
  };
  validation?: {
    valid: boolean;
    errors: string[];
  };
  explanation?: {
    beginnerExplanation: string;
  };
  nodes?: DraftNode[];
  edges?: unknown[];
}

// ── Render ──────────────────────────────────────────────────────────

function renderDraft(data: DraftData, isPartial?: boolean): string {
  const titleEl = document.getElementById("title");
  if (titleEl) {
    titleEl.textContent = safeText(
      data.draft?.name || "Workflow Draft Preview",
    );
  }

  if (isPartial) {
    setStatus("Streaming...", "warn");
  } else {
    const valid = Boolean(data.validation?.valid);
    setStatus(valid ? "Ready" : "Needs setup", valid ? "ok" : "warn");
  }

  const explanation =
    data.explanation?.beginnerExplanation || "No explanation available.";

  const steps = list(data.nodes, (node) => {
    const n = node as DraftNode;
    return (
      "<li><strong>" +
      html(n.label || n.type) +
      '</strong><br><span class="subtle">' +
      html(n.description || n.id) +
      "</span></li>"
    );
  });

  const errors = data.validation?.errors || [];

  return [
    panel("Summary", "<p>" + html(explanation) + "</p>"),
    panel("Steps", steps),
    panel(
      "Validation",
      data.validation?.valid
        ? "<p>Ready to apply.</p>"
        : list(errors, (item) => "<li>" + html(item) + "</li>"),
    ),
  ].join("");
}

// ── Init ────────────────────────────────────────────────────────────

function handleRender(renderData: WidgetRenderData): void {
  const data = (renderData.details && Object.keys(renderData.details).length > 0
    ? renderData.details
    : renderData.result || renderData.input) as unknown as DraftData;

  const content = document.getElementById("content");
  if (!content) return;

  if (!data || Object.keys(data).length === 0) {
    setStatus(renderData.isPartial ? "Streaming..." : "Waiting", "warn");
    content.innerHTML = panel(
      "Status",
      `<p class="subtle">${renderData.isPartial ? "Receiving streaming draft arguments..." : "Waiting for widget data."}</p>`,
    );
    return;
  }

  content.innerHTML = renderDraft(data, renderData.isPartial);
}

initWidget("a8n Draft Preview", "1.0.0", (renderData) => {
  handleRender(renderData);
})
  .then((app) => {
    setupFullscreenToggle(app);
  })
  .catch(() => undefined);
