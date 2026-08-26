# 🎤 Interview Guide — a8n Workflow Automation Platform

> Talking points, architecture stories, and deep-dive answers for presenting this project in interviews.

---

## 1. Elevator Pitch (30 seconds)

> "a8n is an AI-native workflow automation platform — an n8n-style visual builder where users drag nodes onto a canvas, connect them into a DAG, and execute them durably. It's built on Next.js 16 with a fully type-safe tRPC API, PostgreSQL via Prisma, and Inngest for durable execution with automatic retries. What makes it different is the built-in LangGraph agent that turns natural language into verified workflow drafts, and first-class MCP App support so workflows can be driven from Claude or ChatGPT through interactive embedded UIs."

---

## 2. Architecture Summary (memorize this flow)

```
User → React Flow canvas (jotai single source of truth)
     → tRPC mutation (zod-validated, ownership-scoped)
     → Inngest event dispatch (quota guard, kill switch)
     → Durable step function: create-execution → topological sort
       → node loop (per-node executor + ExecutionNodeRun records)
     → update-execution (SUCCESS/FAILED via onFailure)
     → Realtime status streamed to canvas per node
```

**Stack one-liners:**
- **Next.js 16 App Router** — RSC prefetching of tRPC queries, server components for auth gating
- **tRPC v11 + zod** — end-to-end types; input schemas double as runtime validation
- **Inngest v4** — retries (3× prod), memoized steps, realtime pub/sub channels, failure handler
- **React Flow v12** — controlled mode over jotai atoms; custom nodes/edges
- **Prisma 7 + Postgres/pgvector** — normalized graph model + agent embeddings
- **LangGraph** — state-machine agent with human-in-the-loop approvals

---

## 3. Star Stories (challenges you *actually* solved)

### Story A — "The editor corrupted graphs" (state management)

**S:** Users' newly added nodes vanished and deleted nodes reappeared after dragging.
**T:** Find the root cause and make editing deterministic.
**A:** Discovered a controlled-vs-imperative split: the canvas was controlled (`useState` + `applyNodeChanges`) but 11 call-sites mutated React Flow's internal store directly. Every imperative write desynced the snapshot that the next change-application used.
**R:** Centralized all mutations into a jotai atom store behind one `applyGraphChangeAtom` write path that also pushes undo history and dirty flags atomically. Zero stale-closure bugs because atom writes read live store state. This became the foundation for undo/redo, import, and version restore — features that were impossible before.

**Follow-up questions you can handle:**
- *Why jotai over zustand/redux?* Atomic, dependency-free writes with `atom(null, (get,set)=>...)` give transactional reads of current state inside write actions — exactly what graph mutations need.
- *Why not useReactFlow everywhere?* Controlled mode gives us save/diff/validation ownership; the instance store is a cache, not a source of truth.

### Story B — "Silent credential corruption" (data integrity)

**S:** Editing any credential permanently broke it — undetectable until a workflow failed at runtime.
**T:** Stop active corruption without breaking edit flows.
**A:** Root cause: `getOne` returned AES ciphertext, the form seeded it as the password value, and saving re-encrypted ciphertext. Classic secret round-trip bug.
**R:** Applied two rules — secrets never leave the server (`select:` omits the column), and updates only encrypt when a new value is supplied ("leave blank to keep current"). Generalized later: webhook trigger secrets are encrypted server-side via a dedicated procedure whose response returns only ciphertext so the canvas can persist it.

**Lesson to state:** *"Any round-trip of encrypted material through a form is a corruption bug waiting to happen."*

### Story C — "Executions were a black box" (observability)

**S:** When a workflow failed, users saw one error string — no idea which node failed or why.
**T:** Per-node observability without breaking durable execution semantics.
**A:** Options were logging-only (lost on restart) vs. full event sourcing (overkill). Chose a middle path: persist per-node runs to an `ExecutionNodeRun` table written around each executor call, using idempotent upserts keyed `[executionId, nodeId]`.
**R:** Inngest retries re-run code paths, so naive inserts would duplicate rows — the upsert design makes retries free. Writes are wrapped in try/catch because *observability must never break execution*. Built a timeline UI that polls every 3s while RUNNING and stops when terminal.

**Follow-up:** *Why polling instead of websockets?* Node-level status already streams via Inngest Realtime SSE during the run; polling is only for the historical timeline, where simplicity beats socket infrastructure.

### Story D — "The engine trusted its inputs too much"

