# MCP Tools Reference

> **Audience:** AI client developers and operators invoking MCP tools  
> **Prerequisites:** [02 — Protocol Deep Dive](./02-protocol-deep-dive.md), [05 — Security & Auth](./05-security-and-auth.md)  
> **Last Updated:** June 24, 2026

---

## What you'll learn

- Complete catalog of all 53 MCP tools
- Required scopes, inputs, and response shapes
- Copy-paste `tools/call` examples

---

## Calling tools

All tools are invoked via JSON-RPC `tools/call`:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer a8n_mcp_<your-api-key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "<tool_name>",
      "arguments": { }
    },
    "id": 1
  }'
```

Results are returned as MCP `structuredContent` with a JSON text fallback for older clients.

---

## Scope quick reference

| Scope | Tools |
|---|---|
| `workflows:read` | `list_workflows`, `get_workflow`, `explain_workflow`, `preview_workflow_diff`, `list_workflow_versions`, `get_workflow_setup_checklist`, `generate_google_form_script`, `get_webhook_url` |
| `workflows:write` | `create_workflow`, `update_workflow`, `rename_workflow`, `delete_workflow`, `create_workflow_draft`, `answer_workflow_draft_questions`, `validate_workflow_draft`, `apply_workflow_draft`, `duplicate_workflow`, `rollback_workflow_version`, `add_workflow_node`, `update_node_config`, `connect_workflow_nodes`, `disconnect_workflow_nodes`, `remove_workflow_node`, `move_workflow_node`, `suggest_workflow_fix`, `apply_workflow_fix` |
| `workflows:execute` | `execute_workflow`, `execute_workflow_and_wait`, `run_workflow_test`, `test_webhook_setup` |
| `credentials:read` | `list_credentials`, `get_credential`, `list_credentials_by_type`, `test_credential` |
| `credentials:write` | `create_credential`, `update_credential`, `delete_credential` |
| `executions:read` | `list_executions`, `get_execution`, `execute_workflow_and_wait`, `run_workflow_test` when waiting, `get_execution_timeline`, `diagnose_execution`, `suggest_workflow_fix` |
| `system:read` | `whoami`, `server_info`, `health_check`, `security_status`, `list_mcp_audit_events`, `list_node_types`, `search_capabilities`, `plan_workflow_from_goal`, `get_integration_setup_guide` |
| `api_keys:manage` | `create_api_key`, `list_api_keys`, `revoke_api_key` |
| `*` | All of the above |

---

## Workflow tools (23)

### list_workflows

**Scope:** `workflows:read`

Paginated list of workflows for the authenticated user.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (1-indexed) |
| `pageSize` | number | `10` | Results per page (1–100) |
| `search` | string | `""` | Filter by name (case-insensitive) |

**Response:** `{ workflows: [...], page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage }`

```json
{ "name": "list_workflows", "arguments": { "page": 1, "pageSize": 10, "search": "" } }
```

---

### get_workflow

**Scope:** `workflows:read`

Returns full workflow with React Flow–compatible `nodes` and `edges` arrays.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |

```json
{ "name": "get_workflow", "arguments": { "id": "<workflow-id>" } }
```

---

### create_workflow

**Scope:** `workflows:write`

Creates a workflow with an `INITIAL` node at position (0, 0). Requires an active subscription, matching the app's premium workflow creation route.

| Parameter | Type | Description |
|---|---|---|
| `name` | string (optional) | Custom name; random 3-word slug if omitted |

```json
{ "name": "create_workflow", "arguments": { "name": "My AI Pipeline" } }
```

---

### update_workflow

**Scope:** `workflows:write`

**Full replacement** of all nodes and connections. Read `a8n://schema/workflow` resource before calling.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |
| `nodes` | array | Nodes with `id`, `type`, `position`, optional `data` |
| `edges` | array | Edges with `source`, `target`, optional handles |

```json
{
  "name": "update_workflow",
  "arguments": {
    "id": "<workflow-id>",
    "nodes": [
      { "id": "n1", "type": "MANUAL_TRIGGER", "position": { "x": 0, "y": 0 }, "data": {} },
      { "id": "n2", "type": "OPENAI", "position": { "x": 300, "y": 0 }, "data": { "credentialId": "<cred-id>" } }
    ],
    "edges": [
      { "source": "n1", "target": "n2", "sourceHandle": "main", "targetHandle": "main" }
    ]
  }
}
```

---

### rename_workflow

**Scope:** `workflows:write`

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |
| `name` | string | New name (min 1 char) |

---

### delete_workflow

**Scope:** `workflows:write`

Permanently deletes workflow, nodes, connections, and execution history.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |

---

### execute_workflow

**Scope:** `workflows:execute`

