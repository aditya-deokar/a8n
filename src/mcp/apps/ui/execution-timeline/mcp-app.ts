/**
 * Execution Timeline — MCP App widget.
 *
 * Shows how a run went: overall status, how long it took, each node in order,
 * and the error when there is one. When the run failed and the host supports
 * tool calls, it offers to diagnose the failure.
 *
 * Data shape matches `executionTimeline()` in
 * `src/mcp/resources/app-resources.resource.ts`.
 */

import "../shared/styles.css";
import { initWidget } from "../shared/bridge";
import {
  actionButton,
  bindAction,
  emptyState,
  errorState,
  html,
  keyValues,
  metric,
  metricRow,
  panel,
  pill,
  setHeader,
  setStatus,
  skeleton,
  statusLabel,
  steps,
  toneForStatus,
} from "../shared/utils";
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

// ── Formatting ─────────────────────────────────────────────────────

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs == null) return "still running";
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Render ──────────────────────────────────────────────────────────

function renderTimeline(data: TimelineData, app: App | null): string {
  const execution = data.execution;
  setHeader(
    execution?.workflowName || "Execution timeline",
    execution ? `Run ${execution.id}` : "Node-by-node view of a workflow run.",
  );

  const status = execution?.status || "unknown";
  const tone = toneForStatus(status);
  setStatus(statusLabel(status), tone);

  const timeline = data.timeline ?? [];
  const failedSteps = timeline.filter(
    (step) => toneForStatus(step.status) === "bad",
  ).length;

  const overview = panel(
    "Run",
    // The header pill already carries the status, so the row covers the
    // things the pill cannot say.
    metricRow([
      metric("Duration", formatDuration(execution?.durationMs)),
      metric("Steps", timeline.length),
      metric("Need attention", failedSteps, failedSteps > 0 ? "bad" : "neutral"),
    ]) +
      keyValues([
        ["Started", html(formatTime(execution?.startedAt))],
        ["Finished", html(formatTime(execution?.completedAt))],
      ]),
  );

  const timelinePanel = panel(
    "Steps",
    steps(
      timeline,
      (item) => {
        const step = item as TimelineStep;
        return {
          title: step.label || step.nodeType,
          meta: step.nodeId,
          tone: toneForStatus(step.status),
          trailing: pill(step.status, toneForStatus(step.status)),
        };
      },
      "This run recorded no steps.",
    ),
  );

  const errorPanel = execution?.error
    ? panel("Error", `<p class="code">${html(execution.error)}</p>`, {
        tone: "bad",
      })
    : "";

  // Diagnosis is only offered for runs that actually failed.
  const canDiagnose = Boolean(execution?.id) && toneForStatus(status) === "bad";
  const diagnose = canDiagnose
    ? panel(
        "Next step",
        actionButton("diagnoseBtn", "Diagnose this failure", {
          disabled: !app,
          hint: app
            ? "Runs diagnose_execution and reports back in the conversation."
            : "Connecting to the host…",
        }),
      )
    : "";

  return [overview, timelinePanel, errorPanel, diagnose].join("");
}

// ── Init ────────────────────────────────────────────────────────────

function payloadOf(renderData: WidgetRenderData): TimelineData | null {
  const candidate =
    renderData.details && Object.keys(renderData.details).length > 0
      ? renderData.details
      : renderData.result;

  if (!candidate || Object.keys(candidate).length === 0) return null;
  return candidate as unknown as TimelineData;
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
      "No run to show",
      "Ask for an execution timeline and the run appears here.",
    );
    return;
  }

  const app = renderData.app;
  content.innerHTML = renderTimeline(data, app);

  const executionId = data.execution?.id;
  if (app && executionId) {
    bindAction(
      "diagnoseBtn",
      async () => {
        await app.callServerTool({
          name: "diagnose_execution",
          arguments: { executionId },
        });
      },
      {
        idle: "Diagnose this failure",
        busy: "Diagnosing…",
        done: "Diagnosis sent to the chat",
      },
    );
  }
}

initWidget("a8n Execution Timeline", "1.0.0", handleRender);
