/**
 * Resource: a8n://schema/node-types
 *
 * Generated from the canonical node manifest so MCP context stays
 * aligned with the editor and execution engine.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NODE_MANIFESTS } from "@/features/workflows/node-manifest";

function buildNodeTypesDoc(): string {
  const byCategory = NODE_MANIFESTS.reduce<Record<string, typeof NODE_MANIFESTS>>(
    (acc, node) => {
      acc[node.category] ||= [];
      acc[node.category].push(node);
      return acc;
    },
    {},
  );

  const sections = Object.entries(byCategory)
    .map(([category, nodes]) => {
      const rows = nodes
        .map((node) => {
          const requiredFields = node.requiredFields.length
            ? node.requiredFields.map((field) => field.name).join(", ")
            : "none";
          const credential = node.credentialType || "none";
          const outputs = node.outputs.length
            ? node.outputs.map((output) => output.variablePath).join(", ")
            : "none";

          return `| ${node.type} | ${node.label} | ${node.beginnerDescription} | ${requiredFields} | ${credential} | ${outputs} |`;
        })
        .join("\n");

      return `## ${category}

| Type | Label | Description | Required fields | Credential | Outputs |
|---|---|---|---|---|---|
${rows}`;
    })
    .join("\n\n");

  return `# a8n Node Types Reference

Nodes are the building blocks of workflows. Each node has a type, category, required fields, optional fields, outputs, and safety metadata.

This resource is generated from the canonical node manifest used by MCP and the editor.

Total node types: ${NODE_MANIFESTS.length}

${sections}

## Connecting Nodes

- Every node has a default "main" input and output handle.
- Connect nodes by creating edges from a source node's output to a target node's input.
- Trigger nodes have no input; they are always the first node in a chain.
- AI, Email, and Google Sheets nodes require linked credentials of the matching type.
- Use \`a8n://catalog/nodes\` for machine-readable node metadata.
`;
}

export function registerNodeTypesResource(server: McpServer) {
  server.resource(
    "node-types",
    "a8n://schema/node-types",
    {
      description:
        "All available node types with categories, fields, outputs, credentials, and safety metadata.",
    },
    async () => ({
      contents: [
        {
          uri: "a8n://schema/node-types",
          mimeType: "text/markdown",
          text: buildNodeTypesDoc(),
        },
      ],
    }),
  );
}
