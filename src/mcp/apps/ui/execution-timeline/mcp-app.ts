/**
 * Execution Timeline — MCP App widget.
 *
 * Displays execution status, duration, node-by-node timeline, and
 * error details. Interactive — can call `diagnose_execution` via
 * `app.callServerTool()`.
 *
 * Data shape matches the `executionTimeline()` function in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import { html, list, metric, panel, setStatus, safeText } from "../shared/utils";
import type { WidgetRenderData } from "../shared/bridge";
import type { App } from "@modelcontextprotocol/ext-apps";

// ── Types ──────────────────────────────────────────────────────────

interface TimelineStep {
  order: number;
  nodeId: string;
  nodeType: string;
  label: string;
  status: string;
  visibleConfig?: Record<string, unknown>;
}

interface TimelineData {
  execution?: {
    id: string;
    workflowId: string;
    workflowName: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    durationMs: number | null;
    error?: string;
  };
  timeline?: TimelineStep[];
  output?: unknown;
}

// ── Render ──────────────────────────────────────────────────────────

function renderTimeline(data: TimelineData, app: App | null): string {
  const titleEl = document.getElementById("title");
  if (titleEl) {
    titleEl.textContent = safeText(
      data.execution?.workflowName || "Execution Timeline",
    );
  }

  const status = data.execution?.status || "unknown";
  setStatus(
    status,
    status === "SUCCESS" ? "ok" : status === "FAILED" ? "bad" : "warn",
  );

  const timeline = list(data.timeline, (item) => {
    const step = item as TimelineStep;
    const stepStatus = step.status || "unknown";
    const statusClass =
      stepStatus === "success"
        ? "ok"
        : stepStatus === "needs_diagnosis"
          ? "bad"
          : "";
    return (
      "<li><strong>" +
      html(step.order) +
      ". " +
      html(step.label || step.nodeType) +
      '</strong> <span class="pill ' +
      statusClass +
      '">' +
      html(stepStatus) +
      "</span></li>"
    );
  });

  const duration =
    data.execution?.durationMs == null
      ? "running"
      : data.execution.durationMs + " ms";

  const error = data.execution?.error
    ? panel(
        "Error",
        '<p class="mono">' + html(data.execution.error) + "</p>",
      )
    : "";

  // Diagnose button for failed executions
  let diagnoseAction = "";
  if (app && data.execution?.id && status === "FAILED") {
    diagnoseAction =
      '<button id="diagnoseBtn" type="button" style="margin-top: 12px;">Diagnose failure</button>';

    setTimeout(() => {
      const btn = document.getElementById("diagnoseBtn");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        btn.textContent = "Diagnosing...";
        (btn as HTMLButtonElement).disabled = true;
        try {
          await app.callServerTool({
            name: "diagnose_execution",
            arguments: { executionId: data.execution!.id },
          });
          btn.textContent = "Diagnosed";
        } catch {
          btn.textContent = "Diagnose failure";
          (btn as HTMLButtonElement).disabled = false;
        }
      });
    }, 0);
  }

  return [
    '<div class="grid">' +
      metric("Status", status) +
      metric("Duration", duration) +
      "</div>",
    panel("Timeline", timeline),
    error,
    diagnoseAction,
  ].join("");
}

// ── Init ────────────────────────────────────────────────────────────

let appInstance: App | null = null;

function handleRender(renderData: WidgetRenderData): void {
  const data = (renderData.details && Object.keys(renderData.details).length > 0
    ? renderData.details
    : renderData.result) as unknown as TimelineData;

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

  content.innerHTML = renderTimeline(data, appInstance);
}

initWidget("a8n Execution Timeline", "1.0.0", handleRender)
  .then((app) => {
    appInstance = app;
  })
  .catch(() => undefined);