Triggers async execution via Inngest. Returns `inngestEventId` for correlation. Use `execute_workflow_and_wait` for synchronous chat UX or `get_execution_timeline` with `inngestEventId` for follow-up.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |

**Response:** `{ message, workflowId, workflowName, inngestEventId, executionLookup }`

```json
{ "name": "execute_workflow", "arguments": { "id": "<workflow-id>" } }
```

---

### plan_workflow_from_goal

**Scope:** `system:read`

Turns a plain-language goal into beginner-readable steps, required apps, missing questions, risks, setup effort, and a suggested template. Does not mutate data.

| Parameter | Type | Description |
|---|---|---|
| `goal` | string | User's automation goal |
| `audience` | string (optional) | Defaults to beginner |
| `preferredApps` | string[] (optional) | Apps the user prefers |

---

### create_workflow_draft

**Scope:** `workflows:write`

Creates a persisted draft graph from a goal. It does not create or update a real workflow until `apply_workflow_draft` succeeds.

| Parameter | Type | Description |
|---|---|---|
| `goal` | string | User's automation goal |
| `name` | string (optional) | Draft/workflow name |
| `workflowId` | string (optional) | Existing workflow to modify; omitted means new workflow |

---

### answer_workflow_draft_questions

**Scope:** `workflows:write`

Updates a draft with non-sensitive answers. Refuses secret-looking keys such as `password`, `token`, `apiKey`, `value`, and `webhookUrl`.

| Parameter | Type | Description |
|---|---|---|
| `draftId` | string | Draft ID |
| `answers` | object | Field answers using `nodeId.field`, `nodeId: { field }`, or unique field names |

---

### validate_workflow_draft

**Scope:** `workflows:write`

Checks trigger presence, cycles, missing fields, credentials, duplicate result names, dangling edges, unreachable nodes, and side-effect warnings.

---

### explain_workflow

**Scope:** `workflows:read`

Explains a draft or saved workflow in beginner language, including data flow, setup checklist, technical summary, and what happens when it runs.

| Parameter | Type | Description |
|---|---|---|
| `draftId` | string (optional) | Draft to explain |
| `workflowId` | string (optional) | Saved workflow to explain |

---

### preview_workflow_diff

**Scope:** `workflows:read`

Compares a draft to a saved workflow, or to an empty workflow for new drafts. Returns diff, validation, rollback plan, and `confirmationHash`.

---

### apply_workflow_draft

**Scope:** `workflows:write`

Applies a validated draft after explicit approval. Requires `approved: true` and the `confirmationHash` from `preview_workflow_diff` or from the approval-required response.

| Parameter | Type | Description |
|---|---|---|
| `draftId` | string | Draft to apply |
| `workflowId` | string (optional) | Existing workflow target |
| `approved` | boolean | Must be true |
| `confirmationHash` | string | Approval hash |

---

### list_workflow_versions

**Scope:** `workflows:read`

Lists workflow version snapshots created before MCP graph mutations.

---

### duplicate_workflow

**Scope:** `workflows:write`

Creates a copy of a workflow with new node IDs. Requires an active subscription because it creates a workflow.

---

### rollback_workflow_version

**Scope:** `workflows:write`

Restores a workflow from a saved version snapshot. Requires explicit approval and confirmation hash.

---

### Safe partial-edit tools

**Scope:** `workflows:write`

These tools load the current graph, apply one proposed change, validate the whole graph, return a diff and approval hash, and save only when called again with `approved: true` and the matching `confirmationHash`.

| Tool | Purpose |
|---|---|
| `add_workflow_node` | Add one node, optionally connected to neighbors |
| `update_node_config` | Merge or replace one node's config |
| `connect_workflow_nodes` | Add one connection |
| `disconnect_workflow_nodes` | Remove connection(s) between two nodes |
| `remove_workflow_node` | Remove one node and attached edges |
| `move_workflow_node` | Move one node to a new position |

---

## Credential tools (6)

Secret values are **never** returned. Only metadata: `id`, `name`, `type`, `createdAt`, `updatedAt`.

### list_credentials

**Scope:** `credentials:read`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `pageSize` | number | `10` | Results per page |
| `search` | string | `""` | Filter by name |

---

### get_credential

**Scope:** `credentials:read`

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Credential ID |

---

### create_credential

**Scope:** `credentials:write`

Creates a credential with encrypted storage. Requires an active subscription, matching the app's premium credential creation route.

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Human-readable label |
| `type` | enum | `OPENAI`, `ANTHROPIC`, `GEMINI`, `SMTP_EMAIL`, or `GOOGLE_SHEETS` |
| `value` | string | Secret (encrypted at rest) |

```json
{
  "name": "create_credential",
  "arguments": {
    "name": "OpenAI Production",
    "type": "OPENAI",
    "value": "sk-..."
  }
}
```

---

### update_credential

