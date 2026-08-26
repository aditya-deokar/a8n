# n8n MCP — Audit & Advancement Plan

> **Scope:** full audit of the current MCP server, all MCP tools, MCP Apps UI, and the hosting/transport layer, plus a concrete phase-wise plan for an advanced version that is smaller, cheaper, safer, and actually useful.
> **Method:** live in-memory measurement of the serialized `tools/list` / `resources/list` / `prompts/list` payloads that an LLM host injects into model context (via `InMemoryTransport` + real `createMcpServer` per profile), source review of every `src/mcp/**` domain, widget assets, route/middleware/safety, and the contract manifests. All numbers below are reproducible via `npx vitest run --config vitest.config.mjs tests/mcp/contract/context-budget.test.mjs`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Inventory — What Exists Today](#2-inventory--what-exists-today)
3. [Context-Window Deep Dive (Measured)](#3-context-window-deep-dive-measured)
4. [Are 57 Tools Useful or Just Count Padding?](#4-are-57-tools-useful-or-just-count-padding)
5. [Pros & Cons of a Large Tool Count](#5-pros--cons-of-a-large-tool-count)
6. [MCP Server & Transport Issues](#6-mcp-server--transport-issues)
7. [MCP Apps UI Audit](#7-mcp-apps-ui-audit)
8. [Advanced Version — Design Principles](#8-advanced-version--design-principles)
9. [Phase-Wise Plan](#9-phase-wise-plan)
10. [Proposed Tool Surface After Consolidation](#10-proposed-tool-surface-after-consolidation)
11. [Context Budget Guardrails](#11-context-budget-guardrails)
12. [Risks & Rollback](#12-risks--rollback)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

**Current state is unusually disciplined** for an MCP implementation: 57 tools under a real contract manifest (`src/mcp/contracts/tools.manifest.ts:54-119`), scope-guarded, approval-hashed, redacted, with DB-backed rate limiting and a stateless per-request server (`src/mcp/index.ts:42-85`, `src/app/api/mcp/route.ts:336-345`). That discipline is also why the audit can be precise.

**But it is over-surfaced.** Measured on the wire (`tools/list` JSON of `{name, description, inputSchema}` per tool, the exact payload every host injects into the model):

| Profile (`?profile=`) | Tools | `tools/list` chars | Tokens (js-tiktoken gpt-4o, cl100k) | + `resources/list` | + `prompts/list` | Total static context |
|---|---:|---:|---:|---:|---:|---:|
| `default` | 57 | 28,306 | **6,283** | 5,481 ch / 1,453 tok (21 resources) | 1,015 ch / 217 tok (3 prompts) | **~7,953 tok** |
| `chatgpt` | 28 | 12,904 | **2,790** | 1,453 tok | 217 tok | **~4,460 tok** |
| `embedded_agent` | 31 | 13,023 | **2,817** | 1,453 tok | 217 tok | **~4,487 tok** |

`default` burns ~8k tokens **before the first user message** — 4–6% of a 128k window, 6–8% of 100k, and proportionally more once history/tool-results accumulate. The profile split already halves that cost, which is the single most effective optimization in the codebase; the rest of the plan compounds it.

**6–8 tools are padding** that can be removed or merged into flags without losing capability (`src/mcp/tools/integrations/integration-tools.ts:278-306` etc. — see §4). The built Apps UI ships 4× the same SDK bundle (1.26 MiB total, `dist/mcp-apps/*.html:331k` each) and duplicates data already returned by non-widget tools (see §7). The server has 5 security/process gaps worth fixing before any surface expansion (client-controlled `?profile=` defeats ChatGPT exclusions, unauthenticated traffic is un-rate-limited, DNS-rebinding guards unused, etc. — see §6).

**The advanced version is not "more tools." It is: fewer tools, smaller schemas, lazy discovery, one widget shell, and hardened transport — at roughly half the default-profile token cost while adding real capability.**

---

## 2. Inventory — What Exists Today

### 2.1 Tools (57, `src/mcp/tools/_registry.ts:42-95`)

Registered per profile via `registerAllTools` → domain registrars + `registerChatGptRenderTools` (`src/mcp/apps/render-tools.ts:271-279`).

| Domain | Count | Tools |
|---|---:|---|
| `api_keys` (`src/mcp/tools/api-keys/api-key-tools.ts:1-200`) | 3 | `create_api_key`, `list_api_keys`, `revoke_api_key` |
| `credentials` (`src/mcp/tools/credentials/credential-tools.ts:39-315`) | 6 | `list_credentials`, `get_credential`, `create_credential`, `update_credential`, `delete_credential`, `list_credentials_by_type` |
| `executions` (`src/mcp/tools/executions/*.ts`) | 8 | `list_executions`, `get_execution`, `execute_workflow_and_wait`, `run_workflow_test`, `get_execution_timeline`, `diagnose_execution`, `suggest_workflow_fix`, `apply_workflow_fix` |
| `integrations` (`src/mcp/tools/integrations/integration-tools.ts:160-571`) | 6 | `get_workflow_setup_checklist`, `get_integration_setup_guide`, `get_webhook_url`, `generate_google_form_script`, `test_webhook_setup`, `test_credential` |
| `nodes` (`src/mcp/tools/nodes/node-tools.ts:65-140`) | 2 | `list_node_types`, `search_capabilities` |
| `system` (`src/mcp/tools/system/*.ts`) | 5 | `whoami`, `server_info`, `health_check`, `security_status`, `list_mcp_audit_events` |
| `workflows` (`src/mcp/tools/workflows/*.tool.ts`) | 23 | `create_workflow`, `get_workflow`, `list_workflows`, `update_workflow`, `plan_workflow_from_goal`, `create_workflow_draft`, `answer_workflow_draft_questions`, `validate_workflow_draft`, `explain_workflow`, `preview_workflow_diff`, `apply_workflow_draft`, `rename_workflow`, `delete_workflow`, `execute_workflow`, `list_workflow_versions`, `duplicate_workflow`, `rollback_workflow_version`, `add_workflow_node`, `update_node_config`, `connect_workflow_nodes`, `disconnect_workflow_nodes`, `remove_workflow_node`, `move_workflow_node` |
| `apps` (`src/mcp/apps/render-tools.ts:56-269`) | 4 | `render_workflow_draft_preview`, `render_workflow_setup_checklist`, `render_execution_timeline`, `render_workflow_approval` |

Contract source of truth: `src/mcp/contracts/tools.manifest.ts:54-119` (`MCP_TOOL_CONTRACTS`, 57 entries; `CHATGPT_TOOL_CONTRACTS` = 28; `DEFAULT_TOOL_CONTRACTS` = 57 — `src/mcp/tools/_registry.ts:90` logs `count: 57`).

**Count drift (fix in Phase 0):** header comment says 53 (`src/mcp/tools/_registry.ts:31-39`), `src/mcp/tools/system/system-tools.ts:75` reports 53, `src/mcp/resources/api-docs.resource.ts:36` says "Tools (53 total)" and omits the 4 `render_*` tools, and docs at `docs/mcp/06-tools-reference.md:11` + `docs/mcp/04-architecture.md:63-77` are stale. The contract manifest is authoritative; the rest is drift.

### 2.2 Resources (26 registrations, `src/mcp/resources/_registry.ts:35-48`)

17 static + 5 templates + 4 UI widgets. Static resources are unauthenticated reference data; app templates are scope-checked.

| URI | Mime | Source | Size (approx) | Note |
|---|------|--------|---------------|------|
| `a8n://schema/workflow` | text/markdown | `src/mcp/resources/workflow-schema.resource.ts:64-79` | ~2.4 KB | Workflow JSON shape |
| `a8n://schema/node-types` | text/markdown | `src/mcp/resources/node-types.resource.ts:65-83` | 4–6 KB | Generated from 12 node manifests |
| `a8n://schema/credential-types` | text/markdown | `src/mcp/resources/credential-types.resource.ts:47-65` | ~1.5 KB | 5 credential types |
| `a8n://docs/api` | text/markdown | `src/mcp/resources/api-docs.resource.ts:173-188` | ~7.7 KB | Tool/scope reference (stale count, see above) |
| `a8n://catalog/nodes` | application/json | `src/mcp/resources/catalog.resource.ts:23-48` | 10–20 KB | Machine catalog |
| `a8n://catalog/credentials` | application/json | `src/mcp/resources/catalog.resource.ts:50-68` | <2 KB | Credential catalog |
| `a8n://integrations/{10 services}/setup` (10 URIs) | text/markdown | `src/mcp/resources/catalog.resource.ts:109-128` | 0.3–1 KB ea | Per-service guides |
| `a8n://apps/catalog` | application/json | `src/mcp/resources/app-resources.resource.ts:348-376` | ~0.35 KB | App template catalog |

Templates (scope-checked):

| URI | Source | Scope |
|---|--------|-------|
| `a8n://integrations/{service}/setup` | `src/mcp/resources/catalog.resource.ts:70-107` | none |
| `a8n://apps/workflow-drafts/{draftId}/preview` | `src/mcp/resources/app-resources.resource.ts:378-391` | `workflows:read` |
| `a8n://apps/workflows/{workflowId}/setup-checklist` | `src/mcp/resources/app-resources.resource.ts:393-410` | `workflows:read` |
| `a8n://apps/executions/{executionId}/timeline` | `src/mcp/resources/app-resources.resource.ts:412-425` | `executions:read` |
| `a8n://apps/workflow-drafts/{draftId}/approval` | `src/mcp/resources/app-resources.resource.ts:427-439` | `workflows:read` |

Widget resources (`src/mcp/apps/widget-resources.ts:15-20`, mime `text/html;profile=mcp-app`):

`ui://a8n/workflow-draft-preview.html`, `ui://a8n/workflow-setup-checklist.html`, `ui://a8n/execution-timeline.html`, `ui://a8n/workflow-approval.html` — HTML read from `dist/mcp-apps/*.html` at `resources/read` time (`src/mcp/apps/widget-resources.ts:131-138`).

### 2.3 Prompts (3, `src/mcp/prompts/_registry.ts:19-33`)

| Name | Arg | File | Purpose |
|------|-----|------|---------|
| `create_workflow` | `description` | `src/mcp/prompts/create-workflow.prompt.ts:10-52` | 10-step safe draft→approve playbook |
| `debug_execution` | `executionId` | `src/mcp/prompts/debug-execution.prompt.ts:11-49` | Failure diagnosis steps |
| `setup_integration` | `service` | `src/mcp/prompts/setup-integration.prompt.ts:19-84` | Integration guide (generic fallback for unknown services) |

### 2.4 Auth & Scopes

9 scopes (`src/mcp/auth/scopes.ts:9-30`): `workflows:read|write|execute`, `credentials:read|write`, `executions:read`, `system:read`, `api_keys:manage`, plus `*`. Every tool enforces at least one `requireScope` (`src/mcp/middleware/scope-guard.ts:21-40`); multi-scope tools (e.g., `execute_workflow_and_wait` at `src/mcp/tools/executions/execution-runtime-tools.ts:311-312`) check both. OAuth tokens always grant the full ChatGPT app set regardless of requested subset (`src/mcp/auth/oauth.service.ts:249-263`). Session tokens receive `ALL_SCOPES` (`src/mcp/auth/bearer-auth.middleware.ts:92`). Profile selection is client-controlled via `?profile=` / `?mcp_app_profile=` / `MCP_APP_PROFILE` env (`src/mcp/app-profile.ts:10-16`, read at `src/app/api/mcp/route.ts:94-99`) — see §6 for the escalation implication.

### 2.5 Transport

Stateless Streamable HTTP: fresh `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })` + fresh `McpServer` per request for `POST`/`GET`/`DELETE` (`src/app/api/mcp/route.ts:336-345`, `407-475`; factory `src/mcp/index.ts:42-85`). Horizontal-scale friendly by design (`docs/mcp/09-design-decisions.md:23-46`).

---

## 3. Context-Window Deep Dive (Measured)

### 3.1 How the cost is incurred

An MCP host performs `initialize` → `tools/list` → injects every returned `{name, description, inputSchema}` into the model's system / function-calling context. `resources/list` and `prompts/list` descriptors are similarly injected by hosts that surface them (ChatGPT Apps, Cursor, Claude Desktop all do). Tool *results* and `resources/read` bodies are additional per-turn costs. So `tools/list` is the dominant **static** cost paid on every turn.

### 3.2 Measured static cost (wire-faithful, `tools/list` JSON)

Harness: `tests/mcp/contract/context-budget.test.mjs:1-80` — real server factory over `InMemoryTransport`, real `Client.listTools()` / `listResources()` / `listPrompts()`, serialized as `JSON.stringify({name, description, inputSchema})` per tool (the SDK's on-wire shape), tokenized with `js-tiktoken` (`gpt-4o` / `cl100k_base`, ~4 chars/token fallback when unavailable). Run: `npx vitest run --config vitest.config.mjs tests/mcp/contract/context-budget.test.mjs`.

| Profile | Tools | `tools/list` bytes | `tools/list` tokens | Heaviest single tool | Lightest |
|---|---:|---:|---:|---|---|
| **default** | 57 | 28,306 | **6,283** | `update_workflow` 344 tok / 1,497 ch | `server_info` 56 tok / 261 ch |
| **chatgpt** | 28 | 12,904 | **2,790** | `create_workflow_draft` 169 tok | `server_info` 56 tok |
| **embedded_agent** | 31 | 13,023 | **2,817** | `create_workflow_draft` 169 tok | `server_info` 56 tok |

Additional static lists (same for all profiles — not profile-gated today, `src/mcp/resources/_registry.ts:45-46`):

| List | Items | Bytes | Tokens |
|------|------:|------:|-------:|
| `resources/list` descriptors | 21 | 5,481 | 1,453 |
| `prompts/list` descriptors | 3 | 1,015 | 217 |

**Total static injection per profile**

| Profile | Tools tok | + Resources | + Prompts | **Total** | Share of 128k | Share of 100k | Share of 32k |
|---|---:|---:|---:|---:|---:|---:|---:|
| default | 6,283 | 1,453 | 217 | **~7,953** | 6.2% | 8.0% | 24.9% |
| chatgpt | 2,790 | 1,453 | 217 | **~4,460** | 3.5% | 4.5% | 13.9% |
| embedded_agent | 2,817 | 1,453 | 217 | **~4,487** | 3.5% | 4.5% | 14.0% |

Per-tool ranking (default, descending tokens — full table from harness stdout):

```
344 tok  1497 ch  update_workflow
212 tok   845 ch  add_workflow_node
202 tok   836 ch  create_api_key
188 tok   789 ch  create_credential
169 tok   797 ch  create_workflow_draft
162 tok   699 ch  run_workflow_test
158 tok   665 ch  execute_workflow_and_wait
158 tok   766 ch  test_credential
148 tok   594 ch  update_credential
143 tok   683 ch  apply_workflow_draft
... (57 rows; see harness log at C:\Users\adity\AppData\Local\Temp\opencode\ctx-budget.log)
 58 tok   275 ch  whoami
 56 tok   261 ch  server_info
```

Takeaway: the cost is **heavily skewed** — the top 10 tools consume ~1,750 tokens (28% of the total) while the bottom 10 consume ~620. The single heaviest tool (`update_workflow`) costs 6× the lightest.

### 3.3 Why `default` is 2.2× `chatgpt`

`default` alone carries: all 6 credential admin tools minus 1, all 5 system tools minus 2, `update_workflow` (344 tok — the heaviest tool), `delete_workflow`/`delete_credential`/`revoke_api_key`, the 6 partial-edit node tools (`add/update/connect/disconnect/remove/move` — 95–212 tok each), execution listing helpers, and webhook helpers. ChatGPT/embedded profiles were intentionally curated (`src/mcp/tools/chatgpt-profile.ts:69`, `src/mcp/tools/embedded-agent-profile.ts:88`) and prove the curation works: **29 fewer tools save ~3,500 tokens (~55% of default's tool cost) with no loss of the core draft→validate→preview→apply loop.**

### 3.4 Hidden per-turn costs

Beyond `tools/list`, each turn can add:

* **Tool result payloads.** Typical `get_workflow` / `get_execution_timeline` / `diagnose_execution` responses are 2–8 KB. Draft validation payloads include `missingFields`, `validation.errors`, `status`, and graph summaries. Approval-gated writes return a diff + `confirmationHash` that is re-sent on the confirming call.
* **Approval double-call.** Every write pays two tool-call turns (preview → apply) by design (`src/mcp/safety/approval-guard.ts:35-117`). Useful for safety, but doubles the token cost of writes vs reads.
* **Widget duplication.** `render_*` tools return the same data already available via non-widget tools *plus* a copy in `_meta.details` (`src/mcp/apps/render-tools.ts:51`), and the same data a third time as `a8n://apps/...` template resources (`src/mcp/resources/app-resources.resource.ts:378-439`). A model following `validate → preview_workflow_diff → render_workflow_approval` sees the diff/validation payload 2–3×.
* **Widget assets are host-side, not model-side** — the 331 KB HTML bundles (`dist/mcp-apps/*.html`) are fetched by the host via `resources/read`, not injected into the model. Their model-side cost is only the tool + resource descriptors (~72 tok each for `render_*` tools) plus the compact `structuredContent`/`_meta.details` echo. The 1.26 MiB duplication matters for host load time, not context — but it blocks any "add more widgets" scaling (see §7).

### 3.5 Resource & prompt contents (not auto-injected, but one `resources/read` away)

If the model follows a prompt or reads a resource, that content enters context:

* `a8n://docs/api` — ~7.7 KB (~1,900 tok) — notably stale (see §2.1).
* `a8n://schema/workflow` — ~2.4 KB; `a8n://catalog/nodes` — 10–20 KB if the model fetches the machine catalog instead of using `search_capabilities`.
* Prompt bodies (`src/mcp/prompts/*.ts`) — each is a ~1–2 KB instruction template expanded with the caller's argument; `create_workflow` prompt is the longest (10-step playbook).

These are not part of the static 7,953 tok baseline, but a single `resources/read` of the catalog can add as much as all prompts combined.

### 3.6 What the numbers mean for model behavior

* **Function-calling accuracy degrades with tool count** (well-documented across providers; OpenAI recommends ≤20 tools for best selection accuracy, Anthropic similarly). At 57 tools, the model must discriminate among 4 execution triggers, 6 partial-edit ops, and 8 draft-adjacent tools — selection errors are not hypothetical, they are expected.
* **Cost.** At typical hosted pricing, 6,283 tool-definition tokens billed on every turn of a multi-turn workflow (draft → answer → validate → preview → apply → checklist → test → timeline) compounds quickly. Halving to ~3k saves real money at scale.
* **Latency.** Larger `tools/list` JSON means larger `initialize` responses and more work for the host's tool-router. Per-request server construction already pays 57 Zod schema builds (`src/app/api/mcp/route.ts:341`); fewer schemas = faster cold starts.

---

## 4. Are 57 Tools Useful or Just Count Padding?

**Honest answer: ~49 are real capabilities, ~6–8 are padding that can be removed or merged into flags** without losing any user-facing task. The detailed redundancy analysis is below; each bullet cites the file and lines so it can be verified.

### 4.1 Clearly useful (keep)

* **Draft pipeline** (`plan_workflow_from_goal`, `create_workflow_draft`, `answer_workflow_draft_questions`, `validate_workflow_draft`, `preview_workflow_diff`, `apply_workflow_draft`, `explain_workflow` — `src/mcp/tools/workflows/workflow-drafts.tool.ts:325-727`): the safe, non-destructive authoring path. Each step has a distinct role; keep all 7.
* **Versioning & rollback** (`list_workflow_versions`, `rollback_workflow_version` — `src/mcp/tools/workflows/workflow-versioning.tool.ts:142-340`): safety net for every mutation; one version row per partial edit is heavy but correct. Keep.
* **Partial-edit ops** (`add_workflow_node`, `update_node_config`, `connect_workflow_nodes`, `disconnect_workflow_nodes`, `remove_workflow_node` — `src/mcp/tools/workflows/workflow-versioning.tool.ts:342-558`): validated, diffed, approval-hashed single-step edits. Justified for interactive UX; they are thin wrappers over `previewOrApplyMutation` (`:53-140`) which is well-factored. Keep 5 of 6 (see `move_workflow_node` below).
* **The one true executor** (`execute_workflow_and_wait` — `src/mcp/tools/executions/execution-runtime-tools.ts:294-381`): trigger + poll with `timeoutMs`/`pollMs`/`initialData`. This is the superset; keep.
* **Execution inspection** (`get_execution_timeline`, `diagnose_execution` — `src/mcp/tools/executions/execution-runtime-tools.ts:472-569`): timeline is the base, diagnosis adds classification/suggested action. Overlap is real (diagnose returns the timeline too, `:554-565`) but cheap — the two together are justified. Keep both, but dedupe internals (see Phase 1).
* **Credentials** (`list_credentials`, `get_credential`, `create_credential`, `update_credential`, `delete_credential` — `src/mcp/tools/credentials/credential-tools.ts:39-277`): CRUD with encrypted `value` handling and `SAFE_CREDENTIAL_SELECT` (`:29-35`) consistently applied. Keep 5 of 6 (see `list_credentials_by_type` below).
* **System** (`whoami`, `server_info`, `health_check` — `src/mcp/tools/system/system-tools.ts:30-140`): identity/capability/health trinity. Keep.
* **Nodes** (`list_node_types`, `search_capabilities` — `src/mcp/tools/nodes/node-tools.ts:65-140`): catalog + semantic search. Keep (or consolidate search into a flag on `list` — see Phase 1 option).
* **`test_credential`** (`src/mcp/tools/integrations/integration-tools.ts:411-571`, `live` flag): dry-run shape check + live provider verification (OpenAI header vs Gemini `?key=` — inconsistency noted at `:541-543`). Keep as the one credential-test tool.

### 4.2 Padding / merge candidates (remove or fold into a flag)

Ranked weakest first (most certain padding → borderline):

| # | Tool | File:Line | Why it is padding | Replacement |
|---|------|-----------|-------------------|-------------|
| 1 | **`get_webhook_url`** | `src/mcp/tools/integrations/integration-tools.ts:278-306` | Template string `${base}/api/webhooks/{path}?workflowId={id}` (`:42-45`) behind an ownership check. The same URL already appears inside `get_workflow_setup_checklist` (`:190-206`) and `generate_google_form_script` (`:326`). 89 tok for a string interpolation. | Remove; ensure checklist always includes the URL (it already does). |
| 2 | **`get_integration_setup_guide`** | `src/mcp/tools/integrations/integration-tools.ts:251-276` | Thin pass-through to a manifest lookup + two static policy strings; duplicates the resource `a8n://integrations/{service}/setup` (`src/mcp/resources/catalog.resource.ts:109-128`). 94 tok. | Remove; keep the resource. Optionally add `?includeGuide=true` to checklist for callers that want guide + checklist in one call. |
| 3 | **`test_webhook_setup`** | `src/mcp/tools/integrations/integration-tools.ts:345-409` | 90% overlap with `run_workflow_test`; unique content is two canned payloads (`sampleGoogleFormPayload`/`sampleStripePayload` `:47-106`) and a URL echo. 121 tok + a second sample-payload triplication (vs `execution-runtime-tools.ts:30-67`). It even misdirects `nextStep` to "use execute_workflow_and_wait with eventId" (`:404`) which would start a *new* run instead of `get_execution_timeline`. | Merge into `run_workflow_test` via `trigger ∈ {manual, google_form, stripe}` (already exists) + `sampleData` override; remove this tool. |
| 4 | **`execute_workflow`** | `src/mcp/tools/workflows/workflow-mutations.tool.ts:120-180` | Fire-and-forget mode of `execute_workflow_and_wait`. Its own response recommends the superset (`:168`). Identical server effect to `run_workflow_test(wait=false)`. Keep as audience convenience only if the extra 126 tok is deemed worth it — the audit says no. | Remove from `default`; callers can use `execute_workflow_and_wait` and ignore `wait` or `run_workflow_test(wait=false)`. |
| 5 | **`plan_workflow_from_goal`** | `src/mcp/tools/workflows/workflow-drafts.tool.ts:325-347` | Pure planner (`planFromGoal` `:60-142`) behind a tool; `create_workflow_draft` already runs the identical planner (`:384`) and persists. 128 tok for a `dryRun` that could be a flag. | Keep if the free, no-DB preview is valued; otherwise fold as `create_workflow_draft(dryRun=true)` that returns the plan without persisting. Borderline — leans keep. |
| 6 | **`move_workflow_node`** | `src/mcp/tools/workflows/workflow-versioning.tool.ts:560-595` | Cosmetic position change wearing full validation → diff → approval → version-snapshot machinery. 126 tok + a DB version row per drag. | Remove or downgrade to non-approval, no-snapshot cosmetic op (or fold into `update_node_config` with `position` field). |
| 7 | **`list_credentials_by_type`** | `src/mcp/tools/credentials/credential-tools.ts:281-315` | One extra `where: { type }` (`:301-308`) on `list_credentials` (`:67-74`). 95 tok. | Remove; add `type?` filter param to `list_credentials`. |
| 8 | **`generate_google_form_script`** | `src/mcp/tools/integrations/integration-tools.ts:308-343` | Thin wrapper around `generateGoogleFormScript(webhookUrl)` (`:331`) + static setup steps; recomputes the same URL as `get_webhook_url`. Borderline keep because the script is actionable. | Keep or merge script output into checklist's `webhookSteps`. |

**Honest count:** removing #1–4 + #6–7 saves **6 tools, ~700 tokens, and eliminates 3 duplicated code paths** with zero capability loss. Including the borderline #5/#8 takes it to 8 tools / ~900 tok.

### 4.3 Structural duplication that inflates count without adding value

* **Execution triggering: 4 tools do the same `sendWorkflowExecution`.** `execute_workflow` (`workflow-mutations.tool.ts:120-180`), `execute_workflow_and_wait` (`execution-runtime-tools.ts:294-381`), `run_workflow_test` (`:383-470`), `test_webhook_setup` (`integration-tools.ts:345-409`) all call `sendWorkflowExecution` with `testMode/testSource` variations (compare `:427-432` vs `integration-tools.ts:390-395`). Collapse to 2: "trigger" + "trigger with sample data + wait."
* **Graph mutation: 3 parallel write systems.** Full-replace `update_workflow` (`src/mcp/tools/workflows/update-workflow.tool.ts:20-138`, no validation/approval/diff — `admin_or_destructive`, `forbiddenInChatGpt`) vs 6 validated partial-edits vs `apply_workflow_draft`/`apply_workflow_fix` bulk replaces. `update_workflow` and the draft/fix bulk replaces do the same full graph replace; `update_workflow` just skips the guards. Keep the guarded paths; `update_workflow` survives only by being excluded from ChatGPT profiles (`src/mcp/contracts/tools.manifest.ts:94`).
* **Failure repair: 2 draft pipelines.** `create_workflow_draft`+`apply_workflow_draft` vs `suggest_workflow_fix`+`apply_workflow_fix` (`execution-runtime-tools.ts:571-751`). `suggest_workflow_fix` is `create_workflow_draft` seeded from an execution (`:594-606` hand-maps workflow→graph instead of using `getWorkflowGraph` at `src/mcp/tools/workflows/workflow-graph-utils.ts:366-387`, written 3×); `apply_workflow_fix` is `apply_workflow_draft` that hashes full `nodes+edges` (`:677-684`) instead of a diff (`workflow-drafts.tool.ts:658-663`). Product framing aside, these are clones with drift bugs (non-transactional write at `:721-731`, diff-less preview at `:701-706`, missing `saveDraftRevision` at `:613-630`).
* **Read-path triples.** `checklist.webhookSteps` vs `get_webhook_url` vs `generate_google_form_script` all emit the same URL; `get_integration_setup_guide` duplicates an existing resource. See table above.

---

## 5. Pros & Cons of a Large Tool Count

### Pros (why 57 was built)

* **Single-call convenience.** Every task has a dedicated, self-documenting tool; callers don't need to learn flag combinations or multi-step encodings.
* **Scope granularity.** Finer tools allow finer scope gating (e.g., `get_webhook_url` at `workflows:read` vs credential writes at `credentials:write`). In practice the scope lattice is already 9 scopes (`src/mcp/auth/scopes.ts:9-30`), so per-tool scope benefits are marginal once tools are grouped.
* **Profile curation safety.** `forbiddenInChatGpt` + per-profile registrars (`src/mcp/tools/chatgpt-profile.ts:41-44`, `src/mcp/tools/_registry.ts:46-59`) let dangerous tools (`delete_*`, `revoke_api_key`, `update_workflow`) be excluded from ChatGPT without forking the whole server.
* **Analytic signal.** Per-tool audit events and observability counters (`src/mcp/observability/runtime-guardrails.ts:78-98`) are naturally per-tool.

### Cons (why large hurts — and dominates)

| Dimension | Effect at 57 tools | Evidence |
|-----------|-------------------|----------|
| **Context tax** | ~6,283 tok static for `default` (2.2× `chatgpt`'s 2,790). Top 10 tools = 28% of cost. | §3.2 harness |
| **Selection accuracy** | Model must pick among 4 triggers, 6 partial-edits, 8 draft-adjacent tools. OpenAI/Anthropic guidance caps at ~20 tools for reliable selection. | 57 >> 20 |
| **Latency** | 57 Zod schema builds per request (`src/app/api/mcp/route.ts:341` + `src/mcp/index.ts:53` — fresh server per request). | Per-request construction |
| **Cost** | Tool-definition tokens billed every turn of every multi-step flow (≈7 turns for draft→apply→test). | §3.4 |
| **Maintenance** | 5 copies of the validate→diff→hash→approval→snapshot→replace skeleton across 3 files (`workflow-drafts.tool.ts:639-724`, `workflow-versioning.tool.ts:53-140`+`260-337`, `execution-runtime-tools.ts:662-748`). Drift bugs already present (non-transactional `apply_workflow_fix` `:721-739` vs transactional `apply_workflow_draft` `:701-712`). | §4.3 |
| **Security surface** | Each tool is a scope-gated entry point; more tools = more `requireScope` call sites to keep in sync (59 calls today). `forbiddenInChatGpt` enforcement is registration-time only and bypassable via `?profile=default` (see §6). | `src/mcp/auth/scopes.ts:50-56` |
| **Discovery** | `search_capabilities` (`src/mcp/tools/nodes/node-tools.ts:92-140`) already exists to compensate for not being able to surface all 12 node types + templates as tools — an admission that the tool list is too large to browse. | `search_capabilities` exists |

**Verdict:** the pros are real but saturate early; the cons scale linearly with count. The `chatgpt` profile (28 tools) is proof that half the surface delivers the whole workflow. The advanced version should treat 20–30 focused tools plus a discovery/search mechanism as the target, not 57+.

---

## 6. MCP Server & Transport Issues

### 6.1 What is solid (keep)

* Stateless per-request server (`src/app/api/mcp/route.ts:336-338`, `src/mcp/index.ts:8-9`) — correctly trades a small construction cost for horizontal scalability (AD-1, `docs/mcp/09-design-decisions.md:23-46`).
* Three coherent auth methods (API key HMAC, OAuth access token, better-auth session) with proper hash lookups and revocation/expiry checks (`src/mcp/auth/bearer-auth.middleware.ts:54-150`, `src/mcp/auth/api-key.service.ts:112-150`, `src/mcp/auth/oauth.service.ts:740-791`).
* Contract manifest + policy gap analysis (`src/mcp/contracts/tools.manifest.ts:54-119`, `src/mcp/policy/security-policy.ts:53-75`), approval hashing (`src/mcp/safety/approval-guard.ts:12-17`), output redaction (`src/mcp/shared/sanitize.ts:13-104`), egress filtering, and DB-backed production rate limiting (`src/mcp/middleware/rate-limiter.ts:133-169`).

### 6.2 Issues to fix (before expanding the surface)

| # | Issue | File:Line | Impact | Fix |
|---|-------|-----------|--------|-----|
| 1 | **Profile escalation via `?profile=`** — `forbiddenInChatGpt` is enforced only at registration per profile (`src/mcp/tools/_registry.ts:46-73`), but profile is client-controlled (`src/app/api/mcp/route.ts:94-99`). An OAuth token (granted `workflows:write` at `src/mcp/auth/oauth.service.ts:12-19`) can call `?profile=default` to reach `delete_workflow`/`delete_credential`/`update_workflow` etc. | `src/app/api/mcp/route.ts:94-99`, `src/mcp/tools/_registry.ts:46-59` | Privilege escalation | Bind allowed profiles to the auth method/client (e.g., `a8n_oauth_at_*` → force `chatgpt`; API keys → `default` unless explicitly allowlisted). See Phase 4. |
| 2 | **Unauthenticated traffic is never rate-limited** — `authenticateRequest` returns 401 before the rate-limit step. | `src/app/api/mcp/route.ts:237-292` | Token-guessing is unlimited (only a passive alert at ≥20 failures, `src/mcp/config.ts:60`) | Rate-limit *before* auth on IP (or a cheap global bucket), then re-check post-auth on `apiKeyId||userId`. |
| 3 | **DNS-rebinding guards unused** — SDK exposes `enableDnsRebindingProtection`/`allowedHosts`/`allowedOrigins` (`webStandardStreamableHttp.d.ts:84-96`) but all 3 transport constructions omit them; custom Origin check (`src/app/api/mcp/route.ts:43-92`) only runs when `Origin` is present (`:51`). | `src/app/api/mcp/route.ts:336-338,418-420,463-465` | Host-header attacks in non-browser contexts | Enable SDK guards with `MCP_ALLOWED_HOSTS` / `MCP_CORS_ORIGINS`. |
| 4 | **Kill-switch fails open on unparseable body** — `rejectMcpMutationWhenDisabled` swallows JSON parse errors and returns `null` (= allow). | `src/app/api/mcp/route.ts:170-175` | Mutations slip past the kill switch | Return *deny* on parse failure when the flag is enabled. |
| 5 | **SDK `authInfo` channel unused** — `transport.handleRequest` never passes `options.authInfo` although the SDK forwards it into `extra` for handlers. Tools rely on the closure fallback (`src/mcp/shared/auth-context.ts:13-18`). | `src/app/api/mcp/route.ts:345,425,470` | Silent breakage if a singleton server is ever introduced; non-idiomatic | Pass `{ authInfo: auth }` as `handleRequest` options and prefer `extra.authInfo` in handlers. |
| 6 | **Per-request server cost** — 57 Zod builds + 26 resource + 3 prompt registrations on every POST/GET/DELETE, even though `DELETE` is a documented no-op and standalone SSE via `GET` is unusable in stateless mode. | `src/app/api/mcp/route.ts:407-475` | Wasted CPU | Cache the tool/resource *definitions* (schemas are pure); only re-bind the auth closure per request, or short-circuit GET/DELETE to not build a server. |
| 7 | **Count drift across surfaces** — `server_info` reports 53 tools (`src/mcp/tools/system/system-tools.ts:75`), `a8n://docs/api` says 53 and omits `render_*`, registry comment says 53 vs logged 57, resource registry logs `count:21 templates:5` vs actual 26. | `src/mcp/tools/system/system-tools.ts:75`, `src/mcp/resources/api-docs.resource.ts:36`, `src/mcp/tools/_registry.ts:31,90`, `src/mcp/resources/_registry.ts:56-59` | Drift erodes trust in docs and health endpoints | Derive all counts from `MCP_TOOL_CONTRACTS` / `MCP_RESOURCE_CONTRACTS` at runtime (Phase 0). |
| 8 | **Expired OAuth CSRF store is in-memory** (`src/mcp/auth/oauth-csrf.ts:3-4`) — single-instance only, unlike the DB-backed rate limiter which was explicitly engineered for multi-instance. | `src/mcp/auth/oauth-csrf.ts:3-4` | CSRF state lost on rolling deploys | Move to DB or signed stateless CSRF (HMAC). |
| 9 | **No TTL / single-use enforcement on `confirmationHash`** — hash is `sha256(JSON.stringify(payload)).slice(0,16)` (`src/mcp/safety/approval-guard.ts:12-17` and duplicate at `src/mcp/tools/workflows/workflow-graph-utils.ts:57-62`), unkeyed, 64-bit, no expiry, no consumption registry; denial response *returns* the expected hash (`:92-105`) so any agent can self-complete the two-step dance; concurrent duplicate applies both succeed. | `src/mcp/safety/approval-guard.ts:35-117` | Approval proves payload identity, not human consent; replay window is indefinite | Add TTL + single-use consumption (DB row or in-memory with DB fallback) and never return the hash in the denial — return an opaque `approvalId` instead (Phase 2). |
| 10 | **Fail-open on contract flags** — if a tool calls `requireToolApproval` but its contract lacks gating flags, the guard returns `{approved:true}` with no log. | `src/mcp/safety/approval-guard.ts:59-61` | Safety depends on manifest bookkeeping | Fail closed (throw) when flags are absent; add a contract-coverage test (already partially at `tests/mcp/contract/tool-manifest.test.mjs:45-51`). |

Lower-priority hygiene: `MCP_BEARER_TOKEN` declared but unused (`src/env.ts:137`), `MCP_SAFETY_STRICT_MODE` parsed but never gates behavior (`src/mcp/config.ts:71`), `GET` error path swallows exceptions and dumps `server_info` JSON (`src/app/api/mcp/route.ts:427-446`), audit persistence is fire-and-forget (`src/mcp/middleware/audit-logger.ts:274`), and the in-memory rate limiter's `identifier = apiKeyId || userId` is per-key not per-IP for `/api/mcp` (intentional) while OAuth routes use IP — document the split.

---

## 7. MCP Apps UI Audit

### 7.1 How it works

Four `render_*` tools (`src/mcp/apps/render-tools.ts:56-269`) are `registerAppTool` registrations with `_meta.ui.resourceUri` (`src/mcp/apps/widget-resources.ts:114-129`). Each returns compact `structuredContent` + a copy in `_meta.details` via `sanitizeOutput` (`src/mcp/shared/sanitize.ts:70-104`), plus `_meta.widget {resourceUri, generatedAt}`. Four `ui://a8n/*.html` resources (`src/mcp/apps/widget-resources.ts:15-20`, mime `text/html;profile=mcp-app`) serve the built bundles from `dist/mcp-apps/*.html` at `resources/read` (`:131-138`). Host loads the HTML, which runs an ext-apps `App` that calls `app.connect(new PostMessageTransport(window.parent, window.parent))` (`src/mcp/apps/ui/shared/bridge.ts:40-95`) and subscribes to `ontoolinput/ontoolresult/onhostcontextchanged/onteardown`. Reverse calls use `app.callServerTool()` for `apply_workflow_draft`, `test_credential`, `test_webhook_setup`, `diagnose_execution`.

Capability detection: `hasUiCapability` (`src/mcp/shared/capability-guard.ts:28-54`) is unconditional for `chatgpt`/`embedded_agent`, otherwise checks `io.modelcontextprotocol/ui` + mime. `createMcpServer` also hooks `oninitialized` to re-register widget resources when the capability is detected (`src/mcp/index.ts:57-82`) — redundant since `registerAllResources` already registers them unconditionally (`src/mcp/resources/_registry.ts:45-46`), so capable clients register widgets twice.

### 7.2 What each widget renders

| Widget (`src/mcp/apps/ui/*/mcp-app.ts`) | Renders |
|------------------------------------------|---------|
| `workflow-draft-preview` (`:47-88`) | Title, status pill, Summary (`beginnerExplanation`), Steps list, Validation panel |
| `workflow-setup-checklist` (`:53-158`) | Credentials (configured/missing pills), Webhooks (`<code>` URLs), Test steps, "Test credentials/webhooks" buttons |
| `execution-timeline` (`:46-129`) | Status/Duration cards, node-by-node list with success/needs_diagnosis pills, Error panel, "Diagnose failure" button (FAILED only) |
| `workflow-approval` (`:58-134`) | Added/changed/removed node counts, `confirmationHash` `<code>`, "Apply draft" button (disabled unless `validation.valid` and handshake complete) |

Shared styling at `src/mcp/apps/ui/shared/styles.css:1-220` (pill tones `:151-164`, 520px breakpoint `:205-217`); helpers at `src/mcp/apps/ui/shared/utils.ts:12-66` (`escapeHtml`, `safeText` secret-redaction) and `src/mcp/apps/ui/shared/bridge.ts:40-128`.

### 7.3 Measured cost

| Asset | Size |
|-------|------|
| `dist/mcp-apps/workflow-draft-preview.html` | 331,127 B |
| `dist/mcp-apps/workflow-setup-checklist.html` | 331,439 B |
| `dist/mcp-apps/execution-timeline.html` | 331,183 B |
| `dist/mcp-apps/workflow-approval.html` | 331,140 B |
| **Total** | **1,324,889 B (~1.26 MiB)** |

Built via `vite-plugin-singlefile` (`scripts/build-mcp-apps-ui.ts:16,41`) — each widget inlines the full ext-apps SDK + zod v4 + CSS/JS. The SDK+zod (~330 KB) is duplicated 4×; the four files differ by only ~300 B of unique logic. Model-side cost per `render_*` tool is ~72 tok (`render_execution_timeline` etc. in §3.2) plus the echoed `_meta.details`; host-side cost is the 331 KB fetch per widget.

Template resources at `src/mcp/resources/app-resources.resource.ts:378-439` serve the same data a second way (HTML + `#markdown` bundle per template) — a model traversing `validate → preview_workflow_diff → render_workflow_approval` sees the diff 2–3×.

### 7.4 Issues

| # | Issue | File:Line | Detail |
|---|-------|-----------|--------|
| 1 | **4× bundle duplication** | `scripts/build-mcp-apps-ui.ts:16,41`, `dist/mcp-apps/*.html` | `vite-plugin-singlefile` per widget duplicates SDK+zod. Fix: single shared shell + per-widget entry (Phase 3). |
| 2 | **Data duplication 2–3×** | `src/mcp/apps/render-tools.ts:51`, `src/mcp/resources/app-resources.resource.ts:313-319` vs `src/mcp/tools/workflows/workflow-drafts.tool.ts:587-604`, `src/mcp/tools/executions/execution-runtime-tools.ts:472-511` vs `src/mcp/tools/integrations/integration-tools.ts:160-245` | `render_execution_timeline._meta.details` duplicates `get_execution_timeline`; `render_workflow_setup_checklist` duplicates `get_workflow_setup_checklist` with divergent field sets; `render_workflow_approval._meta.details` duplicates `preview_workflow_diff` including a copy-pasted `confirmationSummary`/`stableHash` (drift risk for a security hash). Template resources duplicate them a third time. |
| 3 | **App-instance race** | `src/mcp/apps/ui/execution-timeline/mcp-app.ts:133,155-158` (same in approval `:138,160-164`, checklist `:162,184-188`) | `appInstance` assigned async after `initWidget`; if `ontoolresult` fires before handshake, the only render runs with `app===null` — interactive buttons never created or "Apply" permanently disabled. No re-render when the app later connects. |
| 4 | **Swallowed errors, no user-visible state** | `src/mcp/apps/ui/*/mcp-app.ts:159/164/188/118` (`.catch(()=>undefined)`), `src/mcp/apps/ui/shared/bridge.ts:93` | No error UI; no timeout on `app.connect()` — "Loading" forever if host never answers `ui/initialize`. |
| 5 | **Manual HTML escaping, footgun panel helper** | `src/mcp/apps/ui/shared/utils.ts:12-66` (`escapeHtml`, `safeText`, `panel(title,body)` escapes only title) | `safeText`'s `(api[_ -]?key\|token\|secret)` regex over-redacts benign "token count" text; future `panel` callers can XSS by passing unescaped body. |
| 6 | **No CSP in built HTML** | `dist/mcp-apps/*.html` (0 matches for `http-equiv`) | Relies on host's `_meta.ui.csp`; standalone preview (`scripts/capture-widget-screenshots.ts:131`) runs with no CSP. `CHATGPT_WIDGET_CSP` at `src/mcp/apps/widget-resources.ts:12-13` (`script-src 'unsafe-inline'`) is exported but used only by a stale e2e test. |
| 7 | **`targetOrigin "*"` postMessage** | `src/mcp/apps/ui/shared/bridge.ts:93` via SDK `PostMessageTransport` (`ext-apps@1.7.5 dist/src/app.js`) | Broadcasts sanitized-but-sensitive payloads to any hosting frame; no origin allowlist. Compensate with domain pinning beyond `_meta.ui.domain` (`src/mcp/apps/widget-resources.ts:97`) if threat model requires. |
| 8 | **Stale/broken e2e** | `tests/e2e/mcp/widgets.spec.ts:43-78` | Stubs legacy `window.openai` bridge, asserts a CSP meta equal to the dead `CHATGPT_WIDGET_CSP`, and expects render without a host — cannot pass against current `dist`. Hidden because `test:mcp` runs vitest only (`vitest.config.mjs:20-21`) and widgets rebuild is separate. |
| 9 | **Dead code & drift** | `src/mcp/resources/_registry.ts:48` (`supportsUi=true` never used, `hasUiCapability` imported but unused `:33`), `src/mcp/apps/widget-resources.ts:10-13` (stale `CHATGPT_WIDGET_CSP`/`MCP_APP_WIDGET_MIME_TYPE` per `docs/mcp/mcp-apps/13-ext-apps-integration-plan.md:940-961`), `src/mcp/apps/index.ts` (barrel omits `submission-assets`) | Migration plan acceptance criteria ("No dead code remains" `:965`) not met. |
| 10 | **Filesystem read per `resources/read`** | `src/mcp/apps/widget-resources.ts:131-138` | No caching of the 331 KB HTML. |
| 11 | **Base-URL inconsistency** | `src/mcp/apps/submission-assets.ts:181-186` vs `src/mcp/resources/app-resources.resource.ts:31-38` vs env precedence for `NEXT_PUBLIC_APP_URL`/`APP_URL`/`NEXT_PUBLIC_WEBHOOK_BASE_URL` | Advertised `connectDomains` in widget CSP can disagree with actual webhook URLs. |
| 12 | **Submission-assets is metadata only** | `src/mcp/apps/submission-assets.ts:28-242` | Performs no network I/O despite the name; it builds the ChatGPT app-store submission JSON. Minor: `termsUrl` aliases `supportUrl` (`:210`). |

Accessibility: pill tones are text-redundant (good), but status updates lack `aria-live`, wholesale `innerHTML` replacement destroys focus, and the fullscreen toggle appears but is never hidden again (`src/mcp/apps/ui/shared/bridge.ts:108-117`).

---

## 8. Advanced Version — Design Principles

1. **Fewer, denser tools.** Target 30–35 tools for `default` (from 57) and keep `chatgpt` at ~20–24. Every remaining tool must justify its token cost with distinct capability; thin wrappers become flags on their parent tool.

2. **Context efficiency is a feature.** Treat `tools/list` token count as a budget, not a vanity metric. Measure in CI, gate PRs that grow it without justification, and prefer `search`/`discover` over enumeration.

3. **Lazy discovery over upfront enumeration.** Hosts that support `tools/list` filtering or a `search_tools` meta-tool can avoid loading all schemas. Until the SDK standardizes that, ship a `search_capabilities`-style discovery tool and keep heavy schemas (workflow graph, node catalog) behind `resources/read`, not inline in every tool description.

4. **One widget runtime, many views.** Unify the 4 singlefile bundles into one shell + 4 view modules. Deduplicate data at the source: a `render_*` result should reference (or omit) data already returned by the companion tool, not re-embed it.

5. **Approval proves consent, not just payload identity.** Replace the hash-echo pattern with an opaque, single-use, TTL-bound approval token that must be obtained via an explicit user gesture (host-mediated where available).

6. **Profile is an auth property, not a query param.** What a client can do must be determined by who it is (token/client), not by what `?profile=` it sends.

7. **Stateless, but not wasteful.** Cache what is pure (schemas, resource descriptors); only bind per-request what varies (auth). Don't build a full server for `DELETE`.

---

## 9. Phase-Wise Plan

### Phase 0 — Measure & Guard (1–2 days, no user-visible change)

**Goal:** make context cost visible and prevent drift.

| Step | Action | Files | Done when |
|------|--------|-------|-----------|
| 0.1 | Keep `tests/mcp/contract/context-budget.test.mjs` as a regression guard. Add assertions: `default` tools ≤57, tools tokens ≤6,500; `chatgpt` tools = `CHATGPT_TOOL_CONTRACTS.length` (28) ± budget; `resources/list` count = `MCP_RESOURCE_CONTRACTS.length`. Make it fail CI on growth. | `tests/mcp/contract/context-budget.test.mjs:1-80`, `src/mcp/contracts/tools.manifest.ts:121-122`, `src/mcp/contracts/resources.manifest.ts:4-21` | CI enforces the budget |
| 0.2 | Fix count drift: derive `server_info` tool/resource counts from the manifests at runtime; fix `a8n://docs/api` count and include `render_*`; fix registry header comments. | `src/mcp/tools/system/system-tools.ts:75`, `src/mcp/resources/api-docs.resource.ts:36`, `src/mcp/tools/_registry.ts:31,90`, `src/mcp/resources/_registry.ts:56-59` | All surfaces report 57/default, 28/chatgpt consistently |
| 0.3 | Add a `tools/list` snapshot artifact to CI (JSON file) so PR diffs show schema growth. | CI config | Reviewers see token delta per PR |

### Phase 1 — Tool Consolidation (1–2 weeks, breaking change — version the MCP endpoint)

**Goal:** 57 → 30–35 tools for `default` (saves ~900–1,200 tok, ~15–19% of tool cost) with zero capability loss.

| Step | Merge | Saves | Detail |
|------|-------|-------|--------|
| 1.1 | Remove `get_webhook_url` | 89 tok, 1 tool | `get_workflow_setup_checklist` already returns it (`src/mcp/tools/integrations/integration-tools.ts:190-206`). Ensure the field is always present. |
| 1.2 | Remove `get_integration_setup_guide` | 94 tok, 1 tool | Keep `a8n://integrations/{service}/setup` resource (`src/mcp/resources/catalog.resource.ts:109-128`). Optionally add `setupGuide?` flag to checklist for one-call UX. |
| 1.3 | Merge `test_webhook_setup` → `run_workflow_test` | 121 tok, 1 tool | `run_workflow_test` already has `trigger ∈ {manual, google_form, stripe}` + `sampleData`. Add curated sample generation for google_form/stripe (move `sampleGoogleFormPayload`/`sampleStripePayload` at `src/mcp/tools/integrations/integration-tools.ts:47-106` to shared). Fix `nextStep` at `:404`. |
| 1.4 | Remove `execute_workflow` (keep `execute_workflow_and_wait`) | 126 tok, 1 tool | Superset tool handles both modes; `wait=false` already exists on `run_workflow_test`. Keep fire-and-forget only if a distinct audience warrants the 126 tok — default recommendation is remove. |
| 1.5 | Merge `list_credentials_by_type` → `list_credentials(type?)` | 95 tok, 1 tool | Add optional `type` param to `list_credentials` (`src/mcp/tools/credentials/credential-tools.ts:39-84`); filter `where` at `:301-308` becomes a branch. |
| 1.6 | Downgrade `move_workflow_node` | 126 tok or keep at reduced cost | Make position-only edits skip approval/snapshot (no validation needed beyond bounds) or fold `position` into `update_node_config`. One version row per drag is wasteful (`src/mcp/tools/workflows/workflow-versioning.tool.ts:117-122`). |
| 1.7 | Consolidate execution read path | dedupes code, ~0 tok but reduces maintenance | `get_execution_timeline` is a strict subset of `diagnose_execution` (`src/mcp/tools/executions/execution-runtime-tools.ts:554-565`). Either keep both but share `buildTimeline`/`summarizeOutput` (`:249-297`) or add `diagnose?: boolean` flag to `get_execution_timeline`. |
| 1.8 | Deduplicate internals | eliminates drift bugs | Extract: duplicate `stableHash` (`src/mcp/safety/approval-guard.ts:12-17` vs `src/mcp/tools/workflows/workflow-graph-utils.ts:57-62`), duplicate `buildGraphDiff` (`workflow-drafts.tool.ts:273-294` vs `workflow-versioning.tool.ts:30-51`), triplicated workflow→graph mapping (`execution-runtime-tools.ts:534-546,594-606` vs `workflow-graph-utils.ts:366-387`), triplicated sample payloads (`execution-runtime-tools.ts:30-67` vs `integration-tools.ts:47-106`), and repeated `loadDraft` pattern. Extract `previewOrApplyMutation` skeleton duplication across 5 call sites (`workflow-drafts.tool.ts:639-724`, `workflow-versioning.tool.ts:53-140,260-337`, `execution-runtime-tools.ts:662-748`). |

**Compatibility:** version the endpoint (`/api/mcp/v2`) or keep removed tools as deprecated aliases that return `410 Gone` with `nextAction` pointing to the replacement for one release.

### Phase 2 — Approval & Safety Hardening (1 week, parallelizable with Phase 1)

| Step | Action | Files |
|------|--------|-------|
| 2.1 | Replace hash-echo with opaque, single-use, TTL-bound approval tokens. Approval preview returns `approvalId` (DB row or signed token), not the hash; `apply_*` consumes it atomically. Never return the expected hash in the denial. | `src/mcp/safety/approval-guard.ts:12-117` |
| 2.2 | Fail closed on missing contract flags; add contract-coverage test asserting every `requireToolApproval` caller has gating flags. | `src/mcp/safety/approval-guard.ts:59-61`, `tests/mcp/contract/tool-manifest.test.mjs:45-51` |
| 2.3 | Unify `requiresConfirmation: false` side-effect tools (`execute_workflow_and_wait` `:331`, `run_workflow_test` `:413`, `test_credential` `:448`) under a consistent, TTL-bound confirmation for `live` modes. | `src/mcp/tools/executions/execution-runtime-tools.ts:303-413`, `src/mcp/tools/integrations/integration-tools.ts:411-571` |
| 2.4 | Make writes transactional where they aren't: `apply_workflow_fix` (`:721-739`) and `rollback_workflow_version` (`src/mcp/tools/workflows/workflow-versioning.tool.ts:317-327`) vs the transactional `apply_workflow_draft` (`src/mcp/tools/workflows/workflow-drafts.tool.ts:701-712`). | As cited |
| 2.5 | Fix `validate_workflow_draft` asymmetry: draft branch recomputes validation instead of trusting stored `draft.validation` (`src/mcp/tools/workflows/workflow-drafts.tool.ts:538`). Recompute uniformly. | `src/mcp/tools/workflows/workflow-drafts.tool.ts:514-556` |
| 2.6 | Make `answer_workflow_draft_questions` / `validate` / `explain` / `preview` audit consistently (some lack `createAuditContext`). | `src/mcp/tools/workflows/workflow-drafts.tool.ts:421-612` |

### Phase 3 — MCP Apps UI v2 (2 weeks)

| Step | Action | Files |
|------|--------|-------|
| 3.1 | Unify bundles: one shell HTML + per-widget view modules via Vite code-splitting (shared `ext-apps` SDK + `styles.css` + `bridge.ts` + `utils.ts` in the shell). Target: ~350 KB shell + ~5–15 KB per view vs 4×331 KB today. | `scripts/build-mcp-apps-ui.ts:16-57`, `src/mcp/apps/ui/**`, `dist/mcp-apps/*.html` |
| 3.2 | Deduplicate data: `render_*` `structuredContent` should be compact and `_meta.details` should *reference* (or be omitted when the same payload was already returned in the same turn). Eliminate the template-resource third copy for widget-backed flows. | `src/mcp/apps/render-tools.ts:24-54`, `src/mcp/resources/app-resources.resource.ts:378-439` |
| 3.3 | Fix widget lifecycle: assign `appInstance` before first render or re-render on `app.connect()` completion; add timeout + error state for `ui/initialize`; handle `ontoolinputpartial` streaming correctly (current draft preview mislabels streaming state, `src/mcp/apps/ui/workflow-draft-preview/mcp-app.ts:95,58-59`). Factory-extract the triplicated `handleRender` scaffolding and `setTimeout(…,0)` binding. | `src/mcp/apps/ui/*/mcp-app.ts`, `src/mcp/apps/ui/shared/bridge.ts:40-128` |
| 3.4 | Harden rendering: move from `innerHTML` + manual `escapeHtml` to DOM construction or a tiny templating helper; make `panel(title,body)` escape both; tune `safeText` regex to avoid over-redaction. Add `<meta CSP>` to built HTML as defense-in-depth even when host enforces `ui.csp`. Remove dead `CHATGPT_WIDGET_CSP` (`src/mcp/apps/widget-resources.ts:12-13`). | `src/mcp/apps/ui/shared/utils.ts:12-66`, `src/mcp/apps/ui/shared/styles.css:1-220`, `src/mcp/apps/widget-resources.ts:10-13` |
| 3.5 | Cache widget HTML in memory (or via `dist` read at startup) instead of per-`resources/read` filesystem hit; unify base-URL precedence (`src/mcp/apps/submission-assets.ts:181-186` vs `src/mcp/resources/app-resources.resource.ts:31-38`). | `src/mcp/apps/widget-resources.ts:131-138` |
| 3.6 | Fix e2e: migrate `tests/e2e/mcp/widgets.spec.ts:43-78` from legacy `window.openai` stub to ext-apps `PostMessageTransport`, assert the real shell, and include it in `test:mcp` (or a dedicated `test:mcp:e2e` gate that rebuilds widgets first). Remove hardcoded personal path in `scripts/capture-widget-screenshots.ts:9`. | `tests/e2e/mcp/widgets.spec.ts`, `scripts/capture-widget-screenshots.ts:9`, `vitest.config.mjs:20-21` |
| 3.7 | Eliminate double widget registration (`src/mcp/resources/_registry.ts:45-46` + `src/mcp/index.ts:57-82`) and dead `supportsUi`/`hasUiCapability` import. Gate widget resources on actual capability (or keep unconditional but register once). | `src/mcp/resources/_registry.ts:33,45-48`, `src/mcp/index.ts:57-82` |
| 3.8 | Accessibility: `aria-live` for status pills, preserve focus across re-renders, proper `aria-label`s, and correct fullscreen toggle lifecycle (`src/mcp/apps/ui/shared/bridge.ts:108-117`). | `src/mcp/apps/ui/**` |

### Phase 4 — Server & Transport Hardening (1 week, parallelizable)

| Step | Action | Files |
|------|--------|-------|
| 4.1 | Bind profile to auth method: OAuth tokens → force `chatgpt` (or an allowlist per `McpOAuthClient`); session tokens → restrict `api_keys:manage`; API keys → `default` with optional `allowedProfiles` column. Remove client-controlled `?profile=` escalation. | `src/app/api/mcp/route.ts:94-99`, `src/mcp/tools/_registry.ts:46-73`, `src/mcp/auth/oauth.service.ts:12-19` |
| 4.2 | Rate-limit before auth (IP bucket) + after auth (key/user bucket). Keep the DB-backed limiter (`src/mcp/middleware/rate-limiter.ts:133-169`) as the post-auth tier. | `src/app/api/mcp/route.ts:237-292` |
| 4.3 | Enable SDK DNS-rebinding guards (`enableDnsRebindingProtection`, `allowedHosts`, `allowedOrigins`) from env. | `src/app/api/mcp/route.ts:336-338,418-420,463-465` |
| 4.4 | Make kill-switch fail closed on parse errors; ensure it runs before rate-limit consumption. | `src/app/api/mcp/route.ts:164-215,311-316` |
| 4.5 | Pass `authInfo` via `transport.handleRequest(request, { authInfo })` and prefer `extra.authInfo` in handlers; keep closure fallback for one release. | `src/app/api/mcp/route.ts:345,425,470`, `src/mcp/shared/auth-context.ts:9-27` |
| 4.6 | Avoid building a full server for `DELETE` (no-op) and for `GET` when not doing SSE; cache compiled Zod schemas / resource descriptors and only re-bind auth per request. | `src/app/api/mcp/route.ts:407-475`, `src/mcp/index.ts:42-85` |
| 4.7 | Move OAuth CSRF store off in-memory to DB or signed stateless token. | `src/mcp/auth/oauth-csrf.ts:3-4` |
| 4.8 | Unify webhook base-URL precedence and surface it in one place. | `src/mcp/apps/submission-assets.ts:181-186`, `src/mcp/resources/app-resources.resource.ts:31-38` |

### Phase 5 — Context Efficiency & Discoverability (1 week)

| Step | Action | Detail |
|------|--------|--------|
| 5.1 | **Schema slimming.** Shorten `description` strings (most are 80–150 chars; 30–60 suffices) and trim `describe()` text in Zod schemas — the single cheapest token win after tool removal. The heaviest `update_workflow` description + schema alone is 344 tok; a 30% cut saves ~100 tok there. | Audit every `server.tool(name, description, schema)` description length |
| 5.2 | **Discovery-first catalog.** Keep `search_capabilities` (`src/mcp/tools/nodes/node-tools.ts:92-140`) and extend it to cover integrations/workflows/templates; keep `list_node_types` but recommend `search_capabilities` as the primary discovery path in prompt guidance. Optionally add `search_tools` that filters `tools/list` server-side (polyfill until the SDK standardizes `tools/list` filtering). | `src/mcp/tools/nodes/node-tools.ts:65-140`, prompts |
| 5.3 | **Large payloads behind `resources/read`.** Move verbose node-type details and setup guides fully behind resources; tools return compact summaries + resource URIs. Already partially done — complete it for the heaviest tools. | `src/mcp/resources/catalog.resource.ts`, `src/mcp/resources/node-types.resource.ts` |
| 5.4 | **Pagination & truncation discipline.** Standardize pagination output naming (`page`/`pageSize`/`totalCount` at `src/mcp/shared/pagination.ts:1-40`) and cap list responses; ensure `search_capabilities` `limit` default stays low (8 today). | `src/mcp/shared/pagination.ts`, node/integration tools |
| 5.5 | **Prompt hygiene.** Keep 3 prompts but ensure `create_workflow` prompt (`src/mcp/prompts/create-workflow.prompt.ts:10-52`) references the consolidated tool names and the discovery flow. | `src/mcp/prompts/_registry.ts:19-33` |

### Phase 6 — Observability & Release Gates (3–5 days)

| Step | Action | Files |
|------|--------|-------|
| 6.1 | Wire `MCP_SAFETY_STRICT_MODE` to real gates or remove it. | `src/mcp/config.ts:71` |
| 6.2 | Add per-profile tool/resource count assertions to `mcp:contract:check` / `mcp:production:check` scripts so drift fails the release gate, not just CI. | `scripts/mcp-contract-check.ts`, `scripts/mcp-production-readiness-check.ts` |
| 6.3 | Index `mcp_audit_log.correlationId` (`prisma/schema.prisma:319-339`) and add `apiKeyId` index; reconcile redundant `@@index([keyHash])` duplicates on `ApiKey`/`McpOAuth*` tables. | `prisma/schema.prisma:301-557` |
| 6.4 | Add a denormalized `userId` to `Execution` (today every tenant-scoped execution query joins through `workflow.userId` — `src/mcp/resources/app-resources.resource.ts:241-251` — a single missed join is a tenant-isolation bug). | `prisma/schema.prisma:263-280` |
| 6.5 | Publish the context-budget snapshot and bundle-size snapshot as CI artifacts. | CI config |

---

## 10. Proposed Tool Surface After Consolidation

**Default: 57 → 33–35 tools (−22 to −24, −38–42%)**

| Domain | Before | After | Change |
|--------|-------:|------:|--------|
| api_keys | 3 | 3 | keep |
| credentials | 6 | 5 | `list_credentials_by_type` → `list_credentials(type?)` |
| executions | 8 | 7 | keep 7 (or 6 if `get_execution_timeline` folds into `diagnose_execution`) |
| integrations | 6 | 3 | remove `get_webhook_url`, `get_integration_setup_guide`; merge `test_webhook_setup` → `run_workflow_test` |
| nodes | 2 | 2 | keep (or 1 if `list_node_types` becomes `search_capabilities` flag) |
| system | 5 | 5 | keep |
| workflows | 23 | 13–15 | remove/downgrade `update_workflow` or gate it stricter, downgrade `move_workflow_node`, keep 5 partial-edits + draft pipeline (7) + versions (3) |
| apps | 4 | 2–4 | keep 2–4 `render_*` (or unify into 1 `render_widget(kind, id)` tool — saves ~150 tok) |
| **Total** | **57** | **33–35** | **~2,100–2,400 tok saved on `tools/list` alone** |

Projected `default` static cost after consolidation (conservative):

| | Before | After | Delta |
|---|---:|---:|---:|
| `tools/list` tokens | 6,283 | ~4,100–4,500 | **−1,800 to −2,200 (−29–35%)** |
| + resources/prompts | 1,670 | ~1,000–1,200 (after deduping template resources) | −400–600 |
| **Total static** | **~7,953** | **~5,200–5,700** | **−2,200 to −2,700 (−28–34%)** |

`chatgpt` (28 → ~20–22) would drop from ~4,460 to ~3,200–3,500 tok static — comfortably under 3% of a 128k window.

An optional **unified `render_widget`** (`render_widget({ kind: draft_preview|setup_checklist|timeline|approval, id })`) would save another ~150 tok over 4 separate `render_*` tools and simplify the host integration to one resource URI pattern.

---

## 11. Context Budget Guardrails

Add to `vitest.config.mjs` / CI:

```js
// tests/mcp/contract/context-budget.test.mjs — thresholds
expect(toolsTokens.default).toBeLessThan(6500);   // today 6283
expect(toolsTokens.chatgpt).toBeLessThan(3200);   // today 2790
expect(toolsCount.default).toBeLessThanOrEqual(57);
expect(resourcesTokens).toBeLessThan(1800);       // today 1453
```

And in `scripts/mcp-contract-check.ts`:

```ts
// Fail if any tool description exceeds 180 chars or any inputSchema has >8 top-level properties
// without an explicit allowlist entry in tools.manifest.ts
```

Bundle guard:

```js
// scripts/build-mcp-apps-ui.ts — after build
const total = sum(dist/mcp-apps/*.html);
assert(total < 600_000, `widget bundles ${total}B exceed 600KB budget`); // today 1,324,889
```

---

## 12. Risks & Rollback

| Risk | Mitigation |
|------|------------|
| Removing tools breaks existing clients | Keep removed tools as deprecated aliases for one release that return `410 Gone` + `nextAction` pointing to the replacement; version the MCP endpoint (`/api/mcp/v2`) and keep `/api/mcp` on the old surface for one deprecation window. |
| Tighter approval tokens break automation | Make TTL generous initially (24h) and single-use only for destructive writes; keep `live: false` dry-runs on `test_credential` unapproved. |
| Profile binding breaks ChatGPT app review | Coordinate `McpOAuthClient.allowedProfiles` with the submission package (`src/mcp/apps/submission-assets.ts:189-242`) and test via `scripts/mcp-chatgpt-full-check.ts` before tightening. |
| Widget shell rewrite regresses visuals | Keep the 4 legacy singlefile builds as fallback under `ui://a8n/legacy/*.html` during the migration; e2e `tests/e2e/mcp/widgets.spec.ts` must pass on both. |

---

## 13. Appendix

### A. Reproducing the measurements

```bash
# Tools / resources / prompts context cost (wire-faithful, js-tiktoken gpt-4o)
npx vitest run --config vitest.config.mjs tests/mcp/contract/context-budget.test.mjs
# Log with per-tool ranking:
#   see C:\Users\adity\AppData\Local\Temp\opencode\ctx-budget.log

# Widget bundle sizes
ls -lh dist/mcp-apps/*.html
# or
node -e "import('fs').then(fs=>fs.readdirSync('dist/mcp-apps').forEach(f=>console.log(f, fs.statSync('dist/mcp-apps/'+f).size)))"

# Contract counts
npx tsx -e "import {MCP_TOOL_CONTRACTS} from './src/mcp/contracts/tools.manifest.ts'; console.log('tools', MCP_TOOL_CONTRACTS.length)"
```

Raw `ctx-budget.log` excerpts (default profile, `js-tiktoken gpt-4o`):

```
===== PROFILE: default =====
tools=57 resources=21 prompts=3
TOOLS   : 28306 chars ~ 6283 tokens
RESOURCES: 5481 chars ~ 1453 tokens
PROMPTS : 1015 chars ~ 217 tokens
tokenizer: js-tiktoken gpt-4o
   344 tok    1497 ch  update_workflow
   212 tok     845 ch  add_workflow_node
   202 tok     836 ch  create_api_key
   188 tok     789 ch  create_credential
   169 tok     797 ch  create_workflow_draft
   ... (57 rows)
    58 tok     275 ch  whoami
    56 tok     261 ch  server_info

===== PROFILE: chatgpt =====
tools=28 resources=21 prompts=3
TOOLS   : 12904 chars ~ 2790 tokens

===== PROFILE: embedded_agent =====
tools=31 resources=21 prompts=3
TOOLS   : 13023 chars ~ 2817 tokens
```

### B. Key file map

| Area | Key files |
|------|-----------|
| Tool registry & contracts | `src/mcp/tools/_registry.ts:42-95`, `src/mcp/contracts/tools.manifest.ts:54-119`, `src/mcp/safety/app-tool-policy.ts:1-40` |
| Workflow tools | `src/mcp/tools/workflows/*.tool.ts`, `src/mcp/tools/workflows/workflow-graph-utils.ts:1-400` |
| Execution tools | `src/mcp/tools/executions/execution-tools.ts:1-120`, `src/mcp/tools/executions/execution-runtime-tools.ts:30-751` |
| Integration tools | `src/mcp/tools/integrations/integration-tools.ts:47-571` |
| Credential tools | `src/mcp/tools/credentials/credential-tools.ts:29-315` |
| System / nodes | `src/mcp/tools/system/*.ts`, `src/mcp/tools/nodes/node-tools.ts:65-140` |
| Apps UI | `src/mcp/apps/render-tools.ts:24-279`, `src/mcp/apps/widget-resources.ts:10-184`, `src/mcp/apps/ui/**`, `scripts/build-mcp-apps-ui.ts:16-57` |
| Server & transport | `src/app/api/mcp/route.ts:37-506`, `src/mcp/index.ts:42-85`, `src/mcp/config.ts:1-100` |
| Auth / middleware / safety | `src/mcp/auth/**`, `src/mcp/middleware/**`, `src/mcp/safety/approval-guard.ts:12-117`, `src/mcp/shared/sanitize.ts:13-164` |
| Resources / prompts | `src/mcp/resources/_registry.ts:35-48`, `src/mcp/resources/**`, `src/mcp/prompts/_registry.ts:19-33` |
| DB schema | `prisma/schema.prisma:116-557` (Workflow, WorkflowDraft, WorkflowVersion, Execution, ApiKey, McpAuditLog, McpRateLimitBucket, McpOAuth*) |
| Docs (note drift) | `docs/mcp/04-architecture.md:63-77`, `docs/mcp/06-tools-reference.md:11-753`, `docs/mcp/09-design-decisions.md:23-158` |

### C. Glossary

* **MCP Apps / ChatGPT Apps / ext-apps** — the `io.modelcontextprotocol/ui` extension (`@modelcontextprotocol/ext-apps@1.7.5`) that lets a tool result render an `ui://` HTML resource in the host. Mime: `text/html;profile=mcp-app` (`src/mcp/apps/widget-resources.ts:10`).
* **`confirmationHash` / approval** — `sha256(JSON.stringify(summary)).slice(0,16)` (`src/mcp/safety/approval-guard.ts:12-17`), used to prove the payload previewed is the payload applied.
* **`default` / `chatgpt` / `embedded_agent` profiles** — `McpAppProfile` (`src/mcp/app-profile.ts:1-16`); each mounts a different tool subset via `src/mcp/tools/_registry.ts:46-73`.

---

*Generated 2026-08-26 from a live wire-faithful measurement (`tests/mcp/contract/context-budget.test.mjs`) and source review of `src/mcp/**`, `src/app/api/mcp/route.ts`, `prisma/schema.prisma`, and `dist/mcp-apps/*.html`. All line numbers refer to the repository at that date.*
