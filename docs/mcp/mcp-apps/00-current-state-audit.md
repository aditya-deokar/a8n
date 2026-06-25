# Current MCP Integration Audit

This audit maps the existing a8n MCP implementation to the requirements for a ChatGPT App.

## Executive summary

a8n already has the hard backend foundation:

- MCP server factory.
- Streamable HTTP route.
- Authenticated requests.
- Scoped API keys.
- Domain tools for workflows, credentials, executions, integrations, nodes, system health, security, and API keys.
- Resources and prompts for model guidance.
- App-style resource templates.
- Audit and sanitization.

The main gap is not "add MCP." The gap is "make the existing MCP server ChatGPT Apps-compatible."

That means:

- Add Apps SDK metadata and app resources.
- Curate a smaller app-facing tool surface.
- Add output schemas and annotations consistently.
- Implement OAuth 2.1 user linking for ChatGPT.
- Add protected resource metadata and OAuth metadata endpoints.
- Convert app-style resources into renderable widgets.
- Add CSP and widget domain metadata.
- Prepare developer-mode testing and public app submission artifacts.

## Current implementation map

| Area | Current status | Source |
|---|---|---|
| MCP HTTP route | Implemented at `/api/mcp` with GET, POST, DELETE, OPTIONS | `src/app/api/mcp/route.ts` |
| Transport | `WebStandardStreamableHTTPServerTransport` in stateless mode | `src/app/api/mcp/route.ts` |
| Server factory | Creates `McpServer`, registers tools/resources/prompts | `src/mcp/index.ts` |
| Tools | 53 tools across 7 domains | `src/mcp/tools/_registry.ts` |
| Resources | 17 resources + 5 templates | `src/mcp/resources/_registry.ts` |
| Prompts | 3 prompts | `src/mcp/prompts/_registry.ts` |
| Auth | Bearer token via MCP API key or Better Auth session | `src/mcp/auth/bearer-auth.middleware.ts` |
| Scopes | `workflows:*`, `credentials:*`, `executions:read`, `system:read`, `api_keys:manage`, `*` | `src/mcp/auth/scopes.ts` |
| API keys | Hashed keys with prefix `a8n_mcp_`, revocation, expiration, last-used tracking | `src/mcp/auth/api-key.service.ts` |
| Rate limiting | In-memory sliding window | `src/mcp/middleware/rate-limiter.ts` |
| Audit logging | Request/tool logging with redaction and DB persistence | `src/mcp/middleware/audit-logger.ts` |
| Output sanitization | Redacts credentials, tokens, private keys, secrets | `src/mcp/shared/sanitize.ts` |
| App-style resources | HTML/Markdown resources for preview, checklist, timeline, approval | `src/mcp/resources/app-resources.resource.ts` |

## Compatibility gap matrix

| Requirement | Current state | Gap | Priority |
|---|---|---|---|
| Public MCP endpoint | `/api/mcp` exists and production readiness checker is implemented | Needs final stable HTTPS production deployment, not localhost or temporary tunnel for submission | P0 |
| ChatGPT developer-mode connection | Testable with HTTPS route and Phase 6 full-check runner | Need live ChatGPT developer-mode evidence against final endpoint | P0 |
| OAuth account linking | Implemented for ChatGPT profile | Uses authorization code + PKCE, opaque access/refresh tokens, and existing Better Auth sign-in | P0 |
| Protected resource metadata | Implemented | `/.well-known/oauth-protected-resource` plus MCP challenge header | P0 |
| OAuth discovery metadata | Implemented | `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` | P0 |
| Tool curation | 53 tools exposed | Too broad for ChatGPT discovery; define app-facing tools and hide/limit advanced/admin tools | P0 |
| Tool annotations | Partial | Add read/write/destructive/idempotent hints where supported | P1 |
| Output schemas | Partial | App-facing tools should declare `outputSchema` for predictable follow-up calls | P1 |
| Tool result structure | `structuredContent` exists through `mcpJsonResponse` | Need ensure app-facing tools keep sensitive data out of `structuredContent` and move UI-only data to `_meta` | P1 |
| Render tools | Not implemented as Apps SDK render tools | Need tools with `_meta.ui.resourceUri` and ChatGPT-compatible output templates | P1 |
| Widget resources | Plain HTML resources exist | Need `text/html;profile=mcp-app`, CSP, domain, widget description, and Apps bridge compatibility | P1 |
| Widget CSP | Implemented through widget resource metadata derived from `NEXT_PUBLIC_APP_URL` | Confirm exact production domain before submission | P1 |
| `window.openai` bridge | Not implemented | Needed for interactive widgets that call tools from UI | P2 |
| App metadata | Centralized in `src/mcp/apps/submission-assets.ts`; `/privacy`, `/support`, app icon, prompts, and copy exist | Need final production-domain values and screenshots | P1 |
| Security review readiness | Improved backend base | OAuth scopes, consent copy, destructive action policy, and safety metadata are implemented; retention policy still needs production decision | P1 |
| Testing | MCP eval script, ChatGPT app evals, full-check runner, safety checks, and live OAuth/tool checks exist | Need MCP Inspector and ChatGPT developer-mode screenshots | P1 |
| Public submission | Submission preflight and asset package exist | Need OpenAI org verification, Dashboard app draft, production review MCP URL, and uploaded screenshots | P2 |

