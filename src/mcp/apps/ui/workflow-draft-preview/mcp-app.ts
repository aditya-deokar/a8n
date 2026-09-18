/**
 * Workflow Draft Preview — MCP App widget.
 *
 * Read-only. Shows what a drafted workflow will do in plain language, the
 * ordered steps, and anything blocking it from being applied.
 *
 * Data shape matches `draftPreview()` in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import {
  emptyState,
  errorState,
  html,
  list,
  metric,
  metricRow,
  panel,
  setHeader,
  setStatus,
  skeleton,
  steps,
} from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";

// ── Types (mirror server-side data shape) ──────────────────────────

interface DraftNode {
  id: string;
  type: string;
  label?: string;
  description?: string;
  riskLevel?: string;
  sideEffect?: boolean;
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
    missingFields?: Array<{ label: string; nodeType: string }>;
  };
  explanation?: {
    beginnerExplanation: string;
  };
  nodes?: DraftNode[];
  edges?: unknown[];
}

// ── Render ──────────────────────────────────────────────────────────

function renderDraft(data: DraftData, isPartial?: boolean): string {
  const draft = data.draft;
  setHeader(
    draft?.name || "Workflow draft",
    draft?.goal || "Preview of the workflow before it is applied.",
  );

  const valid = Boolean(data.validation?.valid);
  if (isPartial) {
    setStatus("Building", "warn");
  } else {
    setStatus(valid ? "Ready to apply" : "Needs setup", valid ? "ok" : "warn");
  }

  const nodes = data.nodes ?? [];
  const errors = data.validation?.errors ?? [];
  const sideEffectCount = nodes.filter((node) => node.sideEffect).length;

  const summary = panel(
    "What this does",
    `<p>${html(data.explanation?.beginnerExplanation || "No description available for this draft yet.")}</p>` +
      metricRow([
        metric("Steps", nodes.length),
        metric("Connections", (data.edges ?? []).length),
        metric(
          "Acts outside a8n",
          sideEffectCount,
          sideEffectCount > 0 ? "warn" : "neutral",
        ),
      ]),
  );

  const stepList = panel(
    "Steps",
    steps(
      nodes,
      (item) => {
        const node = item as DraftNode;
        return {
          title: node.label || node.type,
          meta: node.description || node.id,
          tone: node.sideEffect ? "warn" : "neutral",
        };
      },
      "This draft has no steps yet.",
    ),
  );

  const validation = valid
    ? panel(
        "Validation",
        '<p class="muted">Everything checks out. This draft can be applied.</p>',
        { tone: "ok" },
      )
    : panel(
        "Before this can run",
        list(
          errors,
          (item) => `<li>${html(item)}</li>`,
          "No blocking problems were reported.",
        ),
        { tone: "warn" },
      );

  return [summary, stepList, validation].join("");
}

// ── Init ────────────────────────────────────────────────────────────

function payloadOf(renderData: WidgetRenderData): DraftData | null {
  const candidate =
    renderData.details && Object.keys(renderData.details).length > 0
      ? renderData.details
      : renderData.result && Object.keys(renderData.result).length > 0
        ? renderData.result
        : renderData.input;

  if (!candidate || Object.keys(candidate).length === 0) return null;
  return candidate as unknown as DraftData;
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
      setStatus("Building", "warn");
      content.innerHTML = skeleton();
      return;
    }

    setStatus("Waiting", "neutral");
    content.innerHTML = emptyState(
      "Nothing to preview yet",
      "Ask for a workflow draft and its preview will appear here.",
    );
    return;
  }

  // A partial payload is still worth rendering: the steps stream in.
  content.innerHTML = renderDraft(data, renderData.isPartial);
}

initWidget("a8n Draft Preview", "1.0.0", handleRender);
