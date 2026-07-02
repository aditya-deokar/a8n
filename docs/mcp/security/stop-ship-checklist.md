# MCP Stop-Ship Checklist

> Scope: `/api/mcp`, `src/mcp`, OAuth, API keys, workflow execution, credentials, webhooks, MCP Apps widgets, and release tooling.

A production release must stop if any item below is true. These are hard gates, not recommendations.

## Data Isolation

- [ ] A token for one user can read another user's workflows, drafts, versions, credentials, executions, audit events, or app resources.
- [ ] Any Prisma query in an MCP handler reads or mutates user-owned data without a `userId` ownership condition or equivalent guard.
- [ ] Any MCP resource template returns data for an object not owned by the authenticated user.

## Secrets and Sensitive Data

- [ ] A credential value, API key, OAuth token, refresh token, private key, bearer token, cookie, webhook secret, or key hash appears in MCP `content`, `structuredContent`, `_meta`, widget HTML, audit logs, screenshots, CI artifacts, or error output.
- [ ] A tool asks a non-technical user to paste API keys, passwords, raw service-account JSON, OAuth tokens, or webhook signing secrets into ordinary chat.
- [ ] A failed provider call logs raw request headers or response bodies containing secrets.

## Authorization and OAuth

- [ ] `/api/mcp` accepts missing, malformed, expired, revoked, wrong-resource, or wrong-client OAuth tokens.
- [ ] OAuth authorization codes can be reused.
- [ ] OAuth token exchange works without PKCE.
- [ ] Production redirect URI validation allows host-only, wildcard, path-prefix, or fuzzy matching.
- [ ] Dynamic client registration is enabled in production without an explicit owner and abuse controls.
- [ ] A tool can run with a token missing its required scope.

## Side Effects and Destructive Actions

- [ ] Any workflow execution path that can send email, post Slack/Discord messages, call HTTP APIs, or write Google Sheets can run without explicit approval.
- [ ] `execute_workflow`, `execute_workflow_and_wait`, `run_workflow_test`, or `test_webhook_setup` bypasses the central side-effect guard.
- [ ] `delete_workflow`, `delete_credential`, version restore, graph replace, or repair apply can mutate data without confirmation.
- [ ] A confirmation hash is not bound to the exact proposed diff/input.
- [ ] A mutation succeeds after validation failed.

## Prompt Injection and Tool Misuse

- [ ] A prompt-injection regression causes an unsafe tool call.
- [ ] Untrusted workflow names, node config, webhook payloads, HTTP responses, form answers, Stripe metadata, or execution output are treated as instructions.
- [ ] Tool output can instruct the model to call admin/destructive tools without safety metadata or blocking.
- [ ] Tool descriptions or resource content can silently change risk semantics without contract review.
- [ ] ChatGPT profile exposes forbidden tools such as raw credential mutation, API key management, audit/security admin tools, or destructive workflow deletion.

## Network and Webhook Safety

- [ ] Production webhook endpoints accept unsigned traffic when signing/shared secrets are required.
- [ ] HTTP/API tooling can access loopback, private IP ranges, link-local/cloud metadata endpoints, or unsupported URL schemes.
- [ ] Redirects from outbound HTTP calls are followed without validating every hop.
- [ ] Credential live tests can call arbitrary endpoints outside approved providers.

## Production Configuration

- [ ] `MCP_CORS_ORIGINS=*` is used in production.
- [ ] Widget CSP permits broad or unnecessary domains.
- [ ] Audit persistence is disabled in production.
- [ ] Rate limiting is in-memory for a multi-instance production deployment.
- [ ] Typecheck, Prisma validation, MCP offline evals, safety checks, and MCP tests are not run before release.

## Incident Closure

- [ ] A production incident is closed without a regression test or eval ID.
- [ ] A security fix changes tool behavior without updating the threat model, contract manifest, or release evidence.
