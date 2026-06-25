# End-To-End Test Guide

This guide tests the complete a8n ChatGPT app setup from local development to production submission readiness.

## 1. Prepare The Database

Run Prisma generation:

```powershell
node_modules\.bin\prisma.CMD generate
```

Apply migrations in your normal environment:

```powershell
node_modules\.bin\prisma.CMD migrate dev
```

For production, use your deployment migration flow instead of `migrate dev`.

## 2. Configure Local Environment

Minimum local env for rehearsal:

```powershell
$env:APP_URL="http://localhost:3000"
$env:NEXT_PUBLIC_APP_URL="http://localhost:3000"
$env:NEXT_PUBLIC_WEBHOOK_BASE_URL="http://localhost:3000"
$env:MCP_CORS_ORIGINS="https://chatgpt.com,https://chat.openai.com"
$env:MCP_AUDIT_LOG_ENABLED="true"
$env:MCP_AUDIT_DB_ENABLED="true"
$env:MCP_API_KEY_HMAC_SECRET="local-dev-secret-with-at-least-32-chars"
$env:MCP_OAUTH_ISSUER="http://localhost:3000"
$env:MCP_OAUTH_RESOURCE="http://localhost:3000"
$env:MCP_OAUTH_REDIRECT_URIS="https://chatgpt.com/connector/oauth/dev-callback"
$env:MCP_OAUTH_TOKEN_HMAC_SECRET="local-oauth-secret-with-at-least-32-chars"
```

Start the app:

```powershell
pnpm dev
```

## 3. Run Offline Gates

In a separate terminal:

```powershell
pnpm mcp:safety:check
pnpm mcp:chatgpt:app-eval
pnpm mcp:chatgpt:full-check
pnpm mcp:production:check -- --allow-dev-hosts
pnpm mcp:submission:check -- --allow-dev-hosts --allow-missing-evidence
pnpm mcp:rollout:check
pnpm mcp:chatgpt:release-check -- --allow-dev-hosts --allow-missing-evidence
```

Expected result: every command prints `PASS`.

## 4. Create A Test MCP Token

Seed or create a scoped MCP key:

```powershell
pnpm mcp:seed-key
```

Set the returned token:

```powershell
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_..."
```

## 5. Test Local MCP Endpoint

Use the ChatGPT profile endpoint:

```powershell
$env:MCP_CHATGPT_DEV_URL="http://localhost:3000/api/mcp?profile=chatgpt"
pnpm mcp:chatgpt:check
```

Expected:

- MCP initializes.
- Required ChatGPT tools are present.
- Forbidden admin/destructive tools are absent.
- Widget resources can be listed and read.
- Read-only smoke tool calls pass.

## 6. Test OAuth Metadata Locally

```powershell
$env:MCP_CHATGPT_DEV_URL="http://localhost:3000/api/mcp?profile=chatgpt"
pnpm mcp:chatgpt:oauth-check
```

Expected:

- Protected resource metadata exists.
- Authorization server metadata exists.
- OpenID configuration exists.
- JWKS endpoint exists.
- Unauthenticated MCP requests return a `WWW-Authenticate` OAuth challenge.

## 7. Expose A Public HTTPS Dev URL

ChatGPT developer mode needs HTTPS. Use your preferred tunnel, then set:

```powershell
$env:APP_URL="https://<tunnel-domain>"
$env:NEXT_PUBLIC_APP_URL="https://<tunnel-domain>"
$env:NEXT_PUBLIC_WEBHOOK_BASE_URL="https://<tunnel-domain>"
$env:MCP_OAUTH_ISSUER="https://<tunnel-domain>"
$env:MCP_OAUTH_RESOURCE="https://<tunnel-domain>"
$env:MCP_CHATGPT_DEV_URL="https://<tunnel-domain>/api/mcp?profile=chatgpt"
```

Restart the app after changing these environment variables.

Run:

```powershell
pnpm mcp:chatgpt:full-check -- --live
```

## 8. Connect In ChatGPT Developer Mode

In ChatGPT:

1. Open Settings.
2. Go to Apps & Connectors.
3. Enable Developer mode from Advanced settings if needed.
4. Create a connector.
5. Use the HTTPS MCP URL:

   ```txt
   https://<domain>/api/mcp?profile=chatgpt
   ```

6. Configure OAuth/account linking when prompted.
7. Connect your a8n account.
8. Start a new chat and enable the a8n connector.

## 9. Run Golden Prompts In ChatGPT

Use:

```txt
docs/mcp/mcp-apps/submission/golden-prompts.md
```

Capture screenshots for:

```txt
01-connector-settings.png
02-oauth-consent.png
03-workflow-draft-preview.png
04-setup-checklist.png
05-approval-widget.png
06-execution-timeline.png
```

Save them in:

```txt
docs/mcp/mcp-apps/evidence/phase-8/
```

## 10. Production Readiness

Set production values:

```powershell
$env:APP_URL="https://<production-domain>"
$env:NEXT_PUBLIC_APP_URL="https://<production-domain>"
$env:NEXT_PUBLIC_WEBHOOK_BASE_URL="https://<production-domain>"
$env:MCP_OAUTH_ISSUER="https://<production-domain>"
$env:MCP_OAUTH_RESOURCE="https://<production-domain>"
$env:MCP_OAUTH_REDIRECT_URIS="https://chatgpt.com/connector/oauth/<callback_id>"
```

Run strict checks:

```powershell
pnpm mcp:production:check
pnpm mcp:submission:check
pnpm mcp:chatgpt:release-check
```

## 11. Submit The App

Use:

```txt
docs/mcp/mcp-apps/submission/app-copy.md
```

Submission checklist:

- OpenAI organization verified.
- App permissions confirmed.
- Production MCP URL reachable.
- OAuth redirect URI allowlisted.
- Privacy/support URLs live.
- Screenshots uploaded.
- Golden prompts and expected behavior included.
- No localhost, tunnel, staging, or placeholder URL remains.

## 12. After Launch

Weekly:

```powershell
pnpm mcp:rollout:check
```

Use:

```txt
docs/mcp/mcp-apps/rollout/weekly-review.md
```

For every production incident:

1. Create a file in `docs/mcp/mcp-apps/rollout/incidents/`.
2. Fix the issue.
3. Add or update a regression eval in `src/mcp/evals/chatgpt-app-goals.ts`.
4. Set `regressionEval` in the incident frontmatter.
5. Run `pnpm mcp:chatgpt:release-check`.

## Troubleshooting

| Symptom | Check |
|---|---|
| ChatGPT cannot connect | Confirm HTTPS URL, CORS origins, and MCP OAuth challenge. |
| OAuth redirect fails | Confirm `MCP_OAUTH_REDIRECT_URIS` exactly matches the ChatGPT callback URL. |
| Tools missing in ChatGPT | Run `pnpm mcp:chatgpt:check` against `?profile=chatgpt`. |
| Widget does not render | Confirm widget resources return `text/html;profile=mcp-app` and CSP metadata. |
| Tool writes without approval | Recheck Phase 5 safety policy and golden approval prompts. |
| Production checker fails | Replace all local/tunnel values with final HTTPS production URLs. |
