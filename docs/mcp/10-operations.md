# MCP Operations Guide

> **Audience:** Developers deploying and connecting MCP clients  
> **Prerequisites:** [03 — Transports](./03-transports.md), [05 — Security & Auth](./05-security-and-auth.md)  
> **Last Updated:** June 24, 2026

---

## What you'll learn

- Local development setup
- Client configuration for Cursor, Claude, and Inspector
- Environment variables
- Evaluation and release verification
- Production deployment checklist
- Troubleshooting common errors

---

## Local development

### Prerequisites

1. Database migrated: `npx prisma db push`
2. Dev server running: `pnpm dev` → `http://localhost:3000`
3. API key created (see below)

### Create a dev API key

**Option A — Seed script:**

```bash
npx tsx scripts/mcp-seed-key.ts
```

Creates `dev-inspector-key` with `["*"]` scope for the first database user.

**Option B — Dashboard:**

Open [http://localhost:3000/mcp](http://localhost:3000/mcp) and create a key via the UI.

**Option C — MCP tool (requires existing auth):**

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_api_key",
      "arguments": { "name": "my-client-key", "scopes": ["*"] }
    },
    "id": 1
  }'
```

Save the returned `rawKey` — it is shown only once.

### Verify connection

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer a8n_mcp_<your-key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": { "name": "health_check", "arguments": {} },
    "id": 1
  }'
```

---

## Client configurations

### Cursor (native Streamable HTTP)

Create `.cursor/mcp.json` in your project root:

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

### Claude Desktop (via mcp-remote)

Edit `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "a8n": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer a8n_mcp_<your-api-key>"
      }
    }
  }
}
```

### Antigravity (Google Gemini)

Create `.gemini/settings.json`:

```json
{
  "mcpServers": {
    "a8n": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer a8n_mcp_<your-api-key>"
      }
    }
  }
}
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI:

| Field | Value |
|---|---|
| Transport | Streamable HTTP |
| URL | `http://localhost:3000/api/mcp` |
| Headers | `Authorization: Bearer a8n_mcp_<your-api-key>` |

---

## Evaluation And Release Verification

Run the local MCP quality gate before merging major MCP changes:

```bash
npm run eval:mcp
```

Current expected baseline:

```text
Cases: 50/50 passed (100%)
Average score: 0.996
Catalog: ok
Redaction: ok
```

Recommended release checks:

```bash
npm run eval:mcp
npx prisma validate
npx tsc --noEmit --pretty false
```

See [13 — Evaluation And Rollout](./13-evaluation-and-rollout.md) for the full Phase 8 gate, limitations, and rollout checklist.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_AUDIT_LOG_ENABLED` | No | `true` | Set to `"false"` to disable console audit lines |
| `MCP_AUDIT_DB_ENABLED` | No | `true` | Set to `"false"` to disable persisted `mcp_audit_log` writes |
| `MCP_API_KEY_HMAC_SECRET` | Recommended | unset | Adds a server-side HMAC secret for newly created API key hashes |
| `MCP_CORS_ORIGINS` | No | `"*"` | Comma-separated allowed origins for browser-capable MCP clients |
| `A8N_WEBHOOK_SHARED_SECRET` | Recommended | unset | Shared secret accepted by Google Form and Stripe webhook endpoints |
| `GOOGLE_FORM_WEBHOOK_SECRET` | No | unset | Google Form-specific shared secret |
| `STRIPE_WEBHOOK_SECRET` | Recommended for Stripe | unset | Stripe signing secret for standard `stripe-signature` verification |
| `STRIPE_WEBHOOK_SHARED_SECRET` | No | unset | Stripe-specific shared secret fallback when no Stripe signing secret is set |
| `NODE_ENV` | No | — | Affects error message verbosity |

### Planned (not implemented)

| Variable | Purpose |
|---|---|
| `MCP_SERVER_ENABLED` | Feature flag to disable MCP endpoint |
| `MCP_RATE_LIMIT_ENABLED` | Toggle rate limiting |

See [CONFIGURATION.md](../CONFIGURATION.md) for full app environment reference.

---

## Production deployment

### Endpoint URL

```
https://your-app.vercel.app/api/mcp
```

Replace `localhost:3000` in all client configs with your production origin.

### Checklist

- [ ] HTTPS enabled (TLS certificates)
- [ ] Scoped API keys (no `*` wildcard for automation)
- [ ] Key expiration set (`expiresInDays`)
- [ ] `ENCRYPTION_KEY` set and backed up securely
- [ ] Audit logging enabled (`MCP_AUDIT_LOG_ENABLED` not `false`)
- [ ] Database audit persistence enabled and migration applied (`MCP_AUDIT_DB_ENABLED` not `false`)
- [ ] `MCP_API_KEY_HMAC_SECRET` set before issuing production API keys
- [ ] Webhook secrets configured (`STRIPE_WEBHOOK_SECRET`, `GOOGLE_FORM_WEBHOOK_SECRET`, or `A8N_WEBHOOK_SHARED_SECRET`)
- [ ] Rate limits appropriate for expected traffic
- [ ] Log aggregation configured for `[MCP:*]` console output
- [ ] Keys rotated on schedule; revoked keys audited

### Security recommendations

- Never commit API keys to git
- Use separate keys per client (Cursor, CI, staging)
- Prefer read-only scopes for monitoring clients
- Monitor `server_info` metrics for unusual `topTools` patterns

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Missing Authorization header` | No Bearer token | Add `Authorization: Bearer a8n_mcp_...` |
| `401 Invalid or expired API key` | Wrong/revoked/expired key | Create new key at `/mcp` |
| `429 Rate limit exceeded` | Too many requests | Wait for `Retry-After`; reduce call frequency |
| `Permission denied: requires "X" scope` | Key lacks scope | Create key with required scope or `*` |
| Connection refused | Dev server not running | `pnpm dev` |
| Tools return permission errors after 401 passes | API key lacks the tool scope | Create a key with the required scope or use a session token while debugging |
| CORS error in browser | Origin not allowed | Add the client origin to `MCP_CORS_ORIGINS` |
| Empty workflow after update | Malformed nodes/edges | Read `a8n://schema/workflow` resource first |

### Debug with server_info

```json
{ "name": "server_info", "arguments": {} }
```

Returns live metrics: `totalRequests`, `errorCount`, `topTools`, rate limit config.

---

## Rate limit headers

Successful responses include:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per 60s window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Ms until window resets |

---

## Next steps

- [05 — Security & Auth](./05-security-and-auth.md)
- [06 — Tools Reference](./06-tools-reference.md)
- [MCP documentation hub](./README.md)

---

<div align="center">
  <sub>Part of the a8n MCP documentation series</sub>
</div>
