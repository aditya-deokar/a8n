# MCP Resources and Prompts

> **Audience:** AI client developers optimizing LLM context usage  
> **Prerequisites:** [01 — Introduction to MCP](./01-introduction-to-mcp.md), [06 — Tools Reference](./06-tools-reference.md)  
> **Last Updated:** June 24, 2026

---

## What you'll learn

- All 17 MCP resources and when to read them
- The 5 resource templates for integration setup and app-style previews
- All 3 MCP prompts and their arguments
- Best practices: resources vs tools vs prompts

---

## Resources vs tools vs prompts

| Primitive | Mutates data? | Purpose |
|---|---|---|
| **Resource** | No | Provide schema/docs context before acting |
| **Tool** | Yes (usually) | Execute operations |
| **Prompt** | No | Return guided message templates |

**Recommended flow for complex tasks:**

1. Read relevant **resources** (schemas)
2. Fetch **prompt** for step-by-step guidance
3. Call **tools** to perform actions

---

## Resources (17)

Resources provide markdown or machine-readable JSON context. Some are generated from the canonical node manifest so they stay aligned with runtime behavior. Access via `resources/read` with the URI.

### a8n://schema/workflow

| Property | Value |
|---|---|
| **Name** | `workflow-schema` |
| **File** | `src/mcp/resources/workflow-schema.resource.ts` |

**Contents:** Workflow JSON structure — nodes array, edges array, position conventions, `credentialId` linking, full-replacement semantics for `update_workflow`.

**When to read:** Before calling `update_workflow` to avoid malformed graphs.

---

### a8n://schema/node-types

| Property | Value |
|---|---|
| **Name** | `node-types` |
| **File** | `src/mcp/resources/node-types.resource.ts` |

**Contents:** All 12 node types with categories, beginner descriptions, required fields, credential requirements, outputs, and connection rules.

**When to read:** When designing a new workflow graph or choosing node types.

---

### a8n://schema/credential-types

| Property | Value |
|---|---|
| **Name** | `credential-types` |
| **File** | `src/mcp/resources/credential-types.resource.ts` |

**Contents:** Supported credential types (`OPENAI`, `ANTHROPIC`, `GEMINI`, `SMTP_EMAIL`, `GOOGLE_SHEETS`), security model (encryption, never returned in responses), and how nodes reference credentials.

**When to read:** Before `create_credential` or wiring AI nodes.

---

### a8n://docs/api

| Property | Value |
|---|---|
| **Name** | `api-docs` |
| **File** | `src/mcp/resources/api-docs.resource.ts` |

**Contents:** Embedded API reference — all tools, scopes, resources, and common multi-step workflows. Mirrors [06 — Tools Reference](./06-tools-reference.md) in compact form for LLM context.

**When to read:** As a general reference when unsure which tool to call.

---

### a8n://catalog/nodes

Machine-readable JSON catalog of node types, fields, outputs, setup steps, examples, credential requirements, and safety metadata.

### a8n://catalog/credentials

Machine-readable JSON catalog of credential types, value formats, setup steps, and node mappings.

### a8n://integrations/{service}/setup

Markdown setup guides for `openai`, `anthropic`, `gemini`, `slack`, `discord`, `http`, `email`, `google_sheets`, `google_form`, and `stripe`.

---

### a8n://apps/catalog

Machine-readable catalog of app-style MCP resources. Each app resource returns `text/html` for clients that can render rich content and `text/markdown` fallback for plain chat clients.

---

## Resource Templates (5)

### a8n://integrations/{service}/setup

The server also registers this URI as a resource template with completion support for `service`.

**Completion values:** `openai`, `anthropic`, `gemini`, `slack`, `discord`, `http`, `email`, `google_sheets`, `google_form`, `stripe`.

Use the concrete resources when a client only supports `resources/list`; use the template when a client supports `resources/templates/list` or completion.

### a8n://apps/workflow-drafts/{draftId}/preview

Authenticated draft preview with beginner explanation, ordered steps, validation summary, HTML rendering, and markdown fallback.

### a8n://apps/workflows/{workflowId}/setup-checklist

Authenticated setup checklist for saved workflows: missing fields, credentials, webhook URLs, verification notes, and test steps.

### a8n://apps/executions/{executionId}/timeline

Authenticated execution timeline with status, duration, visible node config, output summary, HTML rendering, and markdown fallback.

