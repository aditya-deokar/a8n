import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import fs from "node:fs/promises";
import path from "node:path";

export { RESOURCE_MIME_TYPE };
export const MCP_APP_WIDGET_MIME_TYPE = RESOURCE_MIME_TYPE;

export const CHATGPT_WIDGET_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

export const CHATGPT_WIDGET_URIS = {
  workflowDraftPreview: "ui://a8n/workflow-draft-preview.html",
  workflowSetupChecklist: "ui://a8n/workflow-setup-checklist.html",
  executionTimeline: "ui://a8n/execution-timeline.html",
  workflowApproval: "ui://a8n/workflow-approval.html",
} as const;

export const APP_WIDGET_URIS = CHATGPT_WIDGET_URIS;

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
  htmlFile: string;
};

export type ChatGptWidgetKind = WidgetSpec["kind"];

const WIDGET_SPECS: WidgetSpec[] = [
  {
    name: "chatgpt-workflow-draft-preview-widget",
    title: "Workflow draft preview",
    uri: CHATGPT_WIDGET_URIS.workflowDraftPreview,
    description:
      "Shows a workflow draft preview, validation state, and planned steps.",
    kind: "workflowDraftPreview",
    htmlFile: "workflow-draft-preview.html",
  },
  {
    name: "chatgpt-workflow-setup-checklist-widget",
    title: "Workflow setup checklist",
    uri: CHATGPT_WIDGET_URIS.workflowSetupChecklist,
    description:
      "Shows credentials, missing fields, webhook setup, and test steps.",
    kind: "workflowSetupChecklist",
    htmlFile: "workflow-setup-checklist.html",
  },
  {
    name: "chatgpt-execution-timeline-widget",
    title: "Execution timeline",
    uri: CHATGPT_WIDGET_URIS.executionTimeline,
    description:
      "Shows workflow execution status and node-by-node progress.",
    kind: "executionTimeline",
    htmlFile: "execution-timeline.html",
  },
  {
    name: "chatgpt-workflow-approval-widget",
    title: "Workflow approval",
    uri: CHATGPT_WIDGET_URIS.workflowApproval,
    description:
      "Shows the diff and confirmation hash before applying a workflow draft.",
    kind: "workflowApproval",
    htmlFile: "workflow-approval.html",
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

export function widgetResourceMeta(
  description: string,
): Record<string, unknown> {
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

export async function readWidgetHtmlFile(filename: string): Promise<string> {
  const filePath = path.resolve(process.cwd(), "dist/mcp-apps", filename);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return `<!doctype html><html><body><h1>Widget build missing: ${filename}</h1><p>Run pnpm build:mcp-apps-ui to build widget HTML bundles.</p></body></html>`;
  }
}

export async function renderChatGptWidgetHtml(
  kind: ChatGptWidgetKind,
): Promise<string> {
  const spec = WIDGET_SPECS.find((item) => item.kind === kind);
  if (!spec) {
    throw new Error(`Unknown ChatGPT widget kind: ${kind}`);
  }
  return readWidgetHtmlFile(spec.htmlFile);
}

export function listChatGptWidgetSpecs(): Array<
  Pick<WidgetSpec, "name" | "title" | "uri" | "description" | "kind">
> {
  return WIDGET_SPECS.map((spec) => ({ ...spec }));
}

export function registerChatGptWidgetResources(server: McpServer): void {
  for (const spec of WIDGET_SPECS) {
    const meta = widgetResourceMeta(spec.description);
    registerAppResource(
      server,
      spec.name,
      spec.uri,
      {
        title: spec.title,
        description: spec.description,
        mimeType: RESOURCE_MIME_TYPE,
        _meta: meta,
      },
      async () => {
        const html = await readWidgetHtmlFile(spec.htmlFile);
        return {
          contents: [
            {
              uri: spec.uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
              _meta: meta,
            },
          ],
        };
      },
    );
  }
}