**Scope:** `credentials:write`

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Credential ID |
| `name` | string | New name |
| `type` | enum | `OPENAI`, `ANTHROPIC`, `GEMINI`, `SMTP_EMAIL`, `GOOGLE_SHEETS` |
| `value` | string | New secret (re-encrypted) |

---

### delete_credential

**Scope:** `credentials:write`

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Credential ID |

---

### list_credentials_by_type

**Scope:** `credentials:read`

| Parameter | Type | Description |
|---|---|---|
| `type` | enum | `OPENAI`, `ANTHROPIC`, `GEMINI`, `SMTP_EMAIL`, `GOOGLE_SHEETS` |

**Response:** `{ credentials: [...], count }`

---

## Integration setup tools (6)

These tools are for beginner-friendly setup, readiness checks, webhook testing, and credential validation. They never return credential secrets.

### get_workflow_setup_checklist

**Scope:** `workflows:read`

Returns missing fields, credential checks, webhook URLs, setup steps, test steps, estimated effort, and validation for a saved workflow or draft.

| Parameter | Type | Description |
|---|---|---|
| `workflowId` | string (optional) | Saved workflow ID |
| `draftId` | string (optional) | Workflow draft ID |

---

### get_integration_setup_guide

**Scope:** `system:read`

Returns plain-language setup guidance for supported services: OpenAI, Anthropic, Gemini, Slack, Discord, HTTP APIs, Email/SMTP, Google Sheets, Google Forms, and Stripe.

| Parameter | Type | Description |
|---|---|---|
| `service` | enum | Integration service key |

---

### test_credential

**Scope:** `credentials:read`

Validates a saved credential without returning its secret. Dry-run validates shape; `live: true` verifies provider/SMTP/Google Sheets access where enough test info is supplied.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `credentialId` | string | required | Credential ID |
| `live` | boolean | `false` | Whether to call the provider |
| `spreadsheetId` | string | optional | Google Sheets live test spreadsheet |
| `sheetName` | string | optional | Google Sheets live test sheet |

---

### test_webhook_setup

**Scope:** `workflows:execute`

Generates a Google Form or Stripe sample payload and can trigger the workflow after explicit approval.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `workflowId` | string | required | Saved workflow ID |
| `trigger` | enum | required | `google_form` or `stripe` |
| `approved` | boolean | `false` | Must be true to run the workflow |

---

### generate_google_form_script

**Scope:** `workflows:read`

Generates the Google Apps Script that sends form submissions to the workflow webhook.

| Parameter | Type | Description |
|---|---|---|
| `workflowId` | string | Saved workflow ID |

---

### get_webhook_url

**Scope:** `workflows:read`

Returns the webhook URL for a Google Form or Stripe trigger workflow.

| Parameter | Type | Description |
|---|---|---|
| `workflowId` | string | Saved workflow ID |
| `trigger` | enum | `google_form` or `stripe` |

---

## Execution tools (8)

### list_executions

**Scope:** `executions:read`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `pageSize` | number | `10` | Results per page |

**Response fields per execution:** `id`, `status`, `workflowId`, `workflowName`, `startedAt`, `completedAt`, `error`

---

### get_execution

**Scope:** `executions:read`

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Execution ID |

**Response:** Full details including `output`, `error`, `errorStack`

```json
{ "name": "get_execution", "arguments": { "id": "<execution-id>" } }
```

---

### execute_workflow_and_wait

**Scopes:** `workflows:execute`, `executions:read`

Triggers a workflow, polls by `inngestEventId`, and returns success, failure, timeout, output summary, and a suggested next action.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `workflowId` | string | required | Saved workflow ID |
| `timeoutMs` | number | `30000` | 1,000-120,000 ms |
| `pollMs` | number | `1000` | 250-5,000 ms |
| `initialData` | object | `{}` | Optional starting payload |

---

### run_workflow_test

**Scopes:** `workflows:execute`; `executions:read` when `wait` is true

Runs a workflow with manual, Google Form, or Stripe sample data. Returns an approval-required response until called with `approved: true`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `workflowId` | string | required | Saved workflow ID |
| `trigger` | enum | `manual` | `manual`, `google_form`, or `stripe` |
| `sampleData` | object | optional | Override generated sample input |
| `wait` | boolean | `true` | Poll for result |
| `timeoutMs` | number | `30000` | Wait timeout |
| `approved` | boolean | `false` | Must be true to run |

---

### get_execution_timeline

**Scope:** `executions:read`

Returns a node-by-node timeline with visible config, output summary, duration, and error context. Accepts either execution ID or Inngest event ID.

| Parameter | Type | Description |
|---|---|---|
| `executionId` | string (optional) | Execution ID |
| `inngestEventId` | string (optional) | Inngest event correlation ID |

---

### diagnose_execution

**Scope:** `executions:read`

