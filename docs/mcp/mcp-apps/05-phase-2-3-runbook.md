# Phase 2 and 3 Runbook

This runbook covers the implemented ChatGPT app profile and widget resources.

## What is implemented

### Phase 2: curated ChatGPT app tool profile

Implemented:

- App profile resolver:

  ```txt
  src/mcp/app-profile.ts
  ```

- Profile-aware server creation:

  ```txt
  src/mcp/index.ts
  ```

- Profile-aware MCP route selection:

  ```txt
  /api/mcp?profile=chatgpt
  ```

- Environment fallback:

  ```txt
  MCP_APP_PROFILE=chatgpt
  ```

- Curated ChatGPT tool registration:

  ```txt
  src/mcp/tools/chatgpt-profile.ts
  ```

The ChatGPT profile registers 28 app-facing tools and excludes admin, raw credential mutation, destructive workflow deletion, and audit/security tools.

### Phase 3: ChatGPT widget resources and render tools

Implemented:

- Static MCP Apps widget resources:

  ```txt
  src/mcp/apps/widget-resources.ts
  ```

- Render tools that link to those widgets:

  ```txt
  src/mcp/apps/render-tools.ts
  ```

- Shared data builders exported from:

  ```txt
  src/mcp/resources/app-resources.resource.ts
  ```

Each render tool returns:

- `structuredContent`: concise model-visible summary.
- `content`: short chat-visible narration.
- `_meta.details`: sanitized widget-only payload.

## ChatGPT profile URL

Use this URL for ChatGPT developer-mode testing:

```txt
https://<public-host>/api/mcp?profile=chatgpt
```

For localhost checks:

```txt
http://localhost:3000/api/mcp?profile=chatgpt
```

You can also set the whole server to ChatGPT profile mode:

```txt
MCP_APP_PROFILE=chatgpt
```

The query parameter is better for development because the default `/api/mcp` endpoint can keep serving the full advanced MCP profile.

## Curated tool profile

The ChatGPT profile includes:

| Category | Tools |
|---|---|
| System | `whoami`, `server_info`, `health_check` |
| Discover | `list_node_types`, `search_capabilities`, `list_workflows`, `get_workflow`, `explain_workflow` |
| Build safely | `plan_workflow_from_goal`, `create_workflow_draft`, `answer_workflow_draft_questions`, `validate_workflow_draft`, `preview_workflow_diff`, `apply_workflow_draft` |
| Setup | `get_workflow_setup_checklist`, `get_integration_setup_guide`, `test_credential`, `test_webhook_setup` |
| Run and debug | `execute_workflow_and_wait`, `run_workflow_test`, `get_execution_timeline`, `diagnose_execution`, `suggest_workflow_fix`, `apply_workflow_fix` |
| Render widgets | `render_workflow_draft_preview`, `render_workflow_setup_checklist`, `render_execution_timeline`, `render_workflow_approval` |

The ChatGPT profile intentionally excludes:

- API key management tools.
- Raw credential create/update/delete tools.
- `delete_workflow`.
- Full graph replacement through `update_workflow`.
- MCP audit and security admin tools.

## Widget resources

Registered widget resources:

```txt
ui://a8n/workflow-draft-preview.html
ui://a8n/workflow-setup-checklist.html
ui://a8n/execution-timeline.html
ui://a8n/workflow-approval.html
```

Each widget resource uses:

```txt
text/html;profile=mcp-app
```

Each widget includes:

- Standard `_meta.ui.resourceUri` linkage from the render tool.
- OpenAI compatibility metadata through `openai/outputTemplate`.
- Widget CSP metadata through `_meta.ui.csp`.
- ChatGPT compatibility CSP through `openai/widgetCSP`.
- Light and dark mode styling.
- Graceful fallback when the `window.openai` bridge has not delivered data yet.

## Local verification

### 1. Start the app

```powershell
pnpm dev
```

### 2. Create or reuse an MCP key

```powershell
pnpm mcp:seed-key
```

### 3. Run the ChatGPT profile check

```powershell
$env:MCP_CHATGPT_DEV_URL="http://localhost:3000/api/mcp?profile=chatgpt"
$env:MCP_CHATGPT_DEV_TOKEN="a8n_mcp_your_key_here"
pnpm mcp:chatgpt:check
```

Expected result:

```txt
Expected profile: chatgpt
Discovered tools: 28
Result: PASS
```

The checker validates:

- Required app-facing tools are present.
- Forbidden admin/destructive tools are absent.
- Widget resources are listed.
- Widget resources can be read.
- Widget MIME type is `text/html;profile=mcp-app`.
- Widget resource `_meta` is present.
- Basic read-only tool calls still work.

## ChatGPT developer-mode connector

Use this connector URL:

```txt
https://<your-subdomain>.ngrok.app/api/mcp?profile=chatgpt
```

Recommended metadata:

```txt
Connector name: a8n
Description: Build, inspect, execute, and debug a8n workflow automations from ChatGPT.
```

Phase 4 will replace manual bearer-key testing with OAuth account linking.

## Test prompts

Use these after adding the connector:

```txt
@a8n List my workflows.
```

```txt
@a8n Create a workflow draft that summarizes Google Form responses and sends a Slack message.
```

```txt
@a8n Show me a visual preview of that workflow draft.
```

```txt
@a8n Show the setup checklist for this workflow.
```

```txt
@a8n Run a sample test and show the execution timeline.
```

## Acceptance checklist

- [ ] `/api/mcp?profile=chatgpt` returns the curated 28-tool profile.
- [ ] Admin, API key, raw credential mutation, and destructive workflow tools are absent.
- [ ] All four render tools are discoverable.
- [ ] All four `ui://a8n/...` widget resources are discoverable and readable.
- [ ] `pnpm mcp:chatgpt:check` passes against localhost.
- [ ] `pnpm mcp:chatgpt:check` passes against the HTTPS tunnel.
- [ ] ChatGPT developer mode can connect to the profile URL.
- [ ] ChatGPT can render workflow preview, setup, timeline, and approval widgets.
