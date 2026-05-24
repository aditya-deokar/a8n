# a8n MCP Server — Client Configuration Guide

> **This document has moved.** See the MCP documentation hub for up-to-date guides.

---

## New location

| Topic | Document |
|---|---|
| **Full MCP documentation** | [mcp/README.md](./mcp/README.md) |
| **Client setup (Cursor, Claude, Inspector)** | [mcp/10-operations.md](./mcp/10-operations.md) |
| **Security & API keys** | [mcp/05-security-and-auth.md](./mcp/05-security-and-auth.md) |
| **All tools reference** | [mcp/06-tools-reference.md](./mcp/06-tools-reference.md) |

---

## Quick link

**Endpoint:** `POST http://localhost:3000/api/mcp` (Streamable HTTP)

**Cursor config** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "a8n": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer a8n_mcp_<your-api-key>"
      }
    }
  }
}
```

Create an API key at [http://localhost:3000/mcp](http://localhost:3000/mcp) or run `npx tsx scripts/mcp-seed-key.ts`.
