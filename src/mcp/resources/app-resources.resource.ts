/**
 * MCP app-style resources.
 *
 * These resources provide lightweight HTML previews for MCP clients that can
 * render rich content, plus markdown fallbacks for plain chat clients.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/db";
import { ExecutionStatus, NodeType } from "@/generated/prisma";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { sanitizeOutput } from "@/mcp/shared/sanitize";
import { getNodeManifest } from "@/features/workflows/node-manifest";
import {
  asGraphEdges,
  asGraphNodes,
  explainGraph,
  getWorkflowGraph,
  stableHash,
  validateWorkflowGraph,
  type WorkflowGraphEdge,
  type WorkflowGraphNode,
} from "@/mcp/tools/workflows/workflow-graph-utils";

function getResourceAuth(context: McpToolContext) {
  return getMcpAuth(undefined, context);
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function webhookUrl(workflowId: string, trigger: "google_form" | "stripe"): string {
  const path = trigger === "google_form" ? "google-form" : "stripe";
  return `${appBaseUrl()}/api/webhooks/${path}?workflowId=${workflowId}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderShell(title: string, body: string, data: unknown): string {
  const json = escapeHtml(JSON.stringify(sanitizeOutput(data), null, 2));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #15151a; }
    main { max-width: 920px; margin: 0 auto; padding: 24px; }
    .panel { background: #fff; border: 1px solid #e6e8ef; border-radius: 10px; padding: 18px; margin: 14px 0; box-shadow: 0 1px 2px rgb(15 23 42 / 6%); }
    h1 { font-size: 24px; line-height: 1.25; margin: 0 0 14px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    ul, ol { padding-left: 22px; }
    li { margin: 6px 0; }
    code, pre { font-family: "SFMono-Regular", Consolas, monospace; }
    pre { white-space: pre-wrap; overflow: auto; background: #111827; color: #e5e7eb; padding: 14px; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .pill { display: inline-block; border-radius: 999px; padding: 3px 9px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 600; }
    .ok { color: #047857; }
    .warn { color: #b45309; }
    .bad { color: #b91c1c; }
    @media (prefers-color-scheme: dark) {
      body { background: #09090b; color: #f4f4f5; }
      .panel { background: #18181b; border-color: #27272a; }
      .pill { background: #312e81; color: #e0e7ff; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body}
    <details class="panel">
      <summary>Structured data</summary>
      <pre>${json}</pre>
    </details>
  </main>
</body>
</html>`;
}

function markdownList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function contentBundle(uri: string, title: string, htmlBody: string, markdown: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "text/html",
        text: renderShell(title, htmlBody, data),
      },
      {
        uri: `${uri}#markdown`,
        mimeType: "text/markdown",
        text: markdown,
      },
    ],
  };
}

function buildGraphDiff(
  beforeNodes: WorkflowGraphNode[],
  beforeEdges: WorkflowGraphEdge[],
  afterNodes: WorkflowGraphNode[],
  afterEdges: WorkflowGraphEdge[],
) {
  const beforeById = new Map(beforeNodes.map((node) => [node.id, node]));
  const afterById = new Map(afterNodes.map((node) => [node.id, node]));
  const beforeEdgeKeys = new Set(beforeEdges.map((edge) => `${edge.source}->${edge.target}`));
  const afterEdgeKeys = new Set(afterEdges.map((edge) => `${edge.source}->${edge.target}`));

  return {
    addedNodes: afterNodes.filter((node) => !beforeById.has(node.id)),
    removedNodes: beforeNodes.filter((node) => !afterById.has(node.id)),
    changedNodes: afterNodes.filter((node) => {
      const before = beforeById.get(node.id);
      return before && JSON.stringify(before) !== JSON.stringify(node);
    }),
    addedEdges: afterEdges.filter((edge) => !beforeEdgeKeys.has(`${edge.source}->${edge.target}`)),
    removedEdges: beforeEdges.filter((edge) => !afterEdgeKeys.has(`${edge.source}->${edge.target}`)),
  };
}

function nodeSummary(node: WorkflowGraphNode) {
  const manifest = getNodeManifest(node.type);
  return {
    id: node.id,
    type: node.type,
    label: manifest.label,
    description: manifest.beginnerDescription,
    riskLevel: manifest.riskLevel,
    sideEffect: manifest.sideEffect,
    visibleConfig: Object.fromEntries(
      Object.entries(node.data).filter(([key]) =>
        ["variableName", "method", "endpoint", "to", "subject", "sheetName", "spreadsheetId"].includes(key),
      ),
    ),
  };
}

export async function draftPreview(draftId: string, userId: string) {
  const draft = await prisma.workflowDraft.findUniqueOrThrow({
    where: { id: draftId, userId },
  });
  const nodes = asGraphNodes(draft.nodes);
  const edges = asGraphEdges(draft.edges);
  const validation = await validateWorkflowGraph({ userId, nodes, edges });
  const explanation = explainGraph({
    name: draft.name,
    nodes,
    edges,
    validation,
  });

  return {
    draft: {
      id: draft.id,
      name: draft.name,
      goal: draft.goal,
      status: draft.status,
      workflowId: draft.workflowId,
    },
    validation,
    explanation,
    nodes: nodes.map(nodeSummary),
    edges,
  };
}

export async function setupChecklist(workflowId: string, userId: string) {
  const graph = await getWorkflowGraph(workflowId, userId);
  const validation = await validateWorkflowGraph({
    userId,
    nodes: graph.nodes,
    edges: graph.edges,
  });
  const credentialChecks = graph.nodes.flatMap((node) => {
    const manifest = getNodeManifest(node.type);
    if (!manifest.credentialType) return [];
    const credentialId = node.data.credentialId;
    return [
      {
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: manifest.label,
        requiredCredentialType: manifest.credentialType,
        credentialId: typeof credentialId === "string" && credentialId ? credentialId : null,
        status: typeof credentialId === "string" && credentialId ? "configured" : "missing",
      },
    ];
  });
  const webhookSteps = graph.nodes.flatMap((node) => {
    if (node.type !== NodeType.GOOGLE_FORM_TRIGGER && node.type !== NodeType.STRIPE_TRIGGER) return [];
    const trigger = node.type === NodeType.GOOGLE_FORM_TRIGGER ? "google_form" : "stripe";
    return [
      {
        nodeId: node.id,
        nodeType: node.type,
        webhookUrl: webhookUrl(workflowId, trigger),
        verification:
          trigger === "stripe"
            ? "Set STRIPE_WEBHOOK_SECRET for signature verification, or STRIPE_WEBHOOK_SHARED_SECRET for shared-secret verification."
            : "Set GOOGLE_FORM_WEBHOOK_SECRET or A8N_WEBHOOK_SHARED_SECRET for shared-secret verification.",
      },
    ];
  });

  return {
    workflow: { id: graph.workflow.id, name: graph.workflow.name },
    ready: validation.valid && credentialChecks.every((item) => item.status === "configured"),
    validation,
    credentialChecks,
    webhookSteps,
    testSteps: [
      "Run test_credential for every configured credential.",
      "Run test_webhook_setup for Google Form or Stripe triggers.",
      "Run run_workflow_test before sending real external data.",
    ],
  };
}

export async function executionTimeline(executionId: string, userId: string) {
  const execution = await prisma.execution.findFirstOrThrow({
    where: { id: executionId, workflow: { userId } },
    include: {
      workflow: {
        include: {
          nodes: true,
          connections: true,
        },
      },
    },
  });
  const nodes = execution.workflow.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position as { x?: number; y?: number },
      data: (node.data as Record<string, unknown>) || {},
    }))
    .sort((a, b) => (a.position.x || 0) - (b.position.x || 0));
  const durationMs = execution.completedAt
    ? execution.completedAt.getTime() - execution.startedAt.getTime()
    : null;

  return {
    execution: {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      inngestEventId: execution.inngestEventId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs,
      error: execution.error,
    },
    timeline: nodes.map((node, index) => {
      const manifest = getNodeManifest(node.type);
      return {
        order: index + 1,
        nodeId: node.id,
        nodeType: node.type,
        label: manifest.label,
        status:
          execution.status === ExecutionStatus.SUCCESS
            ? "success"
            : execution.status === ExecutionStatus.RUNNING
              ? "unknown_running"
              : "needs_diagnosis",
        visibleConfig: nodeSummary({
          id: node.id,
          type: node.type,
          position: { x: node.position.x || 0, y: node.position.y || 0 },
          data: node.data,
        }).visibleConfig,
      };
    }),
    output: sanitizeOutput(execution.output),
  };
}

export async function approvalPreview(draftId: string, userId: string) {
  const draft = await prisma.workflowDraft.findUniqueOrThrow({
    where: { id: draftId, userId },
  });
  const targetWorkflowId = draft.workflowId;
  const nodes = asGraphNodes(draft.nodes);
  const edges = asGraphEdges(draft.edges);
  const validation = await validateWorkflowGraph({ userId, nodes, edges });
  const before = targetWorkflowId
    ? await getWorkflowGraph(targetWorkflowId, userId)
    : { nodes: [], edges: [] };
  const diff = buildGraphDiff(before.nodes, before.edges, nodes, edges);
  const confirmationSummary = {
    draftId: draft.id,
    workflowId: targetWorkflowId || null,
    diff,
    validationValid: validation.valid,
  };
  const confirmationHash = stableHash(confirmationSummary);

  return {
    draft: {
      id: draft.id,
      name: draft.name,
      goal: draft.goal,
      workflowId: targetWorkflowId,
    },
    validation,
    diff,
    approval: {
      required: true,
      confirmationHash,
      tool: "apply_workflow_draft",
      arguments: {
        draftId: draft.id,
        workflowId: targetWorkflowId || undefined,
        approved: true,
        confirmationHash,
      },
    },
  };
}

export function registerMcpAppResources(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.resource(
    "mcp-app-catalog",
    "a8n://apps/catalog",
    {
      description:
        "Catalog of app-style MCP resources for workflow previews, setup checklists, execution timelines, and approvals.",
    },
    async () => ({
      contents: [
        {
          uri: "a8n://apps/catalog",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              apps: [
                "a8n://apps/workflow-drafts/{draftId}/preview",
                "a8n://apps/workflows/{workflowId}/setup-checklist",
                "a8n://apps/executions/{executionId}/timeline",
                "a8n://apps/workflow-drafts/{draftId}/approval",
              ],
              fallback: "Every app resource returns text/html and text/markdown content.",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.resource(
    "workflow-draft-preview-app",
    new ResourceTemplate("a8n://apps/workflow-drafts/{draftId}/preview", { list: undefined }),
    { description: "Visual and markdown preview of a workflow draft." },
    async (uri, variables) => {
      const auth = getResourceAuth(context);
      requireScope(auth, "workflows:read");
      const data = await draftPreview(String(variables.draftId), auth.userId);
      const steps = data.nodes.map((node) => `${node.label}: ${node.description}`);
      const markdown = `# ${data.draft.name}\n\n${data.explanation.beginnerExplanation}\n\n## Steps\n${markdownList(steps)}\n\n## Validation\n${data.validation.valid ? "Ready to apply." : markdownList(data.validation.errors)}`;
      const html = `<div class="panel"><span class="pill">${escapeHtml(data.draft.status)}</span><p>${escapeHtml(data.explanation.beginnerExplanation)}</p></div><div class="panel"><h2>Steps</h2><ol>${data.nodes.map((node) => `<li><strong>${escapeHtml(node.label)}</strong><br />${escapeHtml(node.description)}</li>`).join("")}</ol></div><div class="panel"><h2>Validation</h2><p class="${data.validation.valid ? "ok" : "bad"}">${data.validation.valid ? "Ready to apply." : "Needs attention before applying."}</p></div>`;
      return contentBundle(uri.toString(), data.draft.name, html, markdown, data);
    },
  );

  server.resource(
    "workflow-setup-checklist-app",
    new ResourceTemplate("a8n://apps/workflows/{workflowId}/setup-checklist", { list: undefined }),
    { description: "Visual and markdown setup checklist for a saved workflow." },
    async (uri, variables) => {
      const auth = getResourceAuth(context);
      requireScope(auth, "workflows:read");
      const data = await setupChecklist(String(variables.workflowId), auth.userId);
      const items = [
        ...data.validation.missingFields.map((field) => `Fill ${field.label} on ${field.nodeType}.`),
        ...data.credentialChecks.map((credential) => `${credential.nodeLabel}: ${credential.status}`),
        ...data.webhookSteps.map((webhook) => `${webhook.nodeType}: ${webhook.webhookUrl}`),
      ];
      const markdown = `# Setup checklist: ${data.workflow.name}\n\nStatus: ${data.ready ? "Ready" : "Needs setup"}\n\n${markdownList(items)}\n\n## Test steps\n${markdownList(data.testSteps)}`;
      const html = `<div class="panel"><p class="${data.ready ? "ok" : "warn"}">${data.ready ? "Ready to test." : "A few setup items remain."}</p></div><div class="panel"><h2>Checklist</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div class="panel"><h2>Test steps</h2><ol>${data.testSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>`;
      return contentBundle(uri.toString(), `Setup checklist: ${data.workflow.name}`, html, markdown, data);
    },
  );

  server.resource(
    "execution-timeline-app",
    new ResourceTemplate("a8n://apps/executions/{executionId}/timeline", { list: undefined }),
    { description: "Visual and markdown execution timeline." },
    async (uri, variables) => {
      const auth = getResourceAuth(context);
      requireScope(auth, "executions:read");
      const data = await executionTimeline(String(variables.executionId), auth.userId);
      const items = data.timeline.map((item) => `${item.order}. ${item.label}: ${item.status}`);
      const markdown = `# Execution timeline\n\nWorkflow: ${data.execution.workflowName}\nStatus: ${data.execution.status}\nDuration: ${data.execution.durationMs ?? "running"} ms\n\n${markdownList(items)}${data.execution.error ? `\n\n## Error\n${data.execution.error}` : ""}`;
      const html = `<div class="panel"><span class="pill">${escapeHtml(data.execution.status)}</span><p>Workflow: ${escapeHtml(data.execution.workflowName)}</p><p>Duration: ${escapeHtml(data.execution.durationMs ?? "running")} ms</p></div><div class="panel"><h2>Timeline</h2><ol>${data.timeline.map((item) => `<li><strong>${escapeHtml(item.label)}</strong> <span class="pill">${escapeHtml(item.status)}</span></li>`).join("")}</ol></div>${data.execution.error ? `<div class="panel"><h2>Error</h2><p class="bad">${escapeHtml(data.execution.error)}</p></div>` : ""}`;
      return contentBundle(uri.toString(), "Execution timeline", html, markdown, data);
    },
  );

  server.resource(
    "workflow-draft-approval-app",
    new ResourceTemplate("a8n://apps/workflow-drafts/{draftId}/approval", { list: undefined }),
    { description: "Approval screen and confirmation hash for applying a workflow draft." },
    async (uri, variables) => {
      const auth = getResourceAuth(context);
      requireScope(auth, "workflows:read");
      const data = await approvalPreview(String(variables.draftId), auth.userId);
      const markdown = `# Approval: ${data.draft.name}\n\nValidation: ${data.validation.valid ? "valid" : "invalid"}\n\nConfirmation hash: \`${data.approval.confirmationHash}\`\n\nCall \`apply_workflow_draft\` with \`approved: true\` only after the user approves.`;
      const html = `<div class="panel"><p class="${data.validation.valid ? "ok" : "bad"}">${data.validation.valid ? "This draft is valid." : "This draft is not valid yet."}</p><p>Confirmation hash: <code>${escapeHtml(data.approval.confirmationHash)}</code></p></div><div class="panel"><h2>Change summary</h2><div class="grid"><div>Added nodes: <strong>${data.diff.addedNodes.length}</strong></div><div>Changed nodes: <strong>${data.diff.changedNodes.length}</strong></div><div>Removed nodes: <strong>${data.diff.removedNodes.length}</strong></div><div>Added connections: <strong>${data.diff.addedEdges.length}</strong></div></div></div>`;
      return contentBundle(uri.toString(), `Approval: ${data.draft.name}`, html, markdown, data);
    },
  );
}
