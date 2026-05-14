# n8n MCP Server — Client Configuration Guide

> Connect your n8n MCP server to AI-powered coding assistants and automation clients.

---

## Prerequisites

1. **Start the dev server**: `pnpm run dev` (runs on `http://localhost:3000`)
2. **Create an API key**: Use the n8n dashboard or call the `create_api_key` MCP tool
3. **Run the DB migration**: `npx prisma db push` (if not already done)

---

## Quick Start — API Key Creation

Before connecting any client, you need an API key. If you have session auth, you can create one via the MCP server:

```bash
# Using curl to create an API key via the MCP endpoint
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-session-token>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_api_key",
      "arguments": {
        "name": "my-client-key",
        "scopes": ["*"]
      }
    },
    "id": 1
  }'
```

**Save the returned `rawKey`** — it's only shown once!

---

## Client Configurations

### Antigravity (Google Gemini)

Create `.gemini/settings.json` in your project root:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer n8n_mcp_<your-api-key>"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "n8n": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer n8n_mcp_<your-api-key>"
      }
    }
  }
}
```

### Claude Code (Claude Desktop)

Edit `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer n8n_mcp_<your-api-key>"
      }
    }
  }
}
```

### MCP Inspector (Debugging)

```bash
npx @modelcontextprotocol/inspector
```

Then in the Inspector UI:
- **Transport**: Streamable HTTP
- **URL**: `http://localhost:3000/api/mcp`
- **Headers**: `Authorization: Bearer n8n_mcp_<your-api-key>`

---

## Available Capabilities

| Type       | Count | Description                               |
|------------|-------|-------------------------------------------|
| **Tools**  | 22    | Workflows, credentials, executions, etc.  |
| **Resources** | 4  | Schema references and API docs             |
| **Prompts** | 3   | Guided workflow creation and debugging     |

### Tool Summary

| Tool                     | Scope              | Description                        |
|--------------------------|--------------------|------------------------------------|
| `list_workflows`         | workflows:read     | Paginated workflow listing          |
| `get_workflow`           | workflows:read     | Full workflow with nodes & edges    |
| `create_workflow`        | workflows:write    | Create a new workflow               |
| `update_workflow`        | workflows:write    | Replace nodes & connections          |
| `rename_workflow`        | workflows:write    | Rename a workflow                   |
| `delete_workflow`        | workflows:write    | Permanently delete                  |
| `execute_workflow`       | workflows:execute  | Trigger async execution             |
| `list_credentials`       | credentials:read   | List credentials (values masked)    |
| `get_credential`         | credentials:read   | Single credential metadata          |
| `create_credential`      | credentials:write  | Create with encrypted value         |
| `update_credential`      | credentials:write  | Update credential                   |
| `delete_credential`      | credentials:write  | Delete credential                   |
| `list_credentials_by_type`| credentials:read  | Filter by type                      |
| `list_executions`        | executions:read    | Execution history                   |
| `get_execution`          | executions:read    | Full execution details              |
| `list_node_types`        | system:read        | Available node types                |
| `whoami`                 | system:read        | Current user info                   |
| `server_info`            | system:read        | Server info + metrics               |
| `health_check`           | system:read        | System health verification          |
| `create_api_key`         | api_keys:manage    | Generate new API key                |
| `list_api_keys`          | api_keys:manage    | List active keys                    |
| `revoke_api_key`         | api_keys:manage    | Revoke an API key                   |

---

## API Key Scopes

When creating an API key, you can scope it to specific permissions:

| Scope              | Grants Access To                          |
|--------------------|-------------------------------------------|
| `workflows:read`   | list_workflows, get_workflow              |
| `workflows:write`  | create, update, rename, delete workflow   |
| `workflows:execute`| execute_workflow                          |
| `credentials:read` | list/get credentials (values never shown) |
| `credentials:write`| create, update, delete credentials        |
| `executions:read`  | list/get executions                       |
| `system:read`      | whoami, server_info, health_check, list_node_types |
| `api_keys:manage`  | create, list, revoke API keys             |
| `*`                | Full access (all of the above)            |

**Example — read-only key:**
```json
{ "name": "read-only", "scopes": ["workflows:read", "credentials:read", "executions:read", "system:read"] }
```

**Example — full access key:**
```json
{ "name": "admin", "scopes": ["*"] }
```

---

## Production Deployment

Replace `localhost:3000` with your deployed URL:

```
https://your-n8n-app.vercel.app/api/mcp
```

### Security Recommendations

- ✅ Use scoped API keys (never `*` in production)
- ✅ Set key expiration (`expiresInDays`)
- ✅ Rotate keys regularly
- ✅ Monitor audit logs
- ✅ Restrict CORS origins (`MCP_CORS_ORIGINS` in `.env`)
- ✅ Enable rate limiting (enabled by default)