### a8n://apps/workflow-drafts/{draftId}/approval

Authenticated approval preview with validation state, change summary, and the `confirmationHash` needed by `apply_workflow_draft`.

---

## Reading a resource

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer a8n_mcp_<your-api-key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": { "uri": "a8n://schema/workflow" },
    "id": 1
  }'
```

---

## Prompts (3)

Prompts return `messages` arrays for the host to inject into the conversation. They **do not execute tools** — they guide the model to call tools itself.

### create_workflow

| Property | Value |
|---|---|
| **Argument** | `description` (string) — what the workflow should do |
| **File** | `src/mcp/prompts/create-workflow.prompt.ts` |

**Purpose:** Step-by-step playbook for building a workflow from a natural language description.

**Guided steps in the prompt:**

1. Break down requirements into nodes
2. `plan_workflow_from_goal` and `search_capabilities` — discover likely nodes and setup needs
3. `create_workflow_draft` — create a safe persisted draft
4. `answer_workflow_draft_questions` — fill non-sensitive missing fields
5. `validate_workflow_draft` — check graph, credentials, and safety
6. `explain_workflow` + `preview_workflow_diff` — show the plan and approval hash
7. `apply_workflow_draft` — save only after explicit approval
8. `get_workflow_setup_checklist`, `test_credential`, and `run_workflow_test` — setup and test

**Example invocation:**

```json
{
  "method": "prompts/get",
  "params": {
    "name": "create_workflow",
    "arguments": {
      "description": "When a form is submitted, summarize with OpenAI and post to Slack"
    }
  }
}
```

---

### debug_execution

| Property | Value |
|---|---|
| **Argument** | `executionId` (string) |
| **File** | `src/mcp/prompts/debug-execution.prompt.ts` |

**Purpose:** Systematic diagnosis of failed workflow runs.

**Guided steps:**

1. `get_execution_timeline` — status, node order, output summary, and error context
2. `diagnose_execution` — classify the failure in beginner language
3. `suggest_workflow_fix` — create a repair draft when useful
4. `apply_workflow_fix` — apply only after explicit approval
5. `run_workflow_test` or `execute_workflow_and_wait` — re-test

---

### setup_integration

| Property | Value |
|---|---|
| **Argument** | `service` (string) — e.g. `openai`, `anthropic`, `gemini`, `slack`, `discord` |
| **File** | `src/mcp/prompts/setup-integration.prompt.ts` |

**Purpose:** Integration-specific setup guide with credential and node wiring instructions.

**Supported integrations:**

| Value | Covers |
|---|---|
| `openai` | OPENAI credential + node config |
| `anthropic` | ANTHROPIC credential + node config |
| `gemini` | GEMINI credential + node config |
| `slack` | SLACK webhook node setup |
| `discord` | DISCORD webhook node setup |
| `http` | HTTP request setup |
| `email` | SMTP credential + EMAIL node setup |
| `google_sheets` | Google service-account credential + sheet setup |
| `google_form` | Google Form webhook and Apps Script setup |
| `stripe` | Stripe webhook setup |

---

## Best practices for LLM hosts

### Reduce hallucinated node shapes

Always fetch `a8n://schema/workflow` and `a8n://schema/node-types` before the first `update_workflow` call in a session.

### Prefer prompts for multi-step tasks

For "create a workflow that does X", use the `create_workflow` prompt instead of improvising steps — it encodes positioning and tool ordering conventions.

### Do not cache resources indefinitely

Resources are static at build time but may change between deployments. Re-read when the server version changes.

### Resources are not a substitute for tools

`a8n://docs/api` describes tools; you must still call `tools/call` to execute them.

---

## Static vs dynamic content

| Content | Source | Updates |
|---|---|---|
| Resources | Embedded TypeScript strings | Requires code deploy |
| `list_node_types` tool | Canonical node manifest | Requires code deploy |
| Tool list | Runtime `tools/list` | Always current |

If resources drift from actual behavior, prefer `list_node_types` and `server_info` for runtime truth.

---

## Next steps

- [06 — Tools Reference](./06-tools-reference.md)
- [11 — Extending the Server](./11-extending-the-server.md) — add new resources/prompts

---

<div align="center">
  <sub>Part of the a8n MCP documentation series</sub>
</div>
