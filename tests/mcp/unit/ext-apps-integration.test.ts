import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/mcp";
import {
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  CHATGPT_WIDGET_URIS,
  readWidgetHtmlFile,
} from "@/mcp/apps/widget-resources";
import { hasUiCapability } from "@/mcp/shared/capability-guard";

describe("@modelcontextprotocol/ext-apps Integration", () => {
  it("uses standard RESOURCE_MIME_TYPE for MCP Apps resources", () => {
    expect(RESOURCE_MIME_TYPE).toBe("text/html;profile=mcp-app");
  });

  it("loads built HTML bundles for all 4 widgets", async () => {
    const widgets = [
      "workflow-draft-preview.html",
      "workflow-setup-checklist.html",
      "execution-timeline.html",
      "workflow-approval.html",
    ];

    for (const widget of widgets) {
      const html = await readWidgetHtmlFile(widget);
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("a8n");
    }
  });

  it("registerAppTool normalizes _meta.ui.resourceUri metadata", () => {
    const server = createMcpServer(undefined, { appProfile: "chatgpt" });
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { title?: string; _meta?: Record<string, unknown> }> })._registeredTools;

    const renderDraftTool = registeredTools["render_workflow_draft_preview"];
    expect(renderDraftTool).toBeDefined();

    const meta = renderDraftTool?._meta as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect((meta?.ui as Record<string, unknown>)?.resourceUri).toBe(
      CHATGPT_WIDGET_URIS.workflowDraftPreview,
    );
    // Legacy fallback key checked by ext-apps SDK
    expect(meta?.["ui/resourceUri"]).toBe(
      CHATGPT_WIDGET_URIS.workflowDraftPreview,
    );
  });

  it("registerAppResource provides RESOURCE_MIME_TYPE resources", () => {
    const server = createMcpServer(undefined, { appProfile: "chatgpt" });
    const registeredResources = (server as unknown as { _registeredResources: Record<string, { uri: string; mimeType?: string }> })._registeredResources;

    const resources = Object.values(registeredResources || {});
    expect(resources.length).toBeGreaterThan(0);

    const draftResource = resources.find(
      (r) => r.uri === CHATGPT_WIDGET_URIS.workflowDraftPreview || (r as unknown as { name?: string }).name === "chatgpt-workflow-draft-preview-widget",
    );
    expect(draftResource).toBeDefined();
    const mime = (draftResource as unknown as { metadata?: { mimeType?: string }; mimeType?: string }).metadata?.mimeType ?? draftResource?.mimeType;
    expect(mime).toBe(RESOURCE_MIME_TYPE);
  });

  it("hasUiCapability returns true for chatgpt and embedded_agent profiles", () => {
    const chatgptServer = createMcpServer(undefined, { appProfile: "chatgpt" });
    const embeddedServer = createMcpServer(undefined, { appProfile: "embedded_agent" });
    const defaultServer = createMcpServer(undefined, { appProfile: "default" });

    expect(hasUiCapability(chatgptServer, "chatgpt")).toBe(true);
    expect(hasUiCapability(embeddedServer, "embedded_agent")).toBe(true);
    expect(hasUiCapability(defaultServer, "default")).toBe(false);
  });

  it("registers 4 render tools in embedded_agent profile", () => {
    const server = createMcpServer(undefined, { appProfile: "embedded_agent" });
    const registeredTools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;

    const renderToolNames = [
      "render_workflow_draft_preview",
      "render_workflow_setup_checklist",
      "render_execution_timeline",
      "render_workflow_approval",
    ];

    for (const name of renderToolNames) {
      expect(registeredTools[name]).toBeDefined();
    }
  });
});
