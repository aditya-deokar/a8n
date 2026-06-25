import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const MCP_APP_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export const CHATGPT_WIDGET_URIS = {
  workflowDraftPreview: "ui://a8n/workflow-draft-preview.html",
  workflowSetupChecklist: "ui://a8n/workflow-setup-checklist.html",
  executionTimeline: "ui://a8n/execution-timeline.html",
  workflowApproval: "ui://a8n/workflow-approval.html",
} as const;

type WidgetSpec = {
  name: string;
  title: string;
  uri: string;
  description: string;
  kind:
    | "workflowDraftPreview"
    | "workflowSetupChecklist"
    | "executionTimeline"
    | "workflowApproval";
};

const WIDGET_SPECS: WidgetSpec[] = [
  {
    name: "chatgpt-workflow-draft-preview-widget",
    title: "Workflow draft preview",
    uri: CHATGPT_WIDGET_URIS.workflowDraftPreview,
    description: "Shows a workflow draft preview, validation state, and planned steps.",
    kind: "workflowDraftPreview",
  },
  {
    name: "chatgpt-workflow-setup-checklist-widget",
    title: "Workflow setup checklist",
    uri: CHATGPT_WIDGET_URIS.workflowSetupChecklist,
    description: "Shows credentials, missing fields, webhook setup, and test steps.",
    kind: "workflowSetupChecklist",
  },
  {
    name: "chatgpt-execution-timeline-widget",
    title: "Execution timeline",
    uri: CHATGPT_WIDGET_URIS.executionTimeline,
    description: "Shows workflow execution status and node-by-node progress.",
    kind: "executionTimeline",
  },
  {
    name: "chatgpt-workflow-approval-widget",
    title: "Workflow approval",
    uri: CHATGPT_WIDGET_URIS.workflowApproval,
    description: "Shows the diff and confirmation hash before applying a workflow draft.",
    kind: "workflowApproval",
  },
];

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function widgetResourceMeta(description: string): Record<string, unknown> {
  const origin = appOrigin();
  const connectDomains = [origin];
  const resourceDomains = [origin];

  return {
    ui: {
      prefersBorder: true,
      domain: origin,
      csp: {
        connectDomains,
        resourceDomains,
      },
    },
    "openai/widgetDescription": description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetDomain": origin,
    "openai/widgetCSP": {
      connect_domains: connectDomains,
      resource_domains: resourceDomains,
      redirect_domains: [origin],
    },
  };
}

