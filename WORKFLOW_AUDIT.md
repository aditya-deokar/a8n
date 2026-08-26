# 🔍 WORKFLOW BUILDER — COMPLETE PROJECT AUDIT

> **Scope:** Full audit of every workflow-related subsystem in a8n before starting MCP tool & MCP App UI advancement.
> **Date:** 2026-08-26 · **Typecheck status:** ✅ `tsc --noEmit` passes with **0 errors**
> **Verdict:** The platform is a working MVP — all 12 node executors are genuinely implemented and the engine runs end-to-end. However, the editor has **one critical state-management defect** that corrupts graphs during normal editing, plus several data-integrity bugs that must be fixed **before** MCP advancement.
>
> ---
> ## ✅ IMPLEMENTATION STATUS UPDATE (2026-08-26)
>
> **Phases 0–3 from this audit have been implemented.** See §9 at the bottom of this file for the complete change log.

---

## 1. Executive Summary

| Subsystem | Status | Grade |
|---|---|---|
| Visual DAG Editor (React Flow v12) | ⚠️ Works but structurally broken state management | **C+** |
| Execution Engine (Inngest v4) | ✅ Functional, sequential DAG runner; missing hardening | **B−** |
| Node Executors (12 types) | ✅ All implemented, no stubs, no TODOs | **A−** |
| Triggers & Webhooks | ⚠️ Work, but broken UX flows + security gaps | **C+** |
| tRPC API Layer (workflows/executions/credentials) | ⚠️ Small but functional; integrity bugs found | **C+** |
| Realtime Node Status (Inngest Realtime) | ⚠️ Works, but unauthenticated + cross-tenant leaky | **D+** |
| Executions UI / Observability | ❌ Read-only blob view; no per-node logs anywhere | **D** |
| Credentials Vault | ⚠️ AES-256 solid, but silent corruption bug on edit | **C** |
| Data Model / Prisma Schema | ⚠️ Normalized graph storage good; drift + missing lifecycle fields | **C+** |
| MCP Tool Layer (57 tools) | ✅ Already extensive — depends on same broken foundations | **B** |

**Bottom line:** Do **not** start MCP tools/UI advancement yet. Fix the Phase 0–2 items below first (≈ the critical correctness + data-integrity layer), because every MCP workflow-mutation tool writes to the same graph model the UI corrupts.

---

## 2. What Is Already Implemented (Baseline)

