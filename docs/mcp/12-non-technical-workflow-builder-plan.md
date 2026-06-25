# MCP Roadmap: Non-Technical Workflow Builder

> Status: Phase 0-8 initial implementation complete; remaining work is rollout, CI smoke coverage, and deeper production hardening
> Scope: `src/mcp`, `docs/mcp`, workflow editor, credentials, executions, webhooks, and all current node types
> Goal: make a8n usable by people who have never used n8n, automation builders, webhooks, API keys, or node-based configuration.

## Executive Summary

The current MCP server is a strong technical foundation: it exposes workflows, credentials, executions, node metadata, API keys, resources, and prompts over Streamable HTTP. It is built around direct Prisma access, scoped API keys, session fallback, audit logging, output sanitization, and an `/mcp` dashboard for client setup.

However, the current MCP surface is still a developer/operator API. It lets a capable MCP client manipulate raw workflow graphs, but it does not yet behave like a beginner-safe workflow copilot. The highest-value next step is to move from CRUD tools to intent-first tools that can ask clarifying questions, create drafts, validate workflows, explain the plan in plain language, preview changes, apply them safely, run tests, diagnose errors, and guide integration setup without exposing raw node JSON to the user.

The plan below is phase-based. Phase 0 fixes correctness and parity issues. Phases 1-4 build the assistant-grade workflow engine. Phases 5-8 make it usable, safe, observable, and measurable for real non-technical users.

## Implementation Status: June 24, 2026

- Phase 0 is implemented for auth context injection, CORS/OPTIONS handling, docs/runtime drift, safer default key scopes, structured tool responses, and premium parity for MCP create operations. Remaining: automated MCP contract/smoke tests.
- Phase 1 is implemented for the canonical node manifest, node/credential catalogs, `search_capabilities`, integration setup resources, resource-template service completion, node config schemas, node output schemas, and structured output. Remaining: workflow-ID and credential-type completions where client/SDK support is expanded.
- Phase 2 initial implementation is now present with persisted workflow drafts, goal planning, draft creation, non-sensitive answer updates, validation, explanation, diff preview, and approval-hash based draft apply.
- Phase 3 initial implementation is now present with workflow version snapshots, duplicate workflow, rollback, and approval-gated partial graph edits.
- Phase 4 initial implementation is now present with setup checklists, integration setup guides, credential dry-run/live validation, webhook sample tests, Google Form script generation, webhook URL helpers, and advanced secret-handling guidance for `create_credential`. Remaining: OAuth-native connection flows and richer per-integration UI.
- Phase 5 initial implementation is now present with execution event correlation, `execute_workflow_and_wait`, approved workflow test runs, execution timelines, failure diagnosis, repair draft creation, and approval-hash based repair apply. Remaining: true per-node runtime telemetry, live streaming status, retries, and deeper auto-repair strategies.
- Phase 6 initial implementation is now present with authenticated app-style MCP resources for draft preview, setup checklist, execution timeline, approval preview, and an app catalog. Each resource returns `text/html` plus `text/markdown` fallback. Remaining: full MCP Apps widgets embedded in supported clients and richer React Flow visual previews.
- Phase 7 initial implementation is now present with persistent MCP audit log storage, audit query tooling, `security_status`, HMAC-compatible API key hashing, broader secret redaction, Google Form shared-secret verification, Stripe signature/shared-secret verification, and updated security docs. Remaining: distributed rate limiting, OAuth-native integrations, product UI audit dashboards, per-node live telemetry, and stricter webhook secret UX.
- Phase 8 initial implementation is now present with a 50-case non-technical goal evaluation dataset, deterministic planning evaluator, catalog integrity checks, redaction regression checks, and the `npm run eval:mcp` verification command. Remaining: CI MCP Inspector smoke tests, live end-to-end workflow tests, product analytics, and usability testing with real beginners.

## Verification Snapshot: June 24, 2026

- `npm run eval:mcp`: passed, 50/50 cases, 100% pass rate, average score 0.996, catalog check ok, redaction check ok.
- `npx tsc --noEmit --pretty false`: passed.
- `npx prisma validate`: should be run with the matching database environment before deployment.
- `npm run lint`: currently blocked by an existing project-level ESLint runtime issue in `@typescript-eslint/utils`, not by MCP code.

## Current Implementation Audit

### MCP Entry Point And Transport

- `src/app/api/mcp/route.ts` exposes `POST`, `GET`, and `DELETE` at `/api/mcp`.
- The transport is `WebStandardStreamableHTTPServerTransport` in stateless mode with `sessionIdGenerator: undefined`.
- A new `McpServer` is created per request by `createMcpServer()` in `src/mcp/index.ts`.
- The route validates Bearer auth, applies an in-memory rate limit, validates configured CORS origins, and passes auth context into the per-request MCP server before handing the request to the SDK transport.

### Registered MCP Capabilities

At the initial Phase 0 audit, registry comments advertised 22 tools, 4 resources, and 3 prompts.

