/**
 * Node Tools — list_node_types
 * Scope: system:read
 *
 * Exposes the available node types and their metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import {
  CREDENTIAL_TYPE_MANIFESTS,
  getNodeCatalog,
  INTEGRATION_SERVICE_KEYS,
  NODE_MANIFESTS,
  WORKFLOW_TEMPLATE_MANIFESTS,
} from "@/features/workflows/node-manifest";

const listNodeTypesOutputSchema = {
  nodeTypes: z.array(z.object({}).passthrough()),
  count: z.number(),
};

const searchCapabilitiesOutputSchema = {
  query: z.string(),
  nodes: z.array(z.object({}).passthrough()),
  credentials: z.array(z.object({}).passthrough()),
  integrations: z.array(z.object({}).passthrough()),
  templates: z.array(z.object({}).passthrough()),
  catalogs: z.object({
    nodes: z.string(),
    credentials: z.string(),
  }),
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function scoreText(query: string, values: string[]): number {
  if (!query) return 1;

  const normalizedValues = values.map((value) => normalizeSearch(value));
  const joined = normalizedValues.join(" ");
  const tokens = query.split(/\s+/).filter(Boolean);

  let score = 0;
  if (joined.includes(query)) score += 4;

  for (const token of tokens) {
    if (normalizedValues.some((value) => value === token)) score += 3;
    if (normalizedValues.some((value) => value.includes(token))) score += 1;
  }

  return score;
}

export function registerListNodeTypes(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "list_node_types",
    {
      description:
        "List all available node types that can be used in workflows. Includes category, beginner description, required fields, outputs, credential requirements, and safety metadata.",
      inputSchema: {},
      outputSchema: listNodeTypesOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("list_node_types", async () => {
        return mcpJsonResponse({
          nodeTypes: getNodeCatalog(),
          count: NODE_MANIFESTS.length,
        });
      });
    },
  );
}

export function registerSearchCapabilities(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "search_capabilities",
    {
      description:
        "Search a8n workflow capabilities by plain language. Returns matching nodes, credential types, integrations, and workflow templates for beginner-friendly workflow planning.",
      inputSchema: {
        query: z
          .string()
          .default("")
          .describe("Plain-language search, for example: 'send email', 'save to spreadsheet', 'summarize form', or 'Stripe alert'."),
        limit: z
          .number()
          .min(1)
          .max(20)
          .default(8)
          .describe("Maximum results per category."),
      },
      outputSchema: searchCapabilitiesOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("search_capabilities", async () => {
        const query = normalizeSearch(args.query || "");
        const limit = args.limit ?? 8;

        const nodes = NODE_MANIFESTS.map((node) => ({
          score: scoreText(query, [
            node.type,
            node.label,
            node.description,
            node.beginnerDescription,
            node.category,
            ...(node.aliases || []),
            ...(node.examples || []),
          ]),
          result: {
            type: node.type,
            label: node.label,
            category: node.category,
            description: node.beginnerDescription,
            credentialType: node.credentialType || null,
            requiredFields: node.requiredFields,
            outputs: node.outputs,
            sideEffect: node.sideEffect,
            riskLevel: node.riskLevel,
            examples: node.examples,
          },
        }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((entry) => entry.result);

        const credentials = CREDENTIAL_TYPE_MANIFESTS.map((credential) => ({
          score: scoreText(query, [
            credential.type,
            credential.label,
            credential.description,
            credential.valueFormat,
            ...credential.setup,
            ...credential.usedBy,
          ]),
          result: credential,
        }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((entry) => entry.result);

        const integrations = INTEGRATION_SERVICE_KEYS.map((service) => ({
          score: scoreText(query, [service, service.replace("_", " ")]),
          result: {
            service,
            resourceUri: `a8n://integrations/${service}/setup`,
          },
        }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((entry) => entry.result);

        const templates = WORKFLOW_TEMPLATE_MANIFESTS.map((template) => ({
          score: scoreText(query, [
            template.id,
            template.label,
            template.description,
            ...template.aliases,
            ...template.nodeTypes,
            ...template.requiredCredentialTypes,
          ]),
          result: template,
        }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((entry) => entry.result);

        return mcpJsonResponse({
          query: args.query,
          nodes,
          credentials,
          integrations,
          templates,
          catalogs: {
            nodes: "a8n://catalog/nodes",
            credentials: "a8n://catalog/credentials",
          },
        });
      });
    },
  );
}