### 2.1 Editor (`src/features/editor/`, `src/components/react-flow/`)
- Controlled React Flow canvas: connect edges, snap-to-grid [10,10], pan-on-scroll, selection-drag, Background dots, Controls, MiniMap, dark/light theming (`editor.tsx`).
- Save button serializes nodes/edges → `workflows.update` tRPC (`editor-header.tsx:27-49`).
- Inline click-to-rename workflow with Enter/Esc + rollback.
- Dirty tracking atom `isCanvasDirtyAtom` (partial — see Bug #4).
- AI Draft Preview Mode: agent drafts swap canvas content via `draftPreviewAtom`, "Back to Live" banner, "Changes Applied" banner.
- Execute Workflow button (bottom panel) gated on presence of a MANUAL_TRIGGER node.
- Per-node hover toolbar (settings/delete) via `NodeToolbar`.
- Node selector slide-in panel grouped into Triggers/Actions from `NODE_MANIFESTS`; one-manual-trigger guard; INITIAL placeholder replacement.
- 12 node config dialogs (react-hook-form + zod + credential `<Select>` fed by `useCredentialsByType`).
- Google Form trigger dialog includes a full Google Apps Script generator + webhook URL copy.
- Agent sidebar chat with `Ctrl/Cmd+Shift+A` shortcut, memory panel, approval flow.

### 2.2 Execution Engine (`src/inngest/`)
- Dispatch: `sendWorkflowExecution()` → Inngest event `workflows/execute.workflow` with kill-switch check, E2E fault injection hooks, quota guard.
- Durable function `execute-workflow`: `create-execution` → `prepare-workflow` (toposort via `toposort@2`) → `find-user-id` → sequential node loop → `update-execution` (SUCCESS + final context JSON).
- Retries: 3 in production / 0 in dev; `onFailure` handler writes FAILED + error stack.
- All **12 executors fully implemented**: HTTP_REQUEST (ky + handlebars templating), OPENAI / ANTHROPIC / GEMINI (@ai-sdk, `step.ai.wrap` durability), DISCORD / SLACK (webhook POST, truncation), EMAIL (nodemailer SMTP), GOOGLE_SHEETS (service-account JWT), 3 trigger pass-throughs.
- Structured logging at dispatch/function/node boundaries (`observeWorkflowNode`), external-call logs with retryable classification.
- `NonRetriableError` correctly used for config errors.

### 2.3 API + Schema
- tRPC routers: `workflows` (execute/create/remove/update/updateName/getOne/getMany), `credentials` (create/remove/update/getOne/getMany/getByType), `executions` (getOne/getMany), plus mcp/agent/subscriptions.
- Ownership scoping consistent across all procedures.
- Normalized graph storage: `Workflow` → `Node[]` (+`data Json`) → `Connection[]`; `Execution` keyed by unique `inngestEventId` for idempotency.
- Entitlements system: atomic advisory-lock quota slots (5 workflows / 10 creds free tier), upgrade modal wiring.
- Credential vault: Cryptr AES-256-GCM encryption at rest.

### 2.4 Realtime
- 11 static Inngest Realtime channels (one per node type); executors publish `loading → success|error`; each canvas node subscribes via `use-node-status.ts` and renders live status rings. This genuinely works today.

---

## 3. 🔴 CRITICAL BUGS (P0 — fix before anything else)

### BUG-1 · Editor state desync — nodes vanish/reappear, edits silently reverted *(CRITICAL, structural)*
The `<Editor>` is **controlled** (nodes/edges live in local `useState`, changes applied via `applyNodeChanges` over its own snapshot — `src/features/editor/components/editor.tsx:92-129`). But many components mutate React Flow's internal store **imperatively** via `useReactFlow().setNodes/setEdges`, bypassing `Editor`'s state:

| Offender | Location |
|---|---|
| Add-node from picker | `src/components/node-selector.tsx:80` |
| Trigger node delete | `src/features/triggers/components/base-trigger-node.tsx:33-46` |
| Execution node delete | `src/features/executions/components/base-execution-node.tsx:33-46` |
| All 8 action-node config `handleSubmit`s (openai, anthropic, gemini, http-request, discord, slack, email, google-sheets) | e.g. `openai/node.tsx:34` |

**Effect:** after any imperative `setNodes`, the next drag/select applies `applyNodeChanges(changes, staleSnapshot)` → newly added nodes disappear, deleted nodes resurrect, dialog edits revert. This breaks the core editing loop of the product.
**Fix direction:** lift all mutations through `Editor`'s setters (context/callbacks or move nodes/edges into jotai atoms as single source of truth).

### BUG-2 · Credential double-encryption = permanent silent credential corruption *(CRITICAL, data loss)*
1. `credentials.getOne` returns the stored **ciphertext** (`src/features/credentials/server/routers.ts:66-72`).
2. `CredentialView` seeds it into the password input (`credential.tsx:261-263`).
3. Saving untouched re-encrypts ciphertext (`routers.ts:57-64`) → credential permanently corrupted; user only finds out when a run fails decryption.
**Fix:** never return `value` from any credentials procedure (`select:` omit); track "dirty" field client-side; only encrypt when value actually changed.

### BUG-3 · Double quota consumption per manual execution *(HIGH)*
`workflows.execute` calls `enforceExecutionQuotaForUser(userId)` (`routers.ts:26`) which already consumes a unit, then `sendWorkflowExecution` consumes **again** (`src/inngest/utils.ts:110-113`). Every manual run burns 2× of the daily guard.
**Fix:** consume in exactly one place (keep the dispatcher-level guard, remove the router-side call).

### BUG-4 · Save while in "Draft Preview" persists an unapproved AI draft as the live workflow *(HIGH)*
`EditorSaveButton` reads `editor.getNodes()` with no `graphMode` check (`editor-header.tsx:27-49`) — bypasses the entire approval flow.
**Fix:** disable save in draft mode or auto-switch to live first.

### BUG-5 · Rename (or any `getOne` invalidation) wipes unsaved canvas edits *(HIGH)*
`useUpdateWorkflowName` invalidates `workflows.getOne` (`use-workflows.ts:80-82`); `Editor`'s effect keyed on `[graphMode, draftPreview, workflow]` resets nodes/edges from server (`editor.tsx:95-103`) → unsaved drags/additions discarded.
**Fix:** don't clobber local graph state on refetch unless server version actually changed (or only sync on explicit load/save).

### BUG-6 · Unauthenticated realtime token minting + cross-tenant leakage *(HIGH, security)*
- None of the 11 `fetch*RealtimeToken` server actions check the session (e.g., `stripe-trigger/actions.ts:12-19`, `openai/actions.ts:12-18`, `manual-trigger/actions.ts:13-20`; two return `null as unknown as Token` on error).
- Channels are static global names ("http-request-execution") with no per-user/workflow/run scoping → anyone can subscribe to **all users'** node-status streams platform-wide.
**Fix:** auth-guard every action; add userId/workflowId claims to channel names or token policies.

### BUG-7 · `workflows.update` performs zero graph validation *(HIGH)*
Delete-all + recreate transaction (`routers.ts:97-124`) accepts:
- Edges referencing node IDs not present → FK violation → raw 500;
- Duplicate edges → violates `Connection @@unique` → raw 500;
- Empty/degenerate graph wipes all nodes with no confirmation;
- No cycle detection, no trigger-presence validation (client-only rule at `node-selector.tsx:67-78`).
**Fix:** server-side zod refinement pass validating referential integrity, duplicates, cycles, ≥1 trigger before write.

### BUG-8 · Google Form Apps Script generator omits the secret header *(HIGH, breaks feature)*
Generated script sends no secret (`google-form-trigger/utils.ts:25-37`); once `GOOGLE_FORM_WEBHOOK_SECRET` is set, every copy-pasted script gets 401 and the UI never mentions `x-a8n-webhook-secret`.
**Fix:** inject header line into generated script + document it in setup steps.

### BUG-9 · Stripe trigger dialog advertises wrong template variables *(MEDIUM-HIGH)*
Dialog shows `{{stripe.amount}}`, `{{stripe.currency}}`, `{{stripe.customerId}}` (`stripe-trigger/dialog.tsx:93-97`) but real payload shape is `{stripe:{eventId,eventType,timestamp,livemode,raw:{amount,currency,customer}}}` (`api/webhooks/stripe/route.ts:136-143`) → expressions silently render empty.
**Fix:** align docs/dialog with actual context keys (and/or flatten payload). Also: there is **no field anywhere** to enter a Stripe signing secret despite the instructions mentioning it.

---

## 4. 🟠 HIGH-PRIORITY GAPS (P1 — required for a "functional" builder)

### 4.1 Engine reliability
| Gap | Detail | Ref |
|---|---|---|
| No per-node execution logs | No `NodeRun`/`ExecutionLog` table exists. Only aggregate `Execution.output`. Historical executions cannot show which node failed or its I/O — even though MCP tools already compute such timelines internally (`execution-runtime-tools.ts:230-292`) | `prisma/schema.prisma:262-278` |
| No timeouts anywhere | ky/nodemailer/googleapis called with no AbortSignal/timeout; a hung endpoint stalls the whole run | all executors |
| Stuck-RUNNING forever | Only `onFailure`/`update-execution` write terminal states; if worker dies post-acceptance, rows stay RUNNING; no reaper job | `functions.ts:99-106,259-268` |
| Failed runs leave canvas stuck "loading" | `onFailure` updates DB only, never publishes error statuses to realtime channels | `functions.ts:82-107` |
| `onFailure` can itself throw P2025 | If failure occurs before `create-execution`, update-by-inngestEventId finds nothing and throws inside the handler | `functions.ts:99-106` |
| Realtime publish shim fragile | Uses SDK-private `(inngest as any).inngestApi.publish` outside `step.run`, passes event-id where runId belongs; non-durable → duplicate/out-of-order messages under retries | `functions.ts:222-236` |
| Serial branch execution; ports ignored | Connections carry `fromOutput/toInput` handles but toposort ignores them; diamond graphs execute branches serially; orphan nodes execute too (synthetic self-edges) | `inngest/utils.ts:19-63` |
| Every trigger node fires every run | No concept of "the trigger that caused this run" | `functions.ts:239-257` |

### 4.2 Lifecycle & API surface
| Gap | Detail |
|---|---|
| **No activation/publish lifecycle** | No `active` column, toggle, procedure or UI. Saved workflow = implicitly live for webhooks; can't disable without deleting. Webhook routes dispatch for any `workflowId` given one shared env secret |
| **No versioning for manual edits** | `WorkflowVersion` snapshots are created **only** by MCP tools; UI saves never snapshot; no list/restore endpoints in tRPC. Three half-connected systems (live graph / versions / drafts) |
| **Executions UI never refreshes** | List/detail are poll-free suspense queries (`staleTime: 30s`); `useExecuteWorkflow` doesn't invalidate executions → new RUNNING run invisible until remount |
| **No execution management** | No retry/cancel/delete procedures; no filters at all on `executions.getMany` (not even by workflow/status/date) |
| **Missing standard CRUD features** | No duplicate-workflow (tRPC/UI — exists only as MCP tool), no import/export JSON, no tags/folders, no archive, no bulk ops |
| **Quota-drain vector** | Public webhook URLs embed `workflowId`, charge owner quota pre-rate-limit; `?secret=` query param leaks into access logs; `"unsigned-dev"` mode silently accepts unverified webhooks; `.env.example` ships empty `INNGEST_SIGNING_KEY` (unverified forged events would execute workflows) |
| **Schema drift** | Table `agent_memory_item` created by migration + queried via `$queryRaw` but absent from `schema.prisma` → next `migrate dev` will generate a DROP for live tables |
| **UI save drops `Node.credentialId`** | `workflows.update.createMany` omits it; MCP's `replaceWorkflowGraph` sets it → divergent data models between UI-saved and MCP-saved graphs |

---

## 5. 🟡 MISSING EDITOR FEATURES vs n8n parity (P2)

| # | Feature | Status |
|---|---|---|
| 1 | Undo/redo | ❌ Absent entirely |
| 2 | Copy/paste/duplicate node, duplicate workflow | ❌ Absent |
| 3 | Autosave + dirty indicator + route-leave/beforeunload guard | ❌ Absent (atom exists but unused in header) |
| 4 | Publish/Activate toggle semantics | ❌ Absent |
| 5 | Drag-and-drop node creation; drop-on-edge insertion; "+" affordance on edges | ❌ Click-only, placed at random viewport jitter |
| 6 | Searchable/commandable node picker (keyboard nav, recents) | ❌ Static list |
| 7 | Branching: IF/switch/router nodes, multiple outputs | ❌ Dead hidden handles leftover; strictly linear |
| 8 | Edge intelligence: reconnect, delete-button, cycle/self-loop prevention, custom styled edges | ❌ Absent (animated edge exists only on marketing page) |
| 9 | Per-node test-run + input/output data inspection from canvas | ❌ Absent |
| 10 | Expression editor: autocomplete/picker for `{{variables}}` from upstream output schemas | ❌ Raw textareas (manifests define outputs but UI never surfaces them) |
| 11 | Inline credential create/edit from node dialogs (empty-dropdown dead-end today) | ❌ Absent |
| 12 | Pre-save/pre-run graph validation panel (required fields, orphans, missing creds) | ❌ Absent (zod guards individual dialogs only) |
| 13 | Version history / restore UI | ❌ Models exist, no UI/endpoints |
| 14 | Templates surfaced as starters | ❌ 4 templates defined in `node-manifest.ts` never shown in UI |
| 15 | Configurable AI model selection (hardcoded gpt-4 / claude-sonnet-4-5 / gemini-flash) | ❌ Absent |
| 16 | HTTP executor: auth headers, non-JSON bodies, response status surfacing | ❌ JSON-only |
| 17 | Scheduled/cron trigger node | ❌ Not in enum/registry/engine (agent golden-task claims scheduled workflows — false advertising) |
| 18 | Alignment/auto-layout tools, sticky notes, groups | ❌ Absent |

---

## 6. 🧹 Minor Issues & Cleanup

- Dead code: `planProcedure`/`premiumProcedure` (`init.ts:317-330`), `caller` (`trpc/server.tsx:17`), `selectorOpen` (`editor-header.tsx:175`), unused relational `Node.credentialId` column, dead hidden handles in both base nodes.
- `ctx.userId` fallback `'user_123'` pollutes log fields (`init.ts:110`); typo `"Unathorized"` (`init.ts:237`).
- `subscriptions.syncNow` rate-limits via in-process Map — ineffective on serverless.
- Workflow delete has **no confirmation dialog** (`workflows.tsx:155-157`).
- SSE reader splits on `\n` with no cross-chunk buffering → dropped agent events at chunk boundaries (`use-agent-stream.ts:204-343`).
- Deprecated `navigator.platform` used (`agent-sidebar.tsx:337`); `any` types in `atoms.ts:11` etc.
- `BaseHandle` spreads `{...props}` twice (`base-handle.tsx:13,18`).
- Hardcoded "gpt-4:" prefix in OpenAI node description regardless of actual model.
- `Node.name` always set to the type string — defeats column purpose (`routers.ts:108`).
- Docs drift: `docs/WORKFLOW_ENGINE.md` describes removed `realtimeMiddleware()`, lists 9 channels (actual: 11, missing EMAIL & GOOGLE_SHEETS).
- One SSE subscription **per node component** → N sockets per page instead of one multiplexed stream.
- Executions duration rounds to whole seconds (sub-second runs show "0s").
- ⚠️ Live Polar webhook secret committed in working-tree file `remaining-prod-task.md:17` — rotate it.

---

## 7. Recommended Roadmap (ordered)

### Phase 0 — Data-integrity stopgaps *(do first, ~half day)*
1. BUG-2 credential double-encryption (stop active corruption).
2. BUG-3 double quota burn.
3. Rotate leaked Polar webhook secret; remove it from repo files.

### Phase 1 — Editor correctness *(the "make the builder functional" milestone)*
4. BUG-1 refactor: single source of truth for nodes/edges (jotai atoms or context callbacks); migrate all imperative `setNodes/setEdges` callers.
5. BUG-5 refetch-clobber fix + BUG-6-lite: mark dirty on dialog edits; reset atoms on unmount/navigation.
6. BUG-4 block save in Draft Preview.
7. BUG-7 server-side graph validation (referential integrity, dupes, cycles, ≥1 trigger, non-empty confirm) + friendly error mapping (404/409 instead of 500).
8. Unsaved-changes guard (beforeunload + navigation) and dirty dot in header.
9. Delete-confirmation dialog for workflows.

### Phase 2 — Engine trustworthiness
10. Add `ExecutionNodeRun` table (nodeId, type, status, startedAt/completedAt, error, input/output refs) written inside durable steps; render timeline in execution detail view.
11. Timeouts (AbortSignal) for all outbound calls; map to retryable/non-retriable.
12. Publish error statuses to channels in `onFailure`; guard P2025 in handler; add stuck-RUNNING reaper (cron).
13. Auth-guard all 11 realtime token actions; scope channels per user/run; unify token-error handling.
14. Replace private-API publish shim with supported `step.realtime.publish`/middleware; fix runId.
15. BUG-8/BUG-9 trigger fixes (Apps Script secret header, Stripe variables, signing-secret input field).
16. Single-source quota consumption; webhook rate limiting; require headers-only secrets.

### Phase 3 — Builder productivity (parity features)
17. Undo/redo (history stack around the new atoms store).
18. Searchable node picker + drag-drop creation + edge "+" insertion + reconnect/delete-edge affordances.
19. Activation toggle (`active` column + procedures + list badge + webhook gating).
20. Version snapshots on every save (reuse `WorkflowVersion`) + history/restore UI; duplicate workflow; import/export JSON.
21. Expression/variable picker from upstream output schemas; inline credential create; configurable AI models; per-node test-run.
22. Multiplex realtime subscriptions (one stream per editor, fan-out client-side).

### Phase 4 — THEN advance MCP Tools & MCP App UI
Only after Phases 0–2 converge the UI and MCP paths onto one graph model:
- Unify `workflows.update` (UI) with MCP's `replaceWorkflowGraph` (incl. `credentialId` handling).
- Surface the existing MCP widgets' capabilities (draft preview, approval diff, execution timeline) using the new `ExecutionNodeRun` data.
- Extend widget suite (node-picker widget, live run monitor widget) on stable foundations.

---

## 8. MCP Readiness Assessment (for the next milestone)

Already strong: 57 registered tools across 8 domains (workflows incl. drafts/versioning/graph-utils, executions incl. runtime polling tools, credentials, api-keys, integrations, nodes, system/security), ext-apps `registerAppTool/registerAppResource` integration, Vite single-file widget bundles (4 widgets), capability-based degradation, extensive eval/safety/release-gate scripts.

Blocked by shared-foundation issues:
1. Graph corruption bugs (BUG-1/BUG-7) affect MCP-written graphs equally once users edit afterwards.
2. No per-node execution persistence → `execution-timeline.html` widget can only show what runtime polling captures, not history.
3. No activation lifecycle → MCP "run workflow" semantics ambiguous.
4. Credential corruption path (BUG-2) undermines `test_credential` tools.

**Recommendation:** treat Phases 0–2 as the MCP gate. Phase 3 items are independent of MCP and can proceed in parallel afterward.

---

*Generated by full-codebase audit: 4 parallel deep-dives (editor UI, execution engine, tRPC/schema, triggers/webhooks/realtime) + manual verification of all critical findings. Typecheck verified clean at audit time.*

---

## 9. IMPLEMENTATION LOG — Phases 0–3 Complete

All fixes verified with `tsc --noEmit` (0 errors), 58/58 API unit+contract tests, 94/94 MCP tests (3 initial failures were cold-start timeouts that pass in isolation).

### Phase 0 — Data integrity ✅
- **BUG-2 fixed:** credentials router no longer returns encrypted `value` from `getOne`/`getMany`/`getByType`; `update` only re-encrypts when a new value is supplied; form shows "leave blank to keep current".
- **BUG-3 fixed:** execution quota consumed exactly once (dispatcher-level); router maps `QuotaExceededError` → tRPC FORBIDDEN.
- ⚠️ Polar webhook secret rotation remains a **manual user action** (secret was in git-ignored `remaining-prod-task.md`).

### Phase 1 — Editor correctness ✅
- **BUG-1 fixed:** single source of truth — `editorNodesAtom`/`editorEdgesAtom` + `applyGraphChangeAtom`; all 11 imperative `useReactFlow().setNodes` callers migrated (`node-selector`, base trigger/execution nodes, all 8 action dialogs via `updateNodeData`).
- **BUG-5 fixed:** server→canvas sync compares normalized graph signatures; never clobbers when dirty.
- **BUG-4 fixed:** Save blocked in Draft Preview with explanatory toast; save reads atoms.
- **BUG-7 fixed:** `graph-validation.ts` enforces unique node ids, referential integrity, duplicate/self connections, cycle detection, ≥1 trigger, INITIAL exclusivity; Prisma P2002/P2003 mapped to friendly CONFLICT/BAD_REQUEST.
- Dialog edits now mark canvas dirty; atoms reset on editor unmount; dirty dot on Save button; `beforeunload` guard; delete-confirmation AlertDialog in workflows list.

### Phase 2 — Engine trustworthiness ✅
- New `ExecutionNodeRun` table (+ migration `20260826120000_workflow_active_and_node_runs`): per-node status/timing/errors persisted idempotently inside the run loop.
- Execution detail view renders a per-node timeline (status icons, durations, error lines) and polls every 3s while RUNNING; executions list polls while any run is RUNNING.
- Timeouts everywhere: ky 30s, AI models 120s abortSignal, SMTP connection/socket timeouts, Google Sheets wrapped with `withTimeout`.
- `onFailure`: P2025-guarded DB update + best-effort error-status publishing to all node channels (no more stuck "loading" rings).
- Publish shim replaced with official `realtimeMiddleware()` from `@inngest/realtime/middleware`.
- All 11 realtime token server actions auth-guarded (`requireRealtimeTokenAccess`); null-token silent failures now rethrow.
- Stuck-RUNNING reaper cron: `/api/cron/executions-reaper` (15-min threshold, bearer secret, mirrors billing-reconcile pattern).
- Webhooks: headers-only secrets (removed `?secret=` leak), per-workflow encrypted trigger secrets (`workflows.setWebhookSecret`), Stripe signature verified against env AND per-node secrets, activation gating (409 for inactive workflows), per-workflow rate limiting (30/min).
- Google Form Apps Script generator now includes the `x-a8n-webhook-secret` header + WEBHOOK_SECRET placeholder; Stripe dialog variables corrected to actual payload shape (`{{stripe.raw.amount}}` etc.).
- Execute button now available for ANY trigger type (not just manual).

### Phase 3 — Builder productivity ✅
- Undo/redo: 50-step history (`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`) with header buttons; drag-start snapshots.
- Searchable node picker (label/description/aliases) with drag-and-drop creation onto canvas.
- Interactive edges: select an edge to insert-a-step-between-nodes or delete it; edge reconnection enabled.
- Activation lifecycle: `Workflow.active` column, `setActive` procedure, Switch+Badge on workflow cards; webhooks respect it.
- Version history: snapshot on every manual save (20-version retention), `getVersions`/`restoreVersion` procedures, restore UI with auto-save-before-restore.
- Duplicate workflow (new node ids, remapped connections, starts inactive); JSON export/import via editor menu.
- Upstream variable picker: computes available `{{variables}}` from ancestor nodes' output schemas; clickable chips inserted into prompt/content/body fields across all 8 action dialogs.
- Inline credential quick-create in every node dialog (no more dead-end dropdowns).
- Configurable AI models: OpenAI/Anthropic/Gemini model selects persisted in node config; executors read `data.model`; descriptions show selected model.
- Per-node test runs: `workflows.testNode` executes one node with mocked step tools; "Test step" button in every action dialog footer.
- Multiplexed realtime: one subscription per distinct node type on canvas (`RealtimeStatusProvider` + shared status atom) instead of N per-node streams.

### Required follow-ups before deploy
1. Run migrations: `pnpm db:local:migrate` (local) or GitHub Actions Production Deploy with `apply_migrations` (adds `Workflow.active` + `ExecutionNodeRun`).
2. Register `/api/cron/executions-reaper` in your cron runner with `Authorization: Bearer <EXECUTIONS_REAPER_SECRET>` (falls back to CRON_SECRET), every ~5 minutes.
3. Set `GOOGLE_FORM_WEBHOOK_SECRET`/`A8N_WEBHOOK_SHARED_SECRET` locally and paste matching values into generated Apps Scripts; configure per-trigger secrets in their dialogs.
4. Rotate the Polar webhook secret exposed in `remaining-prod-task.md` (git-ignored, but treat as compromised).
5. `pnpm lint` currently crashes due to pre-existing TypeScript-7-beta vs typescript-estree incompatibility (unrelated to these changes).
