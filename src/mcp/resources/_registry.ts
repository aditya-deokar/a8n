/**
 * Resource Registry
 *
 * Registers all MCP resources — read-only contextual data that
 * provides LLMs with schema references, documentation, and
 * type definitions for better tool usage.
 *
 * Resources (4):
 *   - a8n://schema/workflow        → Workflow JSON structure
 *   - a8n://schema/node-types      → Node types with fields & categories
 *   - a8n://schema/credential-types → Credential types & security model
 *   - a8n://docs/api               → Complete API reference
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkflowSchemaResource } from "./workflow-schema.resource";
import { registerNodeTypesResource } from "./node-types.resource";
import { registerCredentialTypesResource } from "./credential-types.resource";
import { registerApiDocsResource } from "./api-docs.resource";

export function registerAllResources(server: McpServer): void {
  registerWorkflowSchemaResource(server);
  registerNodeTypesResource(server);
  registerCredentialTypesResource(server);
  registerApiDocsResource(server);

  console.log("[MCP] 4 resources registered");
}