export function widgetToolMeta(
  resourceUri: string,
  invoking: string,
  invoked: string,
): Record<string, unknown> {
  return {
    ui: {
      resourceUri,
      visibility: ["model", "app"],
    },
    "openai/outputTemplate": resourceUri,
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function widgetHtml(spec: WidgetSpec): string {
  const title = escapeHtml(spec.title);
  const description = escapeHtml(spec.description);
  const kind = JSON.stringify(spec.kind);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f8fb;
      color: #16171d;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: transparent; }
    main { padding: 16px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    h1 { font-size: 18px; line-height: 1.25; margin: 0; letter-spacing: 0; }
    h2 { font-size: 13px; line-height: 1.35; margin: 0 0 8px; letter-spacing: 0; text-transform: uppercase; color: #626b7a; }
    p { margin: 0; line-height: 1.45; }
    button {
      min-height: 36px;
      border: 1px solid #1f2937;
      border-radius: 8px;
      background: #111827;
      color: #ffffff;
      padding: 8px 12px;
      font: inherit;
      cursor: pointer;
    }
    button:disabled { cursor: not-allowed; opacity: 0.45; }
    .subtle { color: #626b7a; font-size: 13px; }
    .stack { display: grid; gap: 10px; }
    .panel { border: 1px solid #e4e7ee; border-radius: 8px; background: #ffffff; padding: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .metric { border: 1px solid #e4e7ee; border-radius: 8px; padding: 10px; background: #fafbfc; }
    .metric strong { display: block; font-size: 18px; line-height: 1.2; }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 650; background: #edf2ff; color: #263fa3; white-space: nowrap; }
    .ok { background: #dcfce7; color: #166534; }
    .warn { background: #fef3c7; color: #92400e; }
    .bad { background: #fee2e2; color: #991b1b; }
    ol, ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; line-height: 1.4; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .mono { overflow-wrap: anywhere; }
    @media (max-width: 520px) {
      header { display: grid; }
      .grid { grid-template-columns: 1fr; }
      button { width: 100%; }
    }
    @media (prefers-color-scheme: dark) {
      :root { background: #0a0d12; color: #f3f4f6; }
      .subtle, h2 { color: #a7b0bd; }
      .panel { background: #111827; border-color: #263244; }
      .metric { background: #0f172a; border-color: #263244; }
      button { border-color: #f3f4f6; background: #f3f4f6; color: #111827; }
      .pill { background: #1e3a8a; color: #dbeafe; }
      .ok { background: #14532d; color: #dcfce7; }
      .warn { background: #713f12; color: #fef3c7; }
      .bad { background: #7f1d1d; color: #fee2e2; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1 id="title">${title}</h1>
        <p class="subtle" id="subtitle">${description}</p>
      </div>
      <span class="pill" id="status">Loading</span>
    </header>
    <section class="stack" id="content">
      <div class="panel"><p class="subtle">Waiting for widget data.</p></div>
    </section>
  </main>
  <script>
    const expectedKind = ${kind};
    const fallbackTitle = ${JSON.stringify(spec.title)};

    function html(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function hostEnvelope() {
      const bridge = window.openai || {};
      const metadata = bridge.toolResponseMetadata || {};
      const mcpResult = metadata.mcp_tool_result || metadata.call_tool_result || {};
      return {
        bridge,
        output: bridge.toolOutput || mcpResult.structuredContent || {},
        details: (mcpResult._meta && mcpResult._meta.details) || metadata.details || {},
      };
    }

    function list(items, mapper) {
      if (!Array.isArray(items) || items.length === 0) return "<p class=\\"subtle\\">None</p>";
      return "<ol>" + items.map(mapper).join("") + "</ol>";
    }

    function setStatus(text, tone) {
      const status = document.getElementById("status");
      status.className = "pill " + (tone || "");
      status.textContent = text;
    }

    function panel(title, body) {
      return "<div class=\\"panel\\"><h2>" + html(title) + "</h2>" + body + "</div>";
    }

    function metric(label, value) {
      return "<div class=\\"metric\\"><strong>" + html(value) + "</strong><span class=\\"subtle\\">" + html(label) + "</span></div>";
    }

    function renderDraft(data) {
      document.getElementById("title").textContent = data.draft?.name || fallbackTitle;
      const valid = Boolean(data.validation?.valid);
      setStatus(valid ? "Ready" : "Needs setup", valid ? "ok" : "warn");
      const explanation = data.explanation?.beginnerExplanation || "No explanation available.";
      const steps = list(data.nodes, function(node) {
        return "<li><strong>" + html(node.label || node.type) + "</strong><br><span class=\\"subtle\\">" + html(node.description || node.id) + "</span></li>";
      });
      const errors = data.validation?.errors || [];
      return [
        panel("Summary", "<p>" + html(explanation) + "</p>"),
        panel("Steps", steps),
        panel("Validation", valid ? "<p>Ready to apply.</p>" : list(errors, function(item) { return "<li>" + html(item) + "</li>"; }))
      ].join("");
    }

    function renderSetup(data) {
      document.getElementById("title").textContent = data.workflow?.name ? "Setup: " + data.workflow.name : fallbackTitle;
      setStatus(data.ready ? "Ready" : "Needs setup", data.ready ? "ok" : "warn");
      const credentials = list(data.credentialChecks, function(item) {
        return "<li><strong>" + html(item.nodeLabel || item.nodeType) + "</strong>: " + html(item.status) + "</li>";
      });
      const webhooks = list(data.webhookSteps, function(item) {
        return "<li><strong>" + html(item.nodeType) + "</strong><br><code>" + html(item.webhookUrl || "Apply draft first") + "</code></li>";
      });
      const tests = list(data.testSteps, function(item) { return "<li>" + html(item) + "</li>"; });
      return [
        panel("Credentials", credentials),
        panel("Webhooks", webhooks),
        panel("Test steps", tests)
      ].join("");
    }

    function renderTimeline(data) {
      document.getElementById("title").textContent = data.execution?.workflowName || fallbackTitle;
      const status = data.execution?.status || "unknown";
      setStatus(status, status === "SUCCESS" ? "ok" : status === "FAILED" ? "bad" : "warn");
      const timeline = list(data.timeline, function(item) {
        return "<li><strong>" + html(item.order) + ". " + html(item.label || item.nodeType) + "</strong> <span class=\\"pill\\">" + html(item.status) + "</span></li>";
      });
      const duration = data.execution?.durationMs == null ? "running" : data.execution.durationMs + " ms";
      const error = data.execution?.error ? panel("Error", "<p class=\\"mono\\">" + html(data.execution.error) + "</p>") : "";
      return [
        "<div class=\\"grid\\">" + metric("Status", status) + metric("Duration", duration) + "</div>",
        panel("Timeline", timeline),
        error
      ].join("");
    }

    function renderApproval(data, bridge) {
      document.getElementById("title").textContent = data.draft?.name ? "Approve: " + data.draft.name : fallbackTitle;
      const valid = Boolean(data.validation?.valid);
      setStatus(valid ? "Valid" : "Invalid", valid ? "ok" : "bad");
      const diff = data.diff || {};
      const hash = data.approval?.confirmationHash || "";
      const canCall = Boolean(bridge && typeof bridge.callTool === "function" && data.approval?.arguments);
      setTimeout(function() {
        const button = document.getElementById("applyDraft");
        if (!button) return;
        button.disabled = !canCall || !valid;
        button.addEventListener("click", async function() {
          button.disabled = true;
          button.textContent = "Applying...";
          try {
            await bridge.callTool("apply_workflow_draft", data.approval.arguments);
            button.textContent = "Applied";
          } catch (error) {
            button.textContent = "Apply draft";
            button.disabled = false;
          }
        });
      }, 0);
      return [
        "<div class=\\"grid\\">" +
          metric("Added nodes", (diff.addedNodes || []).length) +
          metric("Changed nodes", (diff.changedNodes || []).length) +
          metric("Removed nodes", (diff.removedNodes || []).length) +
          metric("Added connections", (diff.addedEdges || []).length) +
        "</div>",
        panel("Confirmation", "<p><code>" + html(hash) + "</code></p>"),
        "<button id=\\"applyDraft\\" disabled>Apply draft</button>"
      ].join("");
    }

    function render() {
      const envelope = hostEnvelope();
      const data = envelope.details || {};
      const kind = envelope.output.kind || expectedKind;
      let body = "";

      if (!data || Object.keys(data).length === 0) {
        setStatus("Waiting", "warn");
        body = panel("Status", "<p class=\\"subtle\\">Waiting for widget data.</p>");
      } else if (kind === "workflowDraftPreview") {
        body = renderDraft(data);
      } else if (kind === "workflowSetupChecklist") {
        body = renderSetup(data);
      } else if (kind === "executionTimeline") {
        body = renderTimeline(data);
      } else if (kind === "workflowApproval") {
        body = renderApproval(data, envelope.bridge);
      } else {
        setStatus("Ready", "ok");
        body = panel("Data", "<pre>" + html(JSON.stringify(data, null, 2)) + "</pre>");
      }

      document.getElementById("content").innerHTML = body;
      if (envelope.bridge && typeof envelope.bridge.notifyIntrinsicHeight === "function") {
        envelope.bridge.notifyIntrinsicHeight();
      }
    }

    window.addEventListener("openai:set_globals", render);
    window.addEventListener("message", render);
    document.addEventListener("DOMContentLoaded", render);
    render();
  </script>
</body>
</html>`;
}

export function registerChatGptWidgetResources(server: McpServer): void {
  for (const spec of WIDGET_SPECS) {
    const meta = widgetResourceMeta(spec.description);
    server.registerResource(
      spec.name,
      spec.uri,
      {
        title: spec.title,
        description: spec.description,
        mimeType: MCP_APP_WIDGET_MIME_TYPE,
        _meta: meta,
      },
      async () => ({
        contents: [
          {
            uri: spec.uri,
            mimeType: MCP_APP_WIDGET_MIME_TYPE,
            text: widgetHtml(spec),
            _meta: meta,
          },
        ],
      }),
    );
  }
}