Classifies failures into beginner-friendly categories such as missing credential, invalid JSON, missing field, HTTP failure, provider API failure, graph error, or timeout.

| Parameter | Type | Description |
|---|---|---|
| `executionId` | string (optional) | Execution ID |
| `inngestEventId` | string (optional) | Inngest event correlation ID |

---

### suggest_workflow_fix

**Scopes:** `workflows:write`, `executions:read`

Creates a repair draft from an execution diagnosis. It does not mutate the live workflow.

| Parameter | Type | Description |
|---|---|---|
| `executionId` | string (optional) | Execution ID |
| `inngestEventId` | string (optional) | Inngest event correlation ID |

---

### apply_workflow_fix

**Scope:** `workflows:write`

Applies a repair draft after validation, explicit approval, and a matching confirmation hash. Creates a version snapshot before replacing the graph.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `draftId` | string | required | Repair draft ID |
| `approved` | boolean | `false` | Must be true to apply |
| `confirmationHash` | string | optional | Hash returned by approval-required response |

---

## Node tools (2)

### list_node_types

**Scope:** `system:read`

No parameters. Returns all 12 node types with metadata: category, beginner description, required fields, credential requirements, outputs, side-effect flag, and risk level.

---

### search_capabilities

**Scope:** `system:read`

Search nodes, credential types, integrations, and workflow templates by plain language.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | `""` | Search text, e.g. `send email`, `save to spreadsheet`, `Stripe alert` |
| `limit` | number | `8` | Max results per category, 1-20 |

---

## System tools (5)

### whoami

**Scope:** `system:read`

No parameters. Returns authenticated user info, auth method, and granted scopes with descriptions.

---

### server_info

**Scope:** `system:read`

No parameters. Returns server name, version, endpoint, rate limit config, available scopes, and live request metrics.

---

### health_check

**Scope:** `system:read`

No parameters. Verifies auth, database connectivity, and metrics subsystem. Use to confirm MCP connection works.

---

### security_status

**Scope:** `system:read`

Returns CORS mode, API-key hashing mode, audit persistence status, webhook verification status, redaction coverage, and remaining production hardening recommendations.

---

### list_mcp_audit_events

**Scope:** `system:read`

Lists recent persisted MCP audit events for the authenticated user when database audit persistence is enabled.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `25` | Max events, 1-100 |
| `tool` | string | optional | Filter by tool name |
| `status` | enum | optional | `success` or `error` |

---

## API key tools (3)

### create_api_key

**Scope:** `api_keys:manage`

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Human-readable label |
| `scopes` | string[] (optional) | Defaults to read-only scopes |
| `expiresInDays` | number (optional) | 1–365 days; omit for no expiry |

**Response includes `rawKey`** — shown only once.

```json
{
  "name": "create_api_key",
  "arguments": {
    "name": "cursor-dev",
    "scopes": ["workflows:read", "workflows:write", "system:read"]
  }
}
```

---

### list_api_keys

**Scope:** `api_keys:manage`

No parameters. Returns masked key previews (`keyPrefix...`), never full keys.

---

### revoke_api_key

**Scope:** `api_keys:manage`

| Parameter | Type | Description |
|---|---|---|
| `keyId` | string | API key ID from `list_api_keys` |

---

## Common workflows

### Create and run a workflow

1. `plan_workflow_from_goal` -> break down the goal
2. `create_workflow_draft` -> create a safe draft
3. `answer_workflow_draft_questions` -> fill non-sensitive missing fields
4. `validate_workflow_draft` -> check graph and credentials
5. `explain_workflow` and `preview_workflow_diff` -> show the user what will happen
6. `apply_workflow_draft` -> save only after explicit approval
7. `get_workflow_setup_checklist` -> guide remaining credentials and webhooks
8. `test_credential` and `test_webhook_setup` -> verify setup safely
9. `run_workflow_test` or `execute_workflow_and_wait` -> trigger and monitor
10. `diagnose_execution` -> explain failures and suggest repair when needed

### Read-only audit

1. `whoami` -> confirm identity and scopes
2. `list_workflows` -> enumerate workflows
3. `get_workflow_setup_checklist` -> inspect readiness
4. `list_executions` and `get_execution_timeline` -> inspect recent runs

---

## Error handling

Tool errors are caught by `withErrorBoundary()` and returned as text content with error messages. Common errors:

| Error | Cause |
|---|---|
| Missing required scope | API key lacks permission |
| Record not found | Invalid ID or wrong user |
| Invalid scope | Bad scope name in `create_api_key` |
| Rate limit exceeded | HTTP 429 before tool runs |

---

## Next steps

- [07 — Resources & Prompts](./07-resources-and-prompts.md)
- [08 — Platform Integration](./08-platform-integration.md)

---

<div align="center">
  <sub>Part of the a8n MCP documentation series</sub>
</div>
