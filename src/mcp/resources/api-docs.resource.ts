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

## Tools (53 total)

Mutation note: \`create_workflow\` and \`create_credential\` require an active subscription, matching the app's premium create routes. \`create_credential\` is an advanced secret-handling tool; prefer dashboard or OAuth-style setup for non-technical users.

### Workflow Tools (scope: workflows:read/write/execute)

| Tool              | Type     | Description                              |
|-------------------|----------|------------------------------------------|
| list_workflows    | query    | Paginated list with search               |
| get_workflow      | query    | Full workflow with nodes & edges          |
| create_workflow   | mutation | Create with auto-generated or custom name |
| update_workflow   | mutation | Replace all nodes & connections            |
| rename_workflow   | mutation | Rename a workflow                         |
| delete_workflow   | mutation | Permanently delete                        |
| execute_workflow  | mutation | Trigger async execution and return event correlation ID |
| plan_workflow_from_goal | query | Turn a goal into plain-language plan |
| create_workflow_draft | mutation | Build a persisted draft graph |
| answer_workflow_draft_questions | mutation | Fill non-sensitive draft fields |
| validate_workflow_draft | mutation | Validate graph, fields, credentials, and safety |
| explain_workflow | query | Explain draft or saved workflow for beginners |
| preview_workflow_diff | query | Show diff and approval hash before apply |
| apply_workflow_draft | mutation | Save a validated draft after approval |
| list_workflow_versions | query | List rollback snapshots |
| duplicate_workflow | mutation | Copy a workflow |
| rollback_workflow_version | mutation | Restore a snapshot after approval |
| add_workflow_node | mutation | Safe approved partial edit |
| update_node_config | mutation | Safe approved partial edit |
| connect_workflow_nodes | mutation | Safe approved partial edit |
| disconnect_workflow_nodes | mutation | Safe approved partial edit |
| remove_workflow_node | mutation | Safe approved partial edit |
| move_workflow_node | mutation | Safe approved partial edit |

### Credential Tools (scope: credentials:read/write)

| Tool                     | Type     | Description                       |
|--------------------------|----------|-----------------------------------|
| list_credentials         | query    | Paginated list (values masked)    |
| get_credential           | query    | Single credential (value masked)  |
| create_credential        | mutation | Advanced encrypted secret creation |
| update_credential        | mutation | Update name/type/value            |
| delete_credential        | mutation | Delete by ID                      |
| list_credentials_by_type | query    | Filter by type (OPENAI, SMTP_EMAIL, etc.) |

### Integration Setup Tools (scope: workflows:read/execute, credentials:read, system:read)

| Tool | Type | Description |
|------|------|-------------|
| get_workflow_setup_checklist | query | Missing fields, credentials, webhooks, tests, and effort |
| get_integration_setup_guide | query | Plain-language setup guide for supported services |
| test_credential | query | Validate saved credential without returning secrets |
| test_webhook_setup | mutation | Generate sample Google Form/Stripe payload and optionally run |
| generate_google_form_script | query | Generate Google Apps Script for form webhook |
| get_webhook_url | query | Return Google Form or Stripe workflow webhook URL |

### Execution Tools (scope: executions:read and/or workflows:execute)

| Tool             | Type  | Description                          |
|------------------|-------|--------------------------------------|
| list_executions  | query | Paginated execution history          |
| get_execution    | query | Full details with output & errors    |
| execute_workflow_and_wait | mutation | Run and poll until success/failure/timeout |
| run_workflow_test | mutation | Run with manual, Google Form, or Stripe sample data |
| get_execution_timeline | query | Node-by-node timeline and output summary |
| diagnose_execution | query | Beginner-friendly failure classification |
| suggest_workflow_fix | mutation | Create a repair draft from diagnosis |
| apply_workflow_fix | mutation | Apply an approved repair draft |

### Node Tools (scope: system:read)

| Tool            | Type  | Description                          |
|-----------------|-------|--------------------------------------|
| list_node_types | query | All available node types with metadata|
| search_capabilities | query | Search nodes, credentials, integrations, and templates by plain language |

### System Tools (scope: system:read)

| Tool        | Type  | Description                          |
|-------------|-------|--------------------------------------|
| whoami      | query | Current user info & active scopes    |
| server_info | query | Server version, capabilities         |
| health_check| query | Verify auth, database, and metrics    |
| security_status | query | Security posture and hardening status |
| list_mcp_audit_events | query | Recent persisted MCP audit events |

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
| a8n://catalog/nodes          | Machine-readable node catalog             |
| a8n://catalog/credentials    | Machine-readable credential catalog       |
| a8n://integrations/{service}/setup | Setup guides for supported integrations |
| a8n://apps/catalog           | App-style resource catalog with fallbacks  |

## Resource Templates

| Template                     | Description                              |
|------------------------------|------------------------------------------|
| a8n://integrations/{service}/setup | Supports completion for supported integration services |
| a8n://apps/workflow-drafts/{draftId}/preview | HTML and markdown workflow draft preview |
| a8n://apps/workflows/{workflowId}/setup-checklist | HTML and markdown setup checklist |
| a8n://apps/executions/{executionId}/timeline | HTML and markdown execution timeline |
| a8n://apps/workflow-drafts/{draftId}/approval | Approval preview and confirmation hash |

## Common Workflows

### Create and execute a simple workflow
1. \`plan_workflow_from_goal\` -> break down the goal
2. \`create_workflow_draft\` -> create a safe draft
3. \`answer_workflow_draft_questions\` -> fill non-sensitive missing fields
4. \`validate_workflow_draft\` -> check graph and credentials
5. \`explain_workflow\` + \`preview_workflow_diff\` -> show the user what will happen
6. \`apply_workflow_draft\` -> save after explicit approval
7. \`get_workflow_setup_checklist\` -> guide credentials and webhooks
8. \`test_credential\` and \`test_webhook_setup\` -> verify setup safely
9. \`run_workflow_test\` or \`execute_workflow_and_wait\` -> trigger and monitor
10. \`diagnose_execution\` -> explain failures and suggest repair

### Set up an AI integration
1. \`get_integration_setup_guide\` for OPENAI/ANTHROPIC/GEMINI/SMTP_EMAIL/GOOGLE_SHEETS
2. Use the dashboard or secure setup UI for secrets when possible
3. \`test_credential\` to verify the saved connection
4. \`get_workflow_setup_checklist\` before running
5. \`execute_workflow_and_wait\` or \`run_workflow_test\` to test
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