**S:** Saving a graph with a dangling edge caused a raw Prisma FK 500; cycles only surfaced at runtime.
**T:** Validate graphs before they touch the database.
**A:** Implemented server-side validation (never trust the client): unique IDs, referential integrity, duplicate/self connections, cycle detection with iterative three-colour DFS (recursive DFS blows the stack on large graphs), trigger-presence rules. Mapped Prisma P2002/P2003 to friendly tRPC errors as defense-in-depth.
**R:** Users now get actionable messages like "This workflow contains a circular connection."

### Story E — "Security review findings" (say these proactively)

- All 11 realtime token server actions were unauthenticated → added session guards.
- Webhook secrets accepted via query param (leaks into access logs) → header-only.
- Added activation gating so inactive workflows reject webhooks with 409, plus rate limiting.
- Replaced an SDK-private-API publish shim with the official `realtimeMiddleware()` after diagnosing why the shim existed (type lag between packages) — documented with a targeted cast instead of `any`.

---

## 4. Deep-Dive Topics (know these cold)

| Topic | Your answer skeleton |
|---|---|
| **DAG execution order** | `toposort` package; disconnected nodes get synthetic self-edges; cycle error mapped to user message; branches execute serially (documented trade-off) |
| **Idempotency** | `Execution.inngestEventId @unique` anchors the row to the event; node-run upserts; step memoization makes retries resume mid-workflow |
| **Retry policy** | 3× in prod, 0 in dev; config errors throw `NonRetriableError` to avoid wasted retries |
| **Multi-tenancy** | Every tRPC procedure scopes by `userId` in the `where` clause; executions scoped via relation `workflow.userId` |
| **Quotas** | Advisory-lock transactions count+insert atomically; upgrade modal wired to structured FORBIDDEN payloads |
| **Encryption** | Cryptr AES-256 at rest; keys from env; plaintext never crosses the API boundary |
| **Undo/redo design** | Snapshot stack (50 entries) pushed before each mutation via the same atomic write path — not command-pattern diffs, chosen for simplicity and correctness under React Flow's change objects |

---

## 5. Numbers Worth Quoting

| Metric | Value |
|---|---|
| Node types implemented | 12 executors (3 triggers, 9 actions), zero stubs |
| tRPC procedures (workflows domain) | 13 (7 original + 6 added in hardening) |
| Defects fixed in hardening | 40+ across 4 phases |
| Test suites passing | 58/58 API unit+contract · 94/94 MCP |
| Undo history depth | 50 snapshots |
| Version retention | 20 per workflow |
| Outbound timeouts | HTTP 30s · AI 120s · SMTP/Sheets 30s |
| MCP tools | 57 across 8 domains, 4 ext-app widgets |

---

## 6. Honest Limitations (interviewers respect this)

1. Branches execute serially — parallel execution is future work (Inngest supports fan-out).
2. Webhook rate limiting is per-instance in-memory — production needs Redis/upstash.
3. No IF/switch branching nodes yet — strictly linear DAGs today.
4. Scheduled/cron triggers not yet implemented.
5. ESLint currently broken by TypeScript-7-beta vs typescript-estree incompatibility (pinned env issue).

Framing line: *"I audited my own project like a hostile reviewer, wrote the findings down, and fixed the critical ones — the remaining list is documented and prioritized."*

---

## 7. Likely Interview Questions → One-Line Answers

**Q: Why Inngest instead of BullMQ / plain cron?**
Durable step functions with automatic memoization, built-in retries, realtime channels, and a dashboard — building all that on Redis queues would be its own project.

**Q: How do you prevent one tenant seeing another's data?**
Ownership scoping in every Prisma `where` clause + auth-guarded server actions + session-checked token minting. The audit caught cross-tenant channel leakage; channels remain global names but tokens now require auth (documented next step: per-user channel scoping).

**Q: Walk me through what happens when I click Execute.**
Dispatch → quota check once → Inngest event with generated event ID → durable function creates Execution row → fetch + topologically sort the graph → loop nodes through their executors (publishing loading/success/error to channels, writing ExecutionNodeRun rows) → mark SUCCESS with final context; failures retry then onFailure marks FAILED and publishes errors to the canvas.

**Q: What would you build next?**
MCP advancement (Phase 4): unify the editor and MCP graph-mutation paths, feed the new ExecutionNodeRun data into the existing execution-timeline widget, and add a live run-monitor widget.

**Q: Hardest bug?**
The controlled/imperative React Flow desync — symptoms looked random (nodes vanishing) but the cause was architectural. Fixing it required refactoring 11 call sites through one mutation path, which then unlocked five features for free.
