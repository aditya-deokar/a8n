/**
 * Resource: a8n://schema/workflow
 *
 * Provides LLMs with a structural reference for how workflows
 * are composed — the JSON shape of nodes, edges, and positions.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const WORKFLOW_SCHEMA_DOC = `# a8n Workflow Schema Reference

A workflow is a directed acyclic graph (DAG) composed of **nodes** and **edges** (connections).

## Workflow Object

| Field       | Type     | Description                          |
|-------------|----------|--------------------------------------|
| id          | string   | Unique CUID identifier               |
| name        | string   | Human-readable name                  |
| userId      | string   | Owner user ID                        |
| createdAt   | DateTime | Creation timestamp                   |
| updatedAt   | DateTime | Last modification timestamp          |

## Node Object

| Field        | Type            | Description                                    |
|--------------|-----------------|------------------------------------------------|
| id           | string          | Unique CUID identifier                         |
| type         | NodeType enum   | The node type (see list_node_types)             |
| position     | { x, y }        | Canvas position in pixels                      |
| data         | object          | Node-specific configuration (varies by type)   |
| credentialId | string | null   | Optional linked credential                     |

## Edge (Connection) Object

| Field        | Type   | Description                                     |
|--------------|--------|-------------------------------------------------|
| source       | string | Source node ID                                   |
| target       | string | Target node ID                                   |
| sourceHandle | string | Output handle name (default: "main")             |
| targetHandle | string | Input handle name (default: "main")              |

## Example Workflow (2 nodes, 1 edge)

\`\`\`json
{
  "id": "clx1abc...",
  "name": "my-workflow",
  "nodes": [
    { "id": "node-1", "type": "MANUAL_TRIGGER", "position": { "x": 0, "y": 0 }, "data": {} },
    { "id": "node-2", "type": "HTTP_REQUEST", "position": { "x": 300, "y": 0 }, "data": { "url": "https://api.example.com", "method": "GET" } }
  ],
  "edges": [
    { "source": "node-1", "target": "node-2", "sourceHandle": "main", "targetHandle": "main" }
  ]
}
\`\`\`

## Node Execution Order

Nodes are executed in **topological order** — each node runs only after all its upstream dependencies have completed. The execution engine traverses the DAG from trigger nodes to terminal nodes, passing context data along each edge.
`;

export function registerWorkflowSchemaResource(server: McpServer) {
  server.resource(
    "workflow-schema",
    "a8n://schema/workflow",
    { description: "Structural reference for a8n workflow JSON — nodes, edges, positions, and execution order." },
    async () => ({
      contents: [
        {
          uri: "a8n://schema/workflow",
          mimeType: "text/markdown",
          text: WORKFLOW_SCHEMA_DOC,
        },
      ],
    }),
  );
}
