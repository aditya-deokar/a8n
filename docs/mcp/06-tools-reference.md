# MCP Tools Reference

> **Audience:** AI client developers and operators invoking MCP tools  
> **Prerequisites:** [02 — Protocol Deep Dive](./02-protocol-deep-dive.md), [05 — Security & Auth](./05-security-and-auth.md)  
> **Last Updated:** May 2026

---

## What you'll learn

- Complete catalog of all 22 MCP tools
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

Results are returned as MCP text content containing JSON strings.

---

## Scope quick reference

| Scope | Tools |
|---|---|
| `workflows:read` | `list_workflows`, `get_workflow` |
| `workflows:write` | `create_workflow`, `update_workflow`, `rename_workflow`, `delete_workflow` |
| `workflows:execute` | `execute_workflow` |
| `credentials:read` | `list_credentials`, `get_credential`, `list_credentials_by_type` |
| `credentials:write` | `create_credential`, `update_credential`, `delete_credential` |
| `executions:read` | `list_executions`, `get_execution` |
| `system:read` | `whoami`, `server_info`, `health_check`, `list_node_types` |
| `api_keys:manage` | `create_api_key`, `list_api_keys`, `revoke_api_key` |
| `*` | All of the above |

---

## Workflow tools (7)

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

Creates a workflow with an `INITIAL` node at position (0, 0).

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

Triggers async execution via Inngest. Poll with `list_executions` or `get_execution`.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Workflow ID |

**Response:** `{ message, workflowId, workflowName }`

```json
{ "name": "execute_workflow", "arguments": { "id": "<workflow-id>" } }
```

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

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Human-readable label |
| `type` | enum | `OPENAI`, `ANTHROPIC`, or `GEMINI` |
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
| `type` | enum | `OPENAI`, `ANTHROPIC`, `GEMINI` |
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
| `type` | enum | `OPENAI`, `ANTHROPIC`, `GEMINI` |

**Response:** `{ credentials: [...], count }`

---

## Execution tools (2)

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

## Node tools (1)

### list_node_types

**Scope:** `system:read`

No parameters. Returns all 10 node types with metadata (category, description, required fields).

---

## System tools (3)

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

1. `create_workflow` → get `id`
2. `list_node_types` → understand available nodes
3. `list_credentials_by_type` → find or `create_credential`
4. `update_workflow` → set nodes and edges
5. `execute_workflow` → trigger run
6. `get_execution` → check result

### Read-only audit

1. `whoami` → confirm identity and scopes
2. `list_workflows` → enumerate workflows
3. `list_executions` → recent runs

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
