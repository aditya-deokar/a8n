/**
 * Resources:
 *   a8n://catalog/nodes
 *   a8n://catalog/credentials
 *   a8n://integrations/{service}/setup
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getCredentialCatalog,
  getIntegrationSetupGuide,
  getNodeCatalog,
  INTEGRATION_SERVICE_KEYS,
  WORKFLOW_TEMPLATE_MANIFESTS,
  type IntegrationServiceKey,
} from "@/features/workflows/node-manifest";

function isIntegrationServiceKey(value: string): value is IntegrationServiceKey {
  return INTEGRATION_SERVICE_KEYS.includes(value as IntegrationServiceKey);
}

export function registerNodeCatalogResource(server: McpServer) {
  server.resource(
    "node-catalog",
    "a8n://catalog/nodes",
    {
      description:
        "Machine-readable catalog of all workflow node types, fields, outputs, credentials, examples, and safety metadata.",
    },
    async () => ({
      contents: [
        {
          uri: "a8n://catalog/nodes",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              nodes: getNodeCatalog(),
              templates: WORKFLOW_TEMPLATE_MANIFESTS,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}

export function registerCredentialCatalogResource(server: McpServer) {
  server.resource(
    "credential-catalog",
    "a8n://catalog/credentials",
    {
      description:
        "Machine-readable catalog of credential types, value formats, setup steps, and node usage.",
    },
    async () => ({
      contents: [
        {
          uri: "a8n://catalog/credentials",
          mimeType: "application/json",
          text: JSON.stringify({ credentials: getCredentialCatalog() }, null, 2),
        },
      ],
    }),
  );
}

export function registerIntegrationSetupTemplateResource(server: McpServer) {
  const template = new ResourceTemplate("a8n://integrations/{service}/setup", {
    list: undefined,
    complete: {
      service: (value) => {
        const normalized = value.trim().toLowerCase();
        return INTEGRATION_SERVICE_KEYS.filter((service) =>
          service.startsWith(normalized),
        );
      },
    },
  });

  server.resource(
    "integration-setup-template",
    template,
    {
      description:
        "Template resource for setup guides. Supports completion for available integration services.",
    },
    async (_uri, variables) => {
      const service = String(variables.service);
      if (!isIntegrationServiceKey(service)) {
        throw new Error(`Unknown integration service: ${service}`);
      }

      return {
        contents: [
          {
            uri: `a8n://integrations/${service}/setup`,
            mimeType: "text/markdown",
            text: getIntegrationSetupGuide(service),
          },
        ],
      };
    },
  );
}

export function registerIntegrationSetupResources(server: McpServer) {
  for (const service of INTEGRATION_SERVICE_KEYS) {
    server.resource(
      `integration-${service}-setup`,
      `a8n://integrations/${service}/setup`,
      {
        description: `Setup guide for the ${service.replace("_", " ")} integration.`,
      },
      async () => ({
        contents: [
          {
            uri: `a8n://integrations/${service}/setup`,
            mimeType: "text/markdown",
            text: getIntegrationSetupGuide(service as IntegrationServiceKey),
          },
        ],
      }),
    );
  }
}

export function registerCatalogResources(server: McpServer) {
  registerNodeCatalogResource(server);
  registerCredentialCatalogResource(server);
  registerIntegrationSetupTemplateResource(server);
  registerIntegrationSetupResources(server);
}
