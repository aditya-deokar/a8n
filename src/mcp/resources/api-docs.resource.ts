/**
 * Resource: a8n://docs/api
 *
 * Provides LLMs with a complete reference of all available
 * MCP tools, their scopes, inputs, and usage patterns.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const API_DOCS = `# a8n MCP Server — API Reference

## Authentication

All requests require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <api_key_or_session_token>
\`\`\`

- **API Key**: \`a8n_mcp_...\` — scoped permissions, created via create_api_key
- **Session Token**: better-auth session — full access

## Permission Scopes

| Scope              | Description                                    |
|--------------------|------------------------------------------------|
| workflows:read     | Read workflow data (list, get)                  |
| workflows:write    | Create, update, rename, and delete workflows    |
| workflows:execute  | Trigger workflow executions                     |
| credentials:read   | Read credential metadata (not secret values)    |
| credentials:write  | Create, update, and delete credentials          |
| executions:read    | Read execution history and results              |
| system:read        | Read server info, node types, and user profile  |
| api_keys:manage    | Create, list, and revoke API keys               |
| *                  | Wildcard — full access to all operations        |

## Tools (21 total)

### Workflow Tools (scope: workflows:read/write/execute)

| Tool              | Type     | Description                              |
|-------------------|----------|------------------------------------------|
| list_workflows    | query    | Paginated list with search               |
| get_workflow      | query    | Full workflow with nodes & edges          |
| create_workflow   | mutation | Create with auto-generated or custom name |
| update_workflow   | mutation | Replace all nodes & connections            |
| rename_workflow   | mutation | Rename a workflow                         |
| delete_workflow   | mutation | Permanently delete                        |
| execute_workflow  | mutation | Trigger async execution via Inngest       |

### Credential Tools (scope: credentials:read/write)

| Tool                     | Type     | Description                       |
|--------------------------|----------|-----------------------------------|
| list_credentials         | query    | Paginated list (values masked)    |
| get_credential           | query    | Single credential (value masked)  |
| create_credential        | mutation | Create with encrypted value       |
| update_credential        | mutation | Update name/type/value            |
| delete_credential        | mutation | Delete by ID                      |
| list_credentials_by_type | query    | Filter by type (OPENAI, etc.)     |

### Execution Tools (scope: executions:read)

| Tool             | Type  | Description                          |
|------------------|-------|--------------------------------------|
| list_executions  | query | Paginated execution history          |
| get_execution    | query | Full details with output & errors    |

### Node Tools (scope: system:read)

| Tool            | Type  | Description                          |
|-----------------|-------|--------------------------------------|
| list_node_types | query | All available node types with metadata|

### System Tools (scope: system:read)

| Tool        | Type  | Description                          |
|-------------|-------|--------------------------------------|
| whoami      | query | Current user info & active scopes    |
| server_info | query | Server version, capabilities         |

### API Key Tools (scope: api_keys:manage)

| Tool           | Type     | Description                        |
|----------------|----------|------------------------------------|
| create_api_key | mutation | Generate new scoped API key        |
| list_api_keys  | query    | List active keys (masked)          |
| revoke_api_key | mutation | Revoke an API key                  |

## Resources (read-only context)

| URI                          | Description                              |
|------------------------------|------------------------------------------|
| a8n://schema/workflow        | Workflow JSON structure reference         |
| a8n://schema/node-types      | All available node types with fields      |
| a8n://schema/credential-types| Credential type definitions & security    |
| a8n://docs/api               | This API reference document               |

## Common Workflows

### Create and execute a simple workflow
1. \`create_workflow\` → get workflow ID
2. \`list_node_types\` → understand available nodes
3. \`update_workflow\` → add nodes and connections
4. \`execute_workflow\` → trigger execution
5. \`list_executions\` or \`get_execution\` → check results

### Set up an AI integration
1. \`create_credential\` with type OPENAI/ANTHROPIC/GEMINI
2. \`create_workflow\` → get workflow ID
3. \`update_workflow\` → add trigger + AI node with credentialId
4. \`execute_workflow\` → run the workflow
`;

export function registerApiDocsResource(server: McpServer) {
  server.resource(
    "api-docs",
    "a8n://docs/api",
    { description: "Complete MCP API reference — all tools, scopes, resources, and common usage patterns." },
    async () => ({
      contents: [
        {
          uri: "a8n://docs/api",
          mimeType: "text/markdown",
          text: API_DOCS,
        },
      ],
    }),
  );
}