## What can be reused directly

### MCP server route

The existing route can remain the primary server entry point:

```txt
POST /api/mcp
GET /api/mcp
DELETE /api/mcp
OPTIONS /api/mcp
```

For ChatGPT Apps, keep the route but add:

- OAuth-aware auth middleware.
- `WWW-Authenticate` challenges with `resource_metadata`.
- More restrictive CORS for production.
- Public HTTPS deployment.

### Workflow tools

The workflow tool set is strong. The app should not expose all tools equally to ChatGPT at first.

Recommended app-facing subset:

| Use case | Existing tools |
|---|---|
| Discover workflows | `list_workflows`, `get_workflow`, `explain_workflow` |
| Create workflow safely | `plan_workflow_from_goal`, `create_workflow_draft`, `answer_workflow_draft_questions`, `validate_workflow_draft`, `preview_workflow_diff`, `apply_workflow_draft` |
| Edit workflow safely | `add_workflow_node`, `update_node_config`, `connect_workflow_nodes`, `disconnect_workflow_nodes`, `move_workflow_node`, `remove_workflow_node` |
| Execute workflow | `execute_workflow_and_wait`, `run_workflow_test`, `get_execution_timeline` |
| Debug workflow | `diagnose_execution`, `suggest_workflow_fix`, `apply_workflow_fix` |
| Setup integrations | `get_integration_setup_guide`, `get_workflow_setup_checklist`, `test_credential`, `test_webhook_setup` |
| Capability discovery | `list_node_types`, `search_capabilities` |

### Existing approval model

a8n already has confirmation-hash patterns for applying drafts and fixes. This maps well to ChatGPT Apps because write actions and important actions may require confirmation.

Keep this pattern:

```json
{
  "approvalRequired": true,
  "confirmationHash": "...",
  "instruction": "Call again with approved: true and confirmationHash after user approval."
}
```

For ChatGPT Apps, also make the tool descriptions and annotations clear enough that ChatGPT knows these are write or important actions.

### Existing app resources

These current resources are valuable:

- `a8n://apps/workflow-drafts/{draftId}/preview`
- `a8n://apps/workflows/{workflowId}/setup-checklist`
- `a8n://apps/executions/{executionId}/timeline`
- `a8n://apps/workflow-drafts/{draftId}/approval`

But they should be converted into Apps SDK widgets.

Current limitation:

```txt
mimeType: text/html
```

Target:

```txt
mimeType: text/html;profile=mcp-app
```

And each widget should include:

- `_meta.ui.csp`
- `_meta.ui.domain`
- `_meta.ui.prefersBorder`
- `_meta["openai/widgetDescription"]`

## Current risks

### Risk 1: API key auth is not enough for public ChatGPT Apps

API keys work for MCP clients like Cursor or Claude Code, but public ChatGPT Apps should support user account linking through OAuth 2.1.

Decision:

- Keep API keys for developer/testing and non-ChatGPT MCP clients.
- Add OAuth for ChatGPT Apps.

### Risk 2: too many tools reduce discovery quality

The current 53-tool surface is powerful but broad. ChatGPT tool discovery works best when tools are focused and well-described.

Decision:

- Create a ChatGPT app tool profile.
- Expose a curated set first.
- Keep advanced/admin tools available for direct MCP clients but not default ChatGPT usage.

### Risk 3: write actions can cause external side effects

Executing workflows may send email, Slack messages, Discord messages, HTTP requests, or append Google Sheets rows.

Decision:

- Mark execution and mutation tools as write/important actions.
- Require explicit approval for workflow execution tests and destructive edits.
- Preserve confirmation hashes for workflow graph changes.

### Risk 4: widget data can leak sensitive content if misused

Apps SDK distinguishes:

- `structuredContent`: visible to the model and widget.
- `content`: visible to the model and transcript.
- `_meta`: visible only to the widget.

Decision:

- Keep secrets out of all three.
- Keep large UI-only maps in `_meta`.
- Keep `structuredContent` concise and schema-backed.

## Readiness score

| Category | Score | Reason |
|---|---:|---|
| MCP protocol foundation | 8/10 | Strong Streamable HTTP implementation already exists |
| Tool coverage | 9/10 | Rich workflow platform operations already exposed |
| ChatGPT Apps compatibility | 3/10 | Needs metadata, widgets, OAuth, CSP, submission prep |
| Security foundation | 7/10 | Good scopes/audit/sanitization; OAuth and production policies missing |
| User experience | 4/10 | Existing resources help, but ChatGPT widgets and curated tool flows are missing |
| Submission readiness | 2/10 | Needs HTTPS deployment, OAuth, CSP, assets, screenshots, test prompts |

## Recommendation

Proceed with a phased Apps integration:

1. Validate current MCP endpoint in ChatGPT developer mode.
2. Curate the app-facing tool surface.
3. Add Apps SDK widget resources and render tools.
4. Add OAuth 2.1 account linking.
5. Harden safety, privacy, and approval flows.
6. Deploy to production HTTPS.
7. Test with MCP Inspector and ChatGPT.
8. Submit for app review.
