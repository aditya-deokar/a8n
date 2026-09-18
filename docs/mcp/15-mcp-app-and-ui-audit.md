# MCP app and MCP UI audit

Audit of the MCP server surface, the four MCP App widgets, and the `/mcp`
dashboard, carried out on 2026-09-18 against `feat/agent`.

The question this answers is not "does the code look right" but "does it
actually work". Every finding below was reproduced before it was fixed, and
every fix has a check that fails if it regresses.

---

## Summary

| Area | State before | State after |
|---|---|---|
| Repo's own release gates | 3 failing (`mcp:contract:check`, `mcp:safety:check`, `mcp:continuous:check`) | All passing |
| Offline eval chain (`test:mcp:offline`) | Failed at step 2 of 4; steps 3–4 never ran | 4/4 passing |
| MCP unit/integration tests | 91 passing, 1 failing | 113 passing, 0 failing |
| Widget e2e tests | Asserted against a bridge the widgets no longer use | 78 passing against the real ext-apps protocol |
| `pnpm lint` | Crashes before linting anything | Still crashes — see [Not fixed](#not-fixed) |
| Tool behavior hints reaching clients | 0 of 52 tools | 52 of 52 tools |
| Model-facing docs naming removed tools | 4 tools across 7 files | 0 |
| Dashboard prefetch statements (10 OAuth clients) | 88 | 16 |

---

## How the audit was run

Source review alone could not answer the question, because the existing
`mcp:contract:check` works by grepping source files — it cannot see what the
server registers at runtime. Three tools were added:

- **`pnpm mcp:runtime:audit`** — boots the real `McpServer` for each of the
  three app profiles and introspects what is actually registered: tool count,
  resource URIs, whether every widget tool points at a resource that exists,
  whether annotations reached the tools, and whether model-facing docs name
  only registered tools. Wired into `mcp:release:gate`.
- **`pnpm mcp:db:benchmark`** — seeds a realistic tenant and runs
  `EXPLAIN (ANALYZE, BUFFERS)` over the queries the MCP surface issues most.
- **`pnpm mcp:query:count`** — counts the SQL statements the dashboard prefetch
  path issues, and fails when the count scales with the number of connected
  OAuth clients.

Command output from before and after the change is in
[`evidence/audit-2026-09-18/`](evidence/audit-2026-09-18/).

For the widgets, `tests/e2e/mcp/host-harness.ts` implements a minimal MCP Apps
host that speaks the real `ui/initialize` → `ui/notifications/*` postMessage
protocol, so tests drive the widgets the way ChatGPT or Claude would.

---

## Findings

### 1. Three release gates were red

`mcp:contract:check` and `mcp:safety:check` both asserted a hard-coded
`=== 28` ChatGPT tool count. The tool set was consolidated to 26 and the
literals were never updated, so both gates failed on a tool set that was in
fact correct.

`mcp:continuous:check` failed its "customer MCP dashboard includes security
center" check — correctly, see finding 3.

**Fixed:** both counts now derive from the contract manifest, so they cannot go
stale on the next consolidation.

### 2. The offline eval chain hid two further failures

`test:mcp:offline` chains four scripts with `&&`. It failed at the safety
check, so the ChatGPT app eval and the adversarial eval never ran. Both were
also broken:

- `chatgpt-configure-credential-004` expected `get_integration_setup_guide`, a
  tool removed during consolidation.
- `do-everything-execute-001` targeted `execute_workflow`, also removed, so the
  adversarial suite aborted with "Missing MCP tool contract".

**Fixed:** both cases now name tools that exist. The adversarial case targets
`execute_workflow_and_wait`, which preserves its intent (an approval-gated tool
that must not run on a vague request).

### 3. The Security Center was dead code

`McpSecurityCenter` was written, exported, and never rendered anywhere. The
`/mcp` page nonetheless prefetched `securitySummary` on every load, so the most
expensive query on the page ran for a component that did not exist.

It also never rendered `data.recommendations` — it counted them and threw the
list away, which is the only actionable part of the payload.

**Fixed:** mounted on the dashboard, renders the recommendations, and no longer
duplicates the OAuth connection list that `McpOAuthConnections` already owns.

### 4. Widget action buttons could never be clicked

Each widget captured the connected app with
`initWidget(...).then(app => appInstance = app)`, but the render callback could
fire from `ontoolresult` **before** that promise resolved. When it did, the
widget rendered with `app === null`, every action button stayed disabled, and
nothing re-rendered to fix it — so "Apply this draft" and "Diagnose this
failure" were permanently dead.

**Fixed:** the bridge holds the last payload and re-renders when the connection
arrives, and passes the app into the render callback. Covered by e2e tests that
click the buttons and assert the resulting `tools/call`.

### 5. The widget CSP was declared but never emitted

`CHATGPT_WIDGET_CSP` was exported, advertised in the widget resource metadata,
and asserted by an e2e test — but nothing ever put it in the HTML. Every built
widget shipped with no CSP at all.

**Fixed:** the build injects the meta tag; the e2e test that always should have
caught this now does.

### 6. Widgets ignored the host's theme

Hosts set the theme by writing `data-theme` on `<html>` (ext-apps
`applyDocumentTheme`). The stylesheet only reacted to
`prefers-color-scheme`, so a dark host on a light machine rendered a light
widget.

**Fixed:** `:root[data-theme="dark"]` is handled, and the OS media query is
guarded with `:root:not([data-theme="light"])` so an explicit light theme wins.

### 7. The setup checklist could fire a test for a trigger that did not exist

"Test webhooks" called `run_workflow_test` with `trigger: "google_form"` even
when the workflow had no webhook steps at all.

**Fixed:** the button only appears when there are webhook steps, and sends one
test per distinct trigger type.

### 8. The secret redactor mangled ordinary prose

The widget redactor matched `<keyword> <any word of 8+ characters>`, so
"Set GOOGLE_FORM_WEBHOOK_SECRET for shared-secret verification" rendered as
"... shared-secret [REDACTED]".

**Fixed:** only assignment-shaped matches are redacted. Unit tests cover both
the true positives and this false positive.

### 9. `GET /api/mcp` returned a stream that never emitted

Under the stateless transport, the route built a full server for `GET` and
returned a 200 SSE response that nothing could ever write to and nothing closed.
The MCP SDK client opens exactly this stream after `initialize` and only treats
**405** as "no server-initiated stream" — any other status is treated as live.
On serverless this pins a function open until it is killed.

**Fixed:** `GET` answers 405 with an `Allow` header. `DELETE` no longer builds a
52-tool server to perform a no-op.

### 10. Tool behavior hints never reached any client

The contract manifest declares `readOnlyHint`, `destructiveHint`,
`idempotentHint` and `openWorldHint` for every tool, but 45 of 52 tools
register through the SDK's `server.tool(name, description, schema, handler)`
overload, which has no annotations parameter. Clients therefore saw
`list_workflows` as exactly as risky as `delete_workflow`, which is what hosts
use to decide whether a call needs a confirmation prompt.

**Fixed:** `applyContractAnnotations` copies the contract's hints onto the
registered tools after registration, leaving tools that set their own
annotations untouched. All 52 tools now carry hints.

### 11. Model-facing docs named four tools that no longer exist

`a8n://docs/api`, the prompt contracts, the ChatGPT submission assets and two
prompts still instructed the model to call `execute_workflow`,
`get_integration_setup_guide`, `test_webhook_setup` and `get_webhook_url`.
A client reading those resources would attempt tool calls that fail.

**Fixed:** all references now name the tools that replaced them, and
`mcp:runtime:audit` fails if a model-facing file names an unregistered tool.

### 12. `logging/setLevel` was unimplemented

`McpServer` infers the tools, resources and prompts capabilities, but the SDK
only registers the `logging/setLevel` handler when `logging` is declared
explicitly. It was not, so MCP Inspector's log-level control got `-32601`.

**Fixed:** the capability is declared.

### 13. A dead client-initialized hook

`createMcpServer` installed an `oninitialized` hook that re-registered widget
resources the resource registry had already registered. Under the stateless
transport the hook can never observe client capabilities (the `initialized`
notification arrives on a different server instance), so it was unreachable —
and had it run, it would have thrown "already registered" inside a notification
handler, where the SDK swallows the error.

**Fixed:** removed, with a comment explaining why a per-request server cannot
gate on handshake state.

### 14. Browser clients could not discover OAuth

`WWW-Authenticate` is not a CORS-safelisted response header. It was not in
`Access-Control-Expose-Headers`, so browser-hosted clients such as MCP
Inspector could not read `resource_metadata` off a 401.

Separately, RFC 9728 clients probe
`/.well-known/oauth-protected-resource/api/mcp` first and only fall back to the
root document on a 4xx — that route did not exist, so every client paid a 404.

**Fixed:** the header is exposed and the path-scoped route was added. The
advertised `resource` value is unchanged; see [Not fixed](#not-fixed).

### 15. A wildcard CORS default turned into a total outage

`MCP_CORS_ORIGINS` defaulted to `*`, and the route refuses to serve with a
wildcard in production — so an unset environment variable produced a 500 on
every MCP request rather than a narrower CORS policy.

**Fixed:** the default is now the app's own origin. The refusal itself still
returns no CORS headers, which is deliberate: a server misconfigured to allow
every origin must not then hand that origin CORS headers. (An earlier version
of this change relaxed that and was caught by the repo's own test.)

---

## Database

See [`evidence/db-optimization/`](evidence/db-optimization/) for the raw
`EXPLAIN (ANALYZE, BUFFERS)` output and query counts.

### Sequential scans on unindexed foreign keys

Postgres does not index foreign keys automatically. `Node.workflowId`,
`Connection.workflowId`, `Connection.toNodeId` and `Execution.workflowId` had no
index, so every workflow graph load, every graph rewrite and every cascade
delete sequentially scanned those tables. `Node` had no indexes at all.

Migration `20260918140256_mcp_query_indexes` adds the missing access paths and
drops four indexes that duplicated an existing `UNIQUE` constraint (extra write
cost on tables written on every MCP request).

### The 4N+1 in the OAuth connection summary

`listMcpOAuthConnectionsForUser` issued four queries per connected client, and
the `/mcp` page called it twice per load. With 10 connected clients that is
**88 statements per page load**; it is now **16**, and constant.

### Other query fixes

| Change | Effect |
|---|---|
| `list_executions` selects explicit columns | Stops pulling `output` (a full execution payload) and `errorStack` for every row |
| `lastUsedAt` writes throttled to 60s | Removes an `UPDATE` + WAL write from every authenticated MCP request, on both the API-key and OAuth paths |
| `move_workflow_node` updates one row | Was deleting and recreating every node and connection in the workflow to change one position, churning connection ids |
| `getMcpAuditHealth` counts a bounded window | Was an unqualified `count(*)` over a table that grows with every MCP request, on every cron tick |

---

## Not fixed

Named deliberately, with the reason.

### `pnpm lint` cannot run

`eslint-config-next@16.2.6` pins `@typescript-eslint/*@8.46.3`, and the repo
runs `typescript@7.0.2`. TypeScript 7 removed the enum objects that
typescript-eslint reads:

```
$ node -e "const ts=require('typescript'); console.log(ts.version, typeof ts.Extension)"
7.0.2 undefined
```

ESLint crashes with `TypeError: Cannot read properties of undefined (reading
'Cjs')` before linting a single file. This is not a version-bump away: the
newest `typescript-eslint` (8.70.0) declares `typescript: >=4.8.4 <6.1.0`.

Resolving it means either pinning TypeScript back to 5.x — reverting a
deliberate upgrade in `7928dae` — or waiting for typescript-eslint to support
TS 7. That is a dependency decision for the repo owner, so this PR does not
make it. `pnpm typecheck` passes and is unaffected.

### OAuth `resource` still advertises the bare origin

`protectedResourceMetadata` reports `https://host` rather than
`https://host/api/mcp`, which means a token minted for this MCP server is
audience-valid for every path on the origin. Tightening it is correct, but it
changes what live ChatGPT and Claude connections were issued against, so it
wants its own change with a migration window rather than riding along here.
`isAllowedOAuthResource` already accepts both forms, so the path-scoped
well-known route added here is safe on its own.

### `list_executions` still sequentially scans

It filters through the relation (`workflow: { userId }`) and sorts by
`startedAt`, which no single index can serve well across many workflows. The
real fix is denormalizing `userId` onto `Execution`, which needs a backfill and
a change to every execution write path — outside the MCP surface this PR covers.
Measured: an index on `Execution(startedAt)` alone scanned 820 rows to return
20, so it was not worth adding.

### Pre-existing schema drift

`prisma migrate dev` wants to `DROP TABLE agent_memory_item` — the model was
removed from `schema.prisma` in `8e180c5` without a migration. The migration in
this PR was hand-written to contain only its own index changes, so it does not
carry that destructive statement. The drift still needs its own migration.

### Audit log write volume

A single `delete_workflow` writes four `mcp_audit_log` rows (route-level, tool
level, and one per approval preview/confirm). Batching them is a worthwhile
follow-up but changes audit semantics, so it is not bundled here.