Tools:

- Workflows: `list_workflows`, `get_workflow`, `create_workflow`, `update_workflow`, `rename_workflow`, `delete_workflow`, `execute_workflow`.
- Credentials: `list_credentials`, `get_credential`, `create_credential`, `update_credential`, `delete_credential`, `list_credentials_by_type`.
- Executions: `list_executions`, `get_execution`.
- Nodes: `list_node_types`.
- System: `whoami`, `server_info`, `health_check`.
- API keys: `create_api_key`, `list_api_keys`, `revoke_api_key`.

Resources:

- `a8n://schema/workflow`
- `a8n://schema/node-types`
- `a8n://schema/credential-types`
- `a8n://docs/api`

Prompts:

- `create_workflow`
- `debug_execution`
- `setup_integration`

### Authentication And Security

- Bearer tokens support API keys with the `a8n_mcp_` prefix and Better Auth session tokens.
- API keys are generated securely, shown once, stored as SHA-256 hashes, scoped, expirable, and revocable.
- The current scope model covers workflows, credentials, executions, system info, and API key management.
- Credential values are encrypted at rest and intentionally excluded from tool responses.
- Audit logging sanitizes sensitive fields and tracks in-memory metrics.
- Rate limiting is in-memory and always treated as the free tier from the route.

### Dashboard And Client Setup

- `src/features/mcp` provides an `/mcp` dashboard to create, list, and revoke API keys.
- The dashboard gives client config snippets for Antigravity, Cursor, Claude Code, and MCP Inspector.
- Dashboard key creation defaults to `["*"]`, while the API key service defaults to read-only scopes when scopes are omitted. This is convenient for demos but risky for non-technical production users.

### Workflow And Execution Integration

- MCP tools call Prisma directly rather than tRPC.
- `execute_workflow` triggers Inngest through `sendWorkflowExecution`.
- The Inngest workflow runner executes nodes in topological order and stores execution output in the `Execution` table.
- MCP now supports event correlation, wait/poll execution, test runs, timeline summaries, diagnosis, and repair drafts. Remaining runtime gaps are true per-node telemetry, live streaming status, and richer retry controls.

### Current App Feature Coverage

The app currently supports these workflow building blocks:

| Area | Current node or feature | MCP coverage today | Gap for non-technical users |
|---|---|---|---|
| Manual start | `MANUAL_TRIGGER` | Can build graph manually | Needs "Run this when I click a button" phrasing and one-click test flow |
| Google Forms | `GOOGLE_FORM_TRIGGER` and `/api/webhooks/google-form` | Node type/resource mentions it | Needs generated setup instructions, webhook/script helper, sample payload testing |
| Stripe | `STRIPE_TRIGGER` and `/api/webhooks/stripe` | Node type/resource mentions it | Needs event selection, signature verification roadmap, sample payload testing |
| HTTP API | `HTTP_REQUEST` | Raw node data only | Needs guided method/body/header/auth setup, URL validation, safe external-call confirmation |
| OpenAI | `OPENAI` + `OPENAI` credential | Credential and node tools | Needs readiness checks, prompt templates, model controls, cost/safety guidance |
| Anthropic | `ANTHROPIC` + `ANTHROPIC` credential | Credential and node tools | Same as OpenAI |
| Gemini | `GEMINI` + `GEMINI` credential | Credential and node tools | Same as OpenAI |
| Discord | `DISCORD` webhook | Raw node data only | Needs webhook setup wizard, test message, message preview |
| Slack | `SLACK` webhook | Raw node data only | Needs webhook setup wizard, test message, payload field clarity |
| Email | `EMAIL` + `SMTP_EMAIL` credential | Partially documented in resource/prompt | Needs credential schema, SMTP test, plain-language email builder |
| Google Sheets | `GOOGLE_SHEETS` + `GOOGLE_SHEETS` credential | Partially documented in resource/prompt | Needs service account guide, sheet access check, row preview |
| Credentials | encrypted credential store | CRUD tools exist | Needs secure non-technical connection flow; avoid asking for secrets through normal chat |
| Executions | Inngest async runner | list/get, event correlation, wait, timeline, diagnosis, test runs, repair drafts | Needs true per-node telemetry, retry controls, and live status streaming |
| API keys | `/mcp` dashboard and MCP tools | Good technical coverage | Needs beginner key modes and safer defaults |

## Critical Gaps

### Phase 0 Blocker: Auth Context Injection

The route validates auth, but `createMcpServer()` does not receive the validated `McpAuthInfo`. Tool handlers read `extra.authInfo`, and docs already flag that this may be undefined. If the SDK does not inject it automatically, authenticated requests can still fail inside tools. This must be fixed before building higher-level tools.

### MCP Is CRUD-First, Not Goal-First

The current tool surface assumes the model can design a full React Flow graph and call `update_workflow` with node IDs, positions, and raw `data`. A non-technical user should be able to say:

