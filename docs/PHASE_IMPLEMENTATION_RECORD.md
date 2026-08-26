# 📋 Implementation Record — Workflow Builder Hardening (Phases 0–3)

> **Period:** August 2026 · **Baseline audit:** [WORKFLOW_AUDIT.md](../WORKFLOW_AUDIT.md)
> **Outcome:** 40+ defects fixed and ~20 features added across editor, engine, API, and triggers.
> **Verification:** `tsc --noEmit` 0 errors · API unit+contract tests 58/58 · MCP suite 94/94.

---

## 1. Why This Work Existed

A full-project audit found that a8n's workflow builder was a working MVP with three structural problems:

1. **The editor corrupted graphs during normal use** — controlled React Flow state was mutated imperatively in 11 places, so added nodes vanished, deleted nodes resurrected, and dialog edits silently reverted on the next drag.
2. **Data-integrity bugs** — editing a credential re-encrypted its ciphertext (permanent silent corruption); every manual execution burned quota twice; saves bypassed all validation (dangling edges caused raw 500s).
3. **No observability or lifecycle** — per-node execution data lived only in ephemeral realtime messages; workflows had no active/inactive toggle; failed runs left canvas nodes stuck "loading" forever.

Phases 0–3 were executed to make the builder trustworthy **before** advancing MCP tooling, because MCP tools write to the same graph model the UI corrupts.

---

## 2. Phase 0 — Data-Integrity Stopgaps

| Fix | Root Cause | Solution |
|---|---|---|
| Credential corruption | `credentials.getOne` returned AES ciphertext → form re-submitted it → double encryption | Ciphertext never leaves server (`select:` omits `value`); `update` accepts optional `value`; UI: "leave blank to keep current" |
| Double quota burn | `workflows.execute` consumed quota AND dispatcher consumed again | Single consumption point in `sendWorkflowExecution`; router maps `QuotaExceededError` → tRPC FORBIDDEN |

---

## 3. Phase 1 — Editor Correctness

### 3.1 Single Source of Truth (the critical refactor)

**Before:** `<Editor>` held nodes/edges in local `useState` while node components called `useReactFlow().setNodes()` directly. React Flow's internal store diverged from Editor's snapshot; `applyNodeChanges(changes, staleSnapshot)` resurrected deleted nodes and dropped new ones.

**After:** All graph state lives in jotai atoms (`editorNodesAtom`, `editorEdgesAtom`). A single writable atom — `applyGraphChangeAtom` — is the only mutation path; it atomically pushes an undo entry, marks the canvas dirty, and writes new state against the live store (no stale closures). A `useGraphMutations()` hook exposes domain operations:

```
addNode · deleteNode · updateNodeData · connectEdge
deleteEdge · reconnectEdge · insertNodeOnEdge · replaceWithHistory
```

Migrated callers: node selector, base trigger/execution nodes (delete), all 8 action-node config dialogs (`updateNodeData`).

### 3.2 Refetch-Clobber Protection

Server→canvas sync now compares **normalized graph signatures** (ids/types/positions/data + edge topology, ignoring React Flow bookkeeping). Sync happens only when signatures differ *and* canvas is clean — renaming a workflow no longer wipes unsaved drags.

### 3.3 Server-Side Graph Validation

New `graph-validation.ts` rejects: duplicate node IDs, edges referencing missing nodes, self-loops, duplicate connections, cycles (iterative three-colour DFS), trigger-less workflows, INITIAL mixed with real nodes. Prisma P2002/P2003 map to friendly CONFLICT/BAD_REQUEST instead of raw 500s.

### 3.4 UX Safety Net

Dirty dot on Save button, `beforeunload` guard, delete-confirmation dialog, Save blocked during AI Draft Preview (previously persisted unapproved drafts), transient atoms reset on editor unmount.

---

## 4. Phase 2 — Engine Trustworthiness

| Capability | Implementation |
|---|---|
| Per-node persistence | New `ExecutionNodeRun` model; idempotent upserts keyed `[executionId, nodeId]` survive Inngest retries; timeline UI polls every 3s while RUNNING |
| Timeouts | ky 30s · AI SDK abortSignal 120s · SMTP connection/socket · Google Sheets `withTimeout` race |
| Failure publishing | `onFailure` publishes error statuses to every node channel (P2025-guarded) — canvas never sticks on "loading" |
| Official realtime | Replaced private-API publish shim with `realtimeMiddleware()` from `@inngest/realtime/middleware` |
| Token auth | All 11 realtime token server actions require an authenticated session; null-token failures rethrow |
| Reaper | `/api/cron/executions-reaper` fails executions stuck RUNNING >15 min |
| Webhook hardening | Header-only secrets (query-param removed), per-workflow encrypted secrets, Stripe multi-secret HMAC verification, activation gating (409), sliding-window rate limit |
| Trigger fixes | Apps Script generator emits secret header; Stripe variable docs corrected to actual payload shape |

---

## 5. Phase 3 — Builder Productivity

| Feature | Notes |
|---|---|
| Undo / redo | 50-step history via `historyPast/FutureAtom`; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; drag-start snapshots |
| Searchable picker | Filters label/description/manifest aliases; cards draggable onto canvas (HTML5 DnD → `screenToFlowPosition`) |
| Edge intelligence | Custom `WorkflowEdge`: select-to-insert-node-between or delete; `edgesReconnectable` for handle dragging |
| Activation lifecycle | `Workflow.active` column, Switch + Badge on list cards, webhook gating |
| Version history | Snapshot on every save (20-version retention); restore auto-saves current state first (reversible) |
| Duplicate / Import / Export | Deep copy with fresh IDs + remapped connections; JSON round-trip through editor menu |
| Variable picker | Computes upstream variables by reverse-BFS over ancestor nodes, flattening their zod output schemas to dotted paths; click-to-insert chips |
| Inline credentials | Quick-create form inside every credential dropdown (name + value) |
| Model selection | OpenAI/Anthropic/Gemini model selects; executors read `data.model` with backwards-compatible defaults |
| Test step | `workflows.testNode` runs one node synchronously with mocked step tools; results toast with output/error |
| Multiplexed realtime | One SSE subscription per distinct node type on canvas feeding a shared status atom (was N subscriptions for N nodes) |

---

## 6. Key Files Touched

```
src/features/editor/store/atoms.ts          # graph store + undo/redo atoms
src/features/editor/hooks/use-graph-mutations.ts
src/features/editor/hooks/use-node-statuses.tsx   # multiplexed realtime provider
src/features/editor/components/editor.tsx   # atom-driven canvas, DnD, shortcuts
src/features/workflows/server/routers.ts    # validation, versions, dup, testNode...
src/features/workflows/server/graph-validation.ts
src/features/credentials/server/routers.ts  # ciphertext containment
src/inngest/functions.ts                    # middleware publish, node-run records
src/inngest/node-run-store.ts               # ExecutionNodeRun writers
src/inngest/channels/registry.ts            # NodeType→channel map
src/app/api/webhooks/_security.ts           # secrets, gating, rate limiting
src/app/api/cron/executions-reaper/route.ts
src/components/react-flow/workflow-edge.tsx # interactive edge
src/features/editor/components/node-config-extras.tsx  # pickers, test button
prisma/migrations/20260826120000_workflow_active_and_node_runs/
```

## 7. Follow-ups Handed Off

1. Run DB migration (`Workflow.active`, `ExecutionNodeRun`)
2. Register reaper cron endpoint
3. Rotate Polar webhook secret exposed in git-ignored notes file
4. ESLint currently broken by TS7-beta vs typescript-estree (environmental, pre-existing)
