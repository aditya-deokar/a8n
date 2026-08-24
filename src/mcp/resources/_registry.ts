/**
 * Resource Registry
 *
 * Registers all MCP resources — read-only contextual data that
 * provides LLMs with schema references, documentation, and
 * type definitions for better tool usage.
 *
 * Resources (17) + resource templates (5):
 *   - a8n://schema/workflow         -> Workflow JSON structure
 *   - a8n://schema/node-types       -> Node types with fields & categories
 *   - a8n://schema/credential-types -> Credential types & security model
 *   - a8n://docs/api                -> Complete API reference
 *   - a8n://catalog/nodes           -> Machine-readable node catalog
 *   - a8n://catalog/credentials     -> Machine-readable credential catalog
 *   - a8n://integrations/{service}/setup -> Integration setup guides
 *   - a8n://integrations/{service}/setup template -> Service completion
 *   - a8n://apps/catalog            -> App-style resource catalog
 *   - a8n://apps/... templates      -> Preview, checklist, timeline, approval
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkflowSchemaResource } from "./workflow-schema.resource";
import { registerNodeTypesResource } from "./node-types.resource";
import { registerCredentialTypesResource } from "./credential-types.resource";
import { registerApiDocsResource } from "./api-docs.resource";
import { registerCatalogResources } from "./catalog.resource";
import { registerMcpAppResources } from "./app-resources.resource";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { isChatGptAppProfile } from "@/mcp/app-profile";
import { registerChatGptWidgetResources } from "@/mcp/apps/widget-resources";
import { logger } from "@/lib/logging";

import { hasUiCapability } from "@/mcp/shared/capability-guard";

export function registerAllResources(
  server: McpServer,
  context: McpToolContext = {},
): void {
  registerWorkflowSchemaResource(server);
  registerNodeTypesResource(server);
  registerCredentialTypesResource(server);
  registerApiDocsResource(server);
  registerCatalogResources(server);
  registerMcpAppResources(server, context);
  // Always register UI widget resources so MCP App clients can read ui://a8n/*.html
  registerChatGptWidgetResources(server);

  const supportsUi = true;

  logger.info(
    {
      component: "mcp",
      event: "mcp_registry_registered",
      registry: "resources",
      profile: context.appProfile || "default",
      uiCapability: supportsUi,
      count: 21,
      templates: 5,
    },
    "MCP resources registered.",
  );
}