> "When someone submits my Google Form, summarize their answer with Gemini and email the result to them."

The server should then:

1. Translate the goal into a plain-language plan.
2. Ask only necessary missing questions.
3. Check credentials and setup readiness.
4. Create a draft workflow.
5. Explain every step.
6. Validate the graph and node configs.
7. Ask for explicit approval.
8. Apply the workflow.
9. Test it and diagnose failures.

Today, most of that responsibility sits in a prompt and is delegated to the MCP client/model.

### High-Risk Full Replacement Updates

`update_workflow` deletes and recreates all nodes and connections. This is acceptable for an editor save operation, but it is dangerous as the main AI mutation primitive because one malformed call can erase a workflow. The assistant needs draft, diff, partial mutation, validation, rollback, and confirmation flows.

### Metadata Drift

Several docs and embedded resources lag behind the code:

- At audit time, `api-docs.resource.ts` said "Tools (21 total)" while the registry advertised 22 and included `health_check`.
- Some docs say there are 10 node types, but the app now has 12 including `EMAIL` and `GOOGLE_SHEETS`.
- Some credential docs list only `OPENAI`, `ANTHROPIC`, and `GEMINI`, while the schema also supports `SMTP_EMAIL` and `GOOGLE_SHEETS`.
- `setup_integration` code uses `service`, while docs describe the argument as `integration`.
- Several docs contain mojibake characters, likely from encoding conversion.

### Missing Workflow Understanding Layer

There is no canonical node manifest shared by:

- the editor node selector,
- node dialogs,
- node executors,
- MCP resources,
- validation logic,
- workflow planner,
- docs.

Without this, MCP will continue drifting from the product and LLMs will keep guessing node shapes.

### Missing Beginner Safety

The server currently lacks:

- safe beginner toolsets that hide destructive tools,
- server-side confirmation/approval model,
- workflow drafts before applying,
- undo/rollback/versioning,
- structured tool errors that a model can recover from,
- output schemas and `structuredContent`,
- tool annotations for destructive or read-only operations,
- webhook verification guarantees,
- persistent audit trails,
- shared rate limiting for multi-instance deployment,
- integration-specific test tools.

## External MCP Design Signals Reviewed

The roadmap uses these patterns from current MCP references and mature public servers:

- MCP tools are model-controlled, but official guidance recommends human confirmation for sensitive operations and visible tool invocation indicators. Source: [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).
- MCP supports structured tool output and output schemas, while the current server returns JSON only as text. Source: [MCP structured content and output schema](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#structured-content).
- Resources are intended to provide application-specific context such as schemas and documentation; resource templates can make dynamic resources discoverable. Source: [MCP Resources specification](https://modelcontextprotocol.io/specification/2025-06-18/server/resources).
- Prompts are user-controlled templates, not an execution engine. Source: [MCP Prompts specification](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts).
- Elicitation lets servers request structured non-sensitive user input when the client supports it; it must not be used to request sensitive information. Source: [MCP Elicitation specification](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation).
- Sampling lets servers request LLM help through the client while preserving client-side control and approval. Source: [MCP Sampling specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling).
- Streamable HTTP servers must validate `Origin`, use proper auth, and avoid unsafe local exposure. Source: [MCP Transports specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).
- The GitHub MCP Server uses toolsets, read-only mode, individual tool allowlists, and tool search to reduce context size and improve tool choice. Source: [GitHub MCP Server README](https://github.com/github/github-mcp-server).
- Stripe recommends restricted API keys for granular permissions and lets key permissions determine available tool power. Source: [Stripe Agent Toolkit README](https://github.com/stripe/ai).
- MCP Apps are an official extension for interactive UI elements such as forms and charts inside conversational clients, with graceful text fallback when unsupported. Source: [MCP Extensions overview](https://modelcontextprotocol.io/extensions/overview).

## Target Product Experience

The MCP server should make the user feel like they are chatting with a helpful automation expert, not editing a graph API.

Target interaction:

1. User describes a goal in plain language.
2. Assistant restates the goal and breaks it into simple steps.
3. Assistant asks only the missing questions that matter.
4. Assistant checks existing credentials and tells the user what needs connecting.
5. Assistant creates a draft workflow and explains it.
6. Assistant previews the workflow visually when the client supports MCP Apps, with text fallback.
7. Assistant validates the workflow before saving.
8. User approves.
9. Assistant saves, tests, and monitors execution.
10. If something fails, assistant diagnoses it and proposes safe fixes.

Success criteria:

- A beginner can create a simple manual-trigger workflow in under 5 minutes.
- A beginner can create one external-trigger workflow in under 15 minutes after credentials/webhooks are available.
- The assistant never requires the user to understand node IDs, edge handles, CUIDs, JSON, or React Flow coordinates.
- Destructive or external side-effect actions always have preview and confirmation.
- Every generated workflow has a human-readable explanation and a machine-readable validation report.

## Proposed MCP Capability Model

### Beginner Toolsets

Adopt a GitHub-style toolset model:

| Toolset | Audience | Includes | Excludes |
|---|---|---|---|
| `beginner` | non-technical users | planning, drafts, explain, validate, safe apply, run tests | raw `update_workflow`, delete, wildcard key creation |
| `builder` | power users | partial node edits, templates, graph diff | credential secret reads, admin tools |
| `runtime` | operators | executions, health, diagnostics, retry | workflow mutation |
| `admin` | account owners | API keys, audit, server config | hidden by default |
| `raw` | developers | existing CRUD tools | disabled for beginner clients unless explicitly requested |

This reduces context size and avoids putting dangerous tools in front of the model for everyday beginner tasks.

### Canonical Node Manifest

Create a single source of truth, for example `src/features/workflows/node-manifest.ts`, consumed by UI, executors, MCP resources, validation, and docs generation.

Each node definition should include:

- `type`
- beginner label
- category
- plain-language description
- required fields
- optional fields
- Zod input schema
- output variables and examples
- credential type required, if any
- setup instructions
- validation function
- test function availability
- risk level
- whether it causes external side effects
- suggested natural-language examples

### High-Level Tools To Add

| Tool | Purpose | Why it matters |
|---|---|---|
| `search_capabilities` | Search nodes, templates, and integrations by plain language | Lets the model discover "send message", "spreadsheet", "AI summary" |
| `plan_workflow_from_goal` | Convert user goal into steps, missing questions, required integrations | Makes planning server-owned and consistent |
| `create_workflow_draft` | Build an unsaved draft graph from a goal or selected template | Avoids destructive writes |
| `answer_workflow_draft_questions` | Add user answers to an existing draft | Enables conversational refinement |
| `validate_workflow_draft` | Validate graph, node configs, credentials, templates, reachability, cycles | Prevents broken workflows |
| `explain_workflow` | Explain an existing or draft workflow in beginner language | Helps user understand and trust the automation |
| `preview_workflow_diff` | Compare current workflow vs proposed change | Required before mutation |
| `apply_workflow_draft` | Save validated draft after explicit approval | Safe write path |
| `add_workflow_node` | Add one node safely | Avoids full replacement for small changes |
| `update_node_config` | Edit one node safely | Easier repair and iteration |
| `connect_workflow_nodes` | Add one connection safely | Avoids raw edge arrays |
| `remove_workflow_node` | Remove one node with impact analysis | Safer deletion |
| `duplicate_workflow` | Copy before major edits | Simple rollback path |
| `get_workflow_setup_checklist` | Show what credentials/webhooks are missing | Beginner onboarding |
| `get_integration_setup_guide` | Return service-specific setup steps and safe links | Covers Slack, Discord, Google Forms, Stripe, SMTP, Sheets, AI |
| `test_credential` | Validate a credential without revealing it | Reduces mystery failures |
| `test_node_config` | Run or simulate one node with sample input | Debug before full workflow |
| `run_workflow_test` | Execute with sample/manual data and return timeline | Beginner confidence |
| `execute_workflow_and_wait` | Trigger and wait/poll until success/failure/timeout | Better chat UX than "go list executions" |
| `get_execution_timeline` | Node-by-node execution results | Understand failures |
| `diagnose_execution` | Convert errors into cause, fix, and next action | Core support experience |
| `suggest_workflow_fix` | Produce safe patch proposal from diagnosis | Moves toward self-repair |
| `apply_workflow_fix` | Apply approved repair patch | Closes the loop |

### Resources And Templates To Add

| Resource | Purpose |
|---|---|
| `a8n://catalog/nodes` | Dynamic node catalog generated from canonical manifest |
| `a8n://catalog/credentials` | Dynamic credential type catalog and safe setup notes |
| `a8n://catalog/templates` | Workflow recipe library |
| `a8n://templates/{templateId}` | Template detail with required questions and generated graph |
| `a8n://workflows/{workflowId}/summary` | Plain-language workflow explanation |
| `a8n://workflows/{workflowId}/graph` | Structured graph with schema version |
| `a8n://workflows/{workflowId}/validation` | Latest validation report |
| `a8n://executions/{executionId}/timeline` | Node timeline and output summary |
| `a8n://integrations/{service}/setup` | Current setup guide for each supported integration |

### Prompts To Add Or Replace

Prompts should become entry points for users, while tools do the actual planning and validation.

- `build_workflow_for_goal`
- `explain_this_workflow`
- `fix_failed_workflow`
- `setup_google_form_workflow`
- `setup_stripe_workflow`
- `setup_ai_summary_workflow`
- `connect_slack_or_discord`
- `send_email_from_workflow`
- `append_to_google_sheet`

### MCP Apps / Interactive UI

When clients support MCP Apps, return UI resources for:

- workflow draft preview,
- step-by-step setup wizard,
- credential connection panel,
- webhook copy/test panel,
- execution timeline,
- approval screen for writes,
- validation report.

Always provide text fallback because client support will vary.

## Phase-Wise Implementation Plan

## Phase 0: Stabilize The Current MCP Server

Target: make existing MCP reliable before adding more capability.

Duration: 3-5 days.

Deliverables:

- Pass validated auth into tool handlers.
  - Change `createMcpServer(auth)` or add a request context wrapper so every tool receives `McpAuthInfo`.
  - Add a defensive `getAuthOrThrow(extra)` helper instead of casting `(extra as any).authInfo`.
- Add basic MCP contract tests.
  - `tools/list` returns expected tools.
  - `health_check` succeeds with a seeded key.
  - read-only key cannot write.
  - invalid key receives 401.
  - missing scope produces structured permission error.
- Fix docs and resource drift.
  - Update tool count from 21 to 22 where needed.
  - Update node count to 12.
  - Include `EMAIL`, `GOOGLE_SHEETS`, `SMTP_EMAIL`, and `GOOGLE_SHEETS` credential type everywhere.
  - Fix `setup_integration` argument naming.
  - Fix mojibake encoding in docs.
- Apply `MCP_CORS_ORIGINS` and validate `Origin` for Streamable HTTP.
- Add an `OPTIONS` handler for browser clients.
- Align dashboard defaults.
  - Default new dashboard keys to beginner-safe scopes.
  - Make wildcard a visible advanced choice with warning copy.
- Ensure subscription/premium parity.
  - Decide whether MCP `create_workflow` and `create_credential` should match `premiumProcedure`.
  - If yes, add a shared entitlement check.
- Add a seed/dev script smoke test for MCP Inspector.

Acceptance criteria:

- `health_check`, `whoami`, `list_node_types`, `list_workflows`, and one write tool all work with a seeded key.
- A read-only key cannot mutate.
- Docs match runtime capabilities.
- The route rejects untrusted origins in production.

## Phase 1: Create The Capability Catalog And Schemas

Target: give the MCP server a trustworthy map of the product.

Duration: 1-2 weeks.

Deliverables:

- Create a canonical node manifest shared by UI, MCP, validation, and docs.
- Move duplicated metadata out of `src/mcp/tools/nodes/node-tools.ts`, `src/mcp/resources/node-types.resource.ts`, and `src/components/node-selector.tsx`.
- Add node-specific Zod schemas:
  - Manual trigger: no config.
  - Google Form trigger: webhook setup metadata.
  - Stripe trigger: event metadata and future signing-secret fields.
  - HTTP request: `variableName`, `endpoint`, `method`, `body`; add roadmap fields for headers/auth.
  - AI nodes: `variableName`, `credentialId`, `systemPrompt`, `userPrompt`; add roadmap fields for model/temperature/max tokens.
  - Discord: `variableName`, `webhookUrl`, `content`, `username`.
  - Slack: `variableName`, `webhookUrl`, `content`.
  - Email: `variableName`, `credentialId`, `to`, `subject`, `body`, `from`, `replyTo`.
  - Google Sheets: `variableName`, `credentialId`, `spreadsheetId`, `sheetName`, `rowJson`.
- Add output schemas for each node:
  - AI nodes: `{ text }`
  - HTTP: `{ httpResponse: { status, statusText, data } }`
  - Email: `{ messageId, accepted, rejected, response, envelope, to, subject }`
  - Google Sheets: `{ updatedRange, updatedRows, updatedColumns, updatedCells }`
  - Slack/Discord: `{ messageContent }`
  - Google Form initial data: `{ googleForm: { formId, formTitle, responseId, timestamp, respondentEmail, responses, raw } }`
  - Stripe initial data: `{ stripe: { eventId, eventType, timestamp, livemode, raw } }`
- Add `search_capabilities`.
  - Search node labels, descriptions, aliases, required info, examples, and templates.
  - Inspired by GitHub MCP Server's `tool-search`.
- Add dynamic resources.
  - `a8n://catalog/nodes`
  - `a8n://catalog/credentials`
  - `a8n://integrations/{service}/setup`
- Add MCP completion support for prompt/resource arguments where the SDK allows it.
  - Services: `openai`, `anthropic`, `gemini`, `slack`, `discord`, `http`, `email`, `google_sheets`, `google_form`, `stripe`.
  - Workflow IDs and credential types.
- Convert high-traffic tool responses to `structuredContent` with text fallback.
- Add output schemas to tools that return predictable objects.

Acceptance criteria:

- A single manifest generates node docs, MCP node catalog, and UI node selector labels.
- `search_capabilities("send email")` returns Email with required credential and examples.
- `search_capabilities("save to spreadsheet")` returns Google Sheets with setup checklist.
- MCP clients receive structured output for at least `list_node_types`, `get_workflow`, and `validate_workflow_draft`.

## Phase 2: Build Beginner-Safe Workflow Drafting

Target: move workflow creation from raw graph editing to goal-first drafts.

Duration: 2-3 weeks.

Deliverables:

- Add draft storage.
  - Option A: new Prisma models `WorkflowDraft` and `WorkflowDraftRevision`.
  - Option B: in-memory/Redis draft store for early version.
  - Recommended: Prisma for durability, audit, and continuation across chat sessions.
- Add `plan_workflow_from_goal`.
  - Input: user goal, optional audience, optional preferred apps.
  - Output: plain-language steps, required apps, missing questions, risks, estimated setup effort, suggested template.
  - Does not mutate anything.
- Add `create_workflow_draft`.
  - Builds a draft from a plan or template.
  - Assigns stable internal node IDs.
  - Uses default positions.
  - Marks missing fields explicitly.
- Add `answer_workflow_draft_questions`.
  - Accepts non-sensitive answers.
  - Never asks for secrets through elicitation.
  - Updates draft state and recomputes missing fields.
- Add `validate_workflow_draft`.
  - Checks DAG validity, trigger presence, node schema fields, credential existence, credential type compatibility, template syntax, duplicate variable names, unreachable nodes, and external side-effect warnings.
- Add `explain_workflow`.
  - Works for drafts and saved workflows.
  - Produces a beginner explanation, technical summary, data flow, setup checklist, and "what happens when it runs".
- Add `preview_workflow_diff`.
  - Shows additions, removals, config changes, side effects, and rollback plan.
- Add `apply_workflow_draft`.
  - Requires draft validation success.
  - Requires explicit confirmation parameter such as `approved: true` and a confirmation summary hash.
  - Saves using the same transaction path as the editor.
- Keep raw `update_workflow`, but move it to an advanced/raw toolset.

Acceptance criteria:

- User goal "When a Google Form is submitted, summarize answers with Gemini and email the respondent" produces a draft with Google Form trigger, Gemini, Email, missing Gemini/SMTP credentials if absent, and setup checklist.
- Applying a draft cannot occur until validation passes and explicit approval is supplied.
- The assistant can explain the draft without exposing raw JSON.

## Phase 3: Add Safe Partial Editing And Versioning

Target: make iterative conversation safe.

Duration: 1-2 weeks.

Deliverables:

- Add workflow version snapshots before every MCP mutation.
- Add `duplicate_workflow`.
- Add `rollback_workflow_version`.
- Add partial mutation tools:
  - `add_workflow_node`
  - `update_node_config`
  - `connect_workflow_nodes`
  - `disconnect_workflow_nodes`
  - `remove_workflow_node`
  - `move_workflow_node`
- Each partial mutation should:
  - load current graph,
  - validate user ownership,
  - apply one change,
  - validate whole graph,
  - return diff and explanation,
  - save only when `approved: true`.
- Add graph-level constraints:
  - one manual trigger maximum,
  - at least one trigger for executable workflows,
  - no cycles,
  - no missing required fields,
  - no duplicate variable names unless explicitly allowed,
  - no credential type mismatch,
  - no dangling edges.

Acceptance criteria:

- A user can say "also post the same summary to Slack" and the server can add one Slack node and one connection without rebuilding the whole workflow.
- A bad edit returns a validation report and does not save.
- A previous version can be restored.

## Phase 4: Guided Integration And Credential Setup

Target: help beginners connect services without understanding API keys, webhooks, SMTP JSON, or service accounts.

Duration: 2-3 weeks.

Deliverables:

- Add `get_workflow_setup_checklist`.
  - Per workflow/draft, return missing credentials, webhook steps, test steps, and estimated effort.
- Add `get_integration_setup_guide`.
  - Covers OpenAI, Anthropic, Gemini, Slack, Discord, HTTP APIs, Email/SMTP, Google Sheets, Google Forms, and Stripe.
- Add `test_credential`.
  - OpenAI/Anthropic/Gemini: simple model call or provider key validation.
  - SMTP: verify transport/login without sending by default; optional test email after approval.
  - Google Sheets: verify service account JSON and sheet access.
- Add `test_webhook_setup`.
  - Generate sample payloads for Google Forms and Stripe.
  - Let users trigger a test execution without configuring the external service first.
- Add `generate_google_form_script`.
  - Use existing `generateGoogleFormScript()` logic as an MCP tool/resource.
- Add `get_webhook_url`.
  - Return Google Form or Stripe webhook URL for a workflow.
- Add secure credential UX.
  - Do not use MCP elicitation to request sensitive values because the spec says elicitation must not request sensitive information.
  - Prefer dashboard links, OAuth flows, or MCP Apps forms with clear secret-handling UI.
  - If `create_credential` remains available, mark it advanced and warn clients through descriptions and annotations.
- Add OAuth-native integrations where possible.
  - Google Sheets OAuth/service-account helper.
  - Slack OAuth or webhook flow.
  - Stripe webhook signing secret capture and verification.

Acceptance criteria:

- The assistant can tell a beginner exactly what remains before a workflow can run.
- Credentials can be tested independently.
- Google Form and Stripe trigger workflows can be tested with sample payloads.
- Secrets are never requested through generic clarification prompts.

## Phase 5: Execution Monitoring, Debugging, And Repair

Target: close the loop after creation.

Duration: 2-3 weeks.

Deliverables:

- Improve `execute_workflow`.
  - Return `executionId` or event correlation information directly.
  - If needed, change `sendWorkflowExecution` and execution creation so the ID is known before queueing or can be resolved reliably.
- Add `execute_workflow_and_wait`.
  - Poll until success/failure/timeout.
  - Return status, timeline, output summary, and next action.
- Add `run_workflow_test`.
  - Manual trigger: empty or provided sample data.
  - Google Form: generated sample form payload.
  - Stripe: generated sample event payload.
- Add `get_execution_timeline`.
  - Include node order, node status, duration, visible output summary, error message, and relevant config fields.
- Add `diagnose_execution`.
  - Classify errors:
    - missing credential,
    - invalid credential,
    - missing field,
    - bad template variable,
    - invalid JSON body or row JSON,
    - HTTP failure,
    - webhook setup issue,
    - provider/API failure,
    - cycle/unreachable graph,
    - timeout.
  - Return beginner explanation, likely cause, exact fix options, and whether the fix is safe to auto-apply.
- Add `suggest_workflow_fix`.
  - Produces draft patch, not direct mutation.
- Add `apply_workflow_fix`.
  - Requires approval and snapshot.
- Consider exposing Inngest realtime status through MCP resources or task-style handles.

Acceptance criteria:

- A failed run can be diagnosed from chat without opening the editor.
- Common errors produce actionable, plain-language fixes.
- The assistant can apply approved safe fixes and re-test.

## Phase 6: Non-Technical UX With MCP Apps

Target: make chat plus visual confirmation feel natural.

Duration: 2-4 weeks, can run parallel after Phase 2.

Deliverables:

- Add MCP App resources with text fallback:
  - workflow draft preview,
  - validation report,
  - setup checklist,
  - credential connection form,
  - webhook setup panel,
  - execution timeline,
  - approval/diff screen.
- Reuse existing React Flow rendering patterns where possible.
- Add "beginner cards" for each step:
  - What this step does.
  - What information it needs.
  - What data it sends/receives.
  - What can go wrong.
- Add safe approval UX:
  - External calls are clearly shown.
  - Email/Slack/Discord recipients and messages are previewed.
  - Workflow deletes and broad updates require explicit confirmation.
- Add plain-language template gallery.
  - "Summarize form responses and email the respondent"
  - "Send a Stripe payment alert to Slack"
  - "Call an API and save the result to Google Sheets"
  - "Ask AI to write a reply and post it to Discord"
  - "Send an email after an HTTP request succeeds"

Acceptance criteria:

- On clients with MCP Apps, users see visual workflow previews and approval panels.
- On clients without MCP Apps, users still receive complete text explanations and safe confirmations.

## Phase 7: Production Hardening

Target: make the assistant safe for real users and teams.

Duration: 2-4 weeks, partly parallel.

Deliverables:

- Replace in-memory rate limiting with Redis/Upstash or platform rate limiting.
- Persist audit logs for tool calls and workflow mutations.
- Add HMAC-based API key hashing using a server secret.
- Add OAuth 2.1 / protected resource metadata support for remote MCP clients over time.
- Add origin validation and CORS allowlists.
- Add tool annotations for destructive, idempotent, read-only, and external-side-effect operations.
- Add timeouts and cancellation for long-running MCP tools.
- Add webhook security:
  - Stripe signature verification.
  - Optional Google Form shared secret or signed URL.
- Add prompt-injection defenses:
  - Treat workflow inputs and webhook payloads as untrusted data.
  - Avoid allowing external content to override tool instructions.
  - Redact secrets from execution output summaries.
- Add resource and tool access by account plan/entitlement.
- Add per-tool scopes for future high-risk operations:
  - `workflow_drafts:write`
  - `workflows:repair`
  - `integrations:test`
  - `webhooks:manage`
  - `workflow_versions:restore`
- Add tenant-safe observability dashboards.

Acceptance criteria:

- Rate limits and metrics work across multiple app instances.
- Audit records survive process restarts.
- Webhook triggers can be protected against spoofed requests.
- The beginner toolset excludes raw/destructive tools by default.

## Phase 8: Evaluation, Quality, And Rollout

Target: prove that non-technical users can succeed.

Duration: ongoing.

Initial implementation completed on June 24, 2026:

- Added `src/mcp/evals/non-technical-goals.ts` with 50 beginner-style automation goals covering manual triggers, Google Forms, Stripe, HTTP APIs, AI providers, Slack, Discord, Email, and Google Sheets.
- Added `scripts/mcp-eval.ts`, a deterministic evaluator that checks inferred graph shape, credentials, integrations, trigger choice, side-effect awareness, clarification coverage, catalog integrity, and redaction behavior.
- Added `npm run eval:mcp` as the local regression gate for non-technical workflow planning quality.
- Documented the evaluation and rollout process in `docs/mcp/13-evaluation-and-rollout.md`.

Deliverables:

- Add an MCP evaluation suite with 50-100 natural-language workflow goals. Initial 50-case suite is implemented.
- Include golden expected plans, required questions, graph shapes, validation results, and explanations.
- Add regression tests for every node schema and output schema.
- Add MCP Inspector smoke tests in CI.
- Add end-to-end test cases:
  - create manual AI workflow,
  - create Google Form -> AI -> Email workflow,
  - create Stripe -> Slack workflow,
  - create HTTP -> Google Sheets workflow,
  - diagnose missing credential,
  - diagnose invalid JSON template,
  - rollback a bad change.
- Add metrics:
  - first-workflow success rate,
  - average clarification turns,
  - validation failure rate,
  - execution success after generation,
  - tool retry rate,
  - destructive action confirmation rate,
  - support ticket deflection,
  - number of workflows created without opening raw editor.
- Run usability tests with 5-10 people who have never used n8n or automation tools.
- Roll out in stages:
  - internal/dev keys,
  - advanced users,
  - beginner beta,
  - default assistant path.

Acceptance criteria:

- At least 80% of beginner test users can create and test a simple workflow without editing JSON.
- At least 60% can complete an external integration workflow when provided valid service credentials/webhook access.
- Generated workflows pass validation before save.
- No raw secrets appear in MCP responses, logs, or execution summaries.

## Suggested Implementation Order

1. Phase 0: stabilize auth, docs, CORS, key defaults, and premium parity. Implemented.
2. Phase 1: build canonical manifest, catalogs, schemas, structured output, and capability search. Implemented.
3. Phase 2: add workflow planning, drafts, validation, explanation, diff preview, and safe apply. Implemented.
4. Phase 3: add workflow versions, rollback, duplicate, and approval-gated partial edits. Implemented.
5. Phase 4: add setup checklists, integration guides, credential testing, webhook testing, and setup helpers. Implemented.
6. Phase 5: add execution wait, tests, timelines, diagnosis, repair drafts, and safe repair apply. Implemented.
7. Phase 6: add app-style resources and text fallbacks for previews, checklists, timelines, and approvals. Implemented.
8. Phase 7: add persistent audit, audit tools, security status, HMAC key hashing, redaction, and webhook verification. Implemented.
9. Phase 8: add the first evaluation suite and rollout quality gate. Implemented.

## Remaining Backlog

These are the next concrete tickets after the Phase 0-8 baseline:

1. `MCP-R01`: Add MCP Inspector smoke tests in CI for tool/resource/prompt discovery and authenticated `health_check`.
2. `MCP-R02`: Add live end-to-end tests for manual, Google Form, Stripe, HTTP, Email, Slack, Discord, and Google Sheets workflows.
3. `MCP-R03`: Add schema-level tests for every node config schema and output schema in the canonical manifest.
4. `MCP-R04`: Replace in-memory rate limiting with Redis, Upstash, or platform rate limiting for multi-instance deployment.
5. `MCP-R05`: Add product UI audit dashboards backed by `McpAuditLog`.
6. `MCP-R06`: Add per-node runtime telemetry and live execution streaming.
7. `MCP-R07`: Expand safe auto-repair strategies and retry controls.
8. `MCP-R08`: Add OAuth-native setup flows where service APIs allow it.
9. `MCP-R09`: Run usability tests with 5-10 people who have never used n8n or automation tools.
10. `MCP-R10`: Track first-workflow success rate, clarification turns, validation failures, execution success after generation, and workflows created without opening the raw editor.

## Design Principles For The New MCP Server

- Beginner users should never see raw graph JSON unless they ask for advanced mode.
- Every mutation should have a preview, validation result, and rollback path.
- Every external side effect should be explicit.
- Credentials should be connected through secure UI/OAuth flows where possible, not requested casually in chat.
- Tools should return structured content and plain text fallback.
- Resources should be dynamic where runtime truth matters.
- Prompts should guide user journeys, but tools should own planning, validation, and safety.
- Tool descriptions should be compact, specific, and example-rich.
- Low-level tools should remain available for advanced clients but not dominate beginner mode.
- The MCP server should explain not just what it did, but why the workflow achieves the user's goal.

## Definition Of Done For "Actually Useful For People"

The MCP server becomes genuinely useful for non-technical users when it can:

- understand a plain-language automation goal,
- map it to supported app capabilities,
- ask clarifying questions in normal language,
- securely guide missing integration setup,
- generate a draft workflow,
- explain the draft,
- validate it,
- preview the save,
- apply only after approval,
- test it,
- diagnose failures,
- suggest and apply approved repairs,
- keep all destructive actions reversible,
- hide implementation details unless requested.

That is the difference between exposing automation APIs to an AI client and giving users a real automation copilot.
