# Phase 0 and 1 Runbook

This runbook covers the implemented Phase 0 and Phase 1 artifacts.

## What is implemented

### Phase 0: baseline audit and requirements lock

Implemented:

- Current MCP implementation audit.
- ChatGPT Apps compatibility gap matrix.
- Phase-wise implementation plan.
- App surface and UX plan.
- Auth, security, testing, and submission checklist.
- MCP docs hub link to `docs/mcp/mcp-apps/`.

Primary docs:

- `docs/mcp/mcp-apps/README.md`
- `docs/mcp/mcp-apps/00-current-state-audit.md`
- `docs/mcp/mcp-apps/01-phase-wise-implementation-plan.md`
- `docs/mcp/mcp-apps/02-app-surface-and-ux.md`
- `docs/mcp/mcp-apps/03-auth-security-submission-checklist.md`

### Phase 1: private developer-mode MCP connection

Implemented:

- Package script to create a dev MCP API key:

  ```txt
  pnpm mcp:seed-key
  ```

- Package script to run a ChatGPT Apps Phase 1 readiness check:

  ```txt
  pnpm mcp:chatgpt:check
  ```

- Readiness checker:

  ```txt
  scripts/mcp-chatgpt-phase1-check.ts
  ```

The checker uses the official MCP Streamable HTTP client transport and verifies:

1. MCP endpoint is reachable.
2. Bearer authentication works.
3. MCP initialize succeeds.
4. Tool discovery includes the Phase 1 tools.
5. Basic read-only tool calls work:
   - `server_info`
   - `whoami`
   - `list_node_types`
   - `list_workflows`

## Local Phase 1 test

Use this when testing the MCP route locally before exposing it to ChatGPT.

### 1. Start the app

```powershell
pnpm dev
```

### 2. Create a development MCP key

In another terminal:

```powershell
pnpm mcp:seed-key
```

Copy the generated `a8n_mcp_...` key.

### 3. Run readiness check against localhost

```powershell
$env:MCP_CHATGPT_DEV_URL="http://localhost:3000/api/mcp"
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_your_key_here"
pnpm mcp:chatgpt:check
```

Expected result:

```txt
Result: PASS
```

Optional JSON output:

```powershell
pnpm mcp:chatgpt:check -- --json
```

Only verify tool discovery without calling tools:

```powershell
pnpm mcp:chatgpt:check -- --skip-calls
```

## ChatGPT developer-mode test with HTTPS

ChatGPT needs a public HTTPS URL. For Phase 1, use ngrok or another tunnel.

### 1. Start the app

```powershell
pnpm dev
```

### 2. Start ngrok tunnel

In another terminal:

```powershell
pnpm demo:ngrok
```

This updates `.env` with:

```txt
NGROK_URL=https://<your-subdomain>.ngrok.app
NEXT_PUBLIC_WEBHOOK_BASE_URL=https://<your-subdomain>.ngrok.app
```

Keep this process running.

### 3. Run readiness check against ngrok

In a third terminal:

```powershell
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_your_key_here"
pnpm mcp:chatgpt:check
```

The script will use:

```txt
NGROK_URL + /api/mcp
```

unless `MCP_CHATGPT_DEV_URL` is explicitly set.

To set it explicitly:

```powershell
$env:MCP_CHATGPT_DEV_URL="https://<your-subdomain>.ngrok.app/api/mcp"
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_your_key_here"
pnpm mcp:chatgpt:check
```

## Create the ChatGPT developer-mode connector

After the readiness check passes:

1. Open ChatGPT.
2. Go to Settings.
3. Open Apps & Connectors.
4. Enable Developer Mode from Advanced settings if available.
5. Click Create.
6. Use this metadata:

   ```txt
   Connector name: a8n
   Description: Build, inspect, execute, and debug a8n workflow automations from ChatGPT.
   Connector URL: https://<your-subdomain>.ngrok.app/api/mcp
   ```

7. If ChatGPT asks for authentication, use the generated MCP bearer key if the developer-mode connector supports manual bearer/token auth.

Phase 4 will replace manual key-based connection with OAuth 2.1 account linking.

## Test prompts

Use these in a new ChatGPT conversation after adding the connector:

```txt
@a8n What workflows do I have?
```

```txt
@a8n What nodes can I use to summarize a form response and send a Slack message?
```

```txt
@a8n Show server info for my a8n MCP connection.
```

## Troubleshooting

### Missing token

Error:

```txt
Missing MCP bearer token.
```

Fix:

```powershell
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_your_key_here"
```

### 401 Unauthorized

Likely causes:

- Wrong API key.
- API key revoked.
- API key expired.
- Header not being sent.

Fix:

```powershell
pnpm mcp:seed-key
```

Then rerun the check with the new key.

### Missing required tools

If the readiness check reports missing tools, confirm:

- `registerSystemTools` is called by `registerAllTools`.
- `registerNodeTools` is called by `registerAllTools`.
- `registerWorkflowTools` is called by `registerAllTools`.
- The server restarted after code changes.

### Database errors

`list_workflows` needs database access. Confirm:

- `.env` has a valid database URL.
- Prisma generated successfully.
- At least one user exists if using `mcp:seed-key`.

### ChatGPT cannot connect to localhost

ChatGPT cannot reach `http://localhost:3000/api/mcp`.

Use:

```powershell
pnpm demo:ngrok
```

Then use:

```txt
https://<your-subdomain>.ngrok.app/api/mcp
```

### CORS or origin failure

For local Phase 1, permissive CORS is acceptable:

```txt
MCP_CORS_ORIGINS=*
```

For production, replace wildcard CORS with exact ChatGPT/OpenAI origins during later phases.

## Phase 1 acceptance checklist

- [ ] `pnpm dev` starts the app.
- [ ] `pnpm mcp:seed-key` creates a development key.
- [ ] `pnpm mcp:chatgpt:check` passes locally.
- [ ] `pnpm demo:ngrok` exposes the app over HTTPS.
- [ ] `pnpm mcp:chatgpt:check` passes through the HTTPS tunnel.
- [ ] ChatGPT developer mode can create a connector using the tunnel URL.
- [ ] ChatGPT can list tools.
- [ ] ChatGPT can call basic read-only tools.

