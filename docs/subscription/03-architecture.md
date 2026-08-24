# 03 — Target Architecture

> Audience: engineering. Prerequisite: [02-current-state-analysis.md](02-current-state-analysis.md).

## 1. Overview

```
                        ┌──────────────────────────────────────────────┐
                        │                  Polar.sh                    │
                        │  checkout · portal · billing · webhooks      │
                        └───────────────┬──────────────────────────────┘
                                        │ signed events (subscription.*
                                        │ payouts of truth for MONEY only)
                                        ▼
┌────────────────┐        ┌──────────────────────────────────────────────┐
│  Browser (UI)  │◄──────►│                a8n Next.js server            │
│  usage meters  │  tRPC  │                                              │
│  upgrade modal │  SSE   │  ┌────────────────┐    ┌──────────────────┐  │
└────────────────┘        │  │ entitlements   │───►│ entitlements     │  │
                          │  │ router (tRPC)  │    │ service          │  │
                          │  └────────────────┘    │ (src/lib/        │  │
                          │  ┌────────────────┐    │  entitlements/)  │  │
                          │  | workflows/     │    └────────┬─────────┘  │
                          │  | credentials/   │             │            │
                          │  | agent routers  ├─────────────┤            │
                          │  └────────────────┘             ▼            │
                          │                     ┌──────────────────┐     │
                          │  MCP tools/routes ──►   PostgreSQL     │     │
                          │  (same service)     │ Subscription     │     │
                          │                     │ UsageCounter     │     │
                          │  cron: reconcile ──►│ ProcessedWebhook │     │
                          │                     └──────────────────┘     │
                          └──────────────────────────────────────────────┘
```

**Core idea:** Polar remains the source of truth for *money*. Our Postgres becomes the source of truth for *entitlements* ("what is this user allowed to do right now?"). The two are kept in sync by signed webhooks (fast path) and a daily reconciliation job (correctness path). All enforcement reads local Postgres — never the Polar API on a request path.

## 2. Plan configuration module

New file `src/config/plans.ts` — **the single place tiers are defined.**

```ts
export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  /** null = unlimited */
  maxWorkflows: number | null;
  maxCredentials: number | null;
  /** agent messages per window; null = unlimited */
  maxAgentChatsPerWindow: number | null;
  chatWindow: "calendar_month";   // both plans use calendar-month windows (decision D1)
  executionHistoryDays: number | null; // v2 (retention job)
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    displayName: "Free",
    maxWorkflows: 5,
    maxCredentials: 10,
    maxAgentChatsPerWindow: 25,
    chatWindow: "calendar_month",
    executionHistoryDays: 7,
  },
  pro: {
    id: "pro",
    displayName: "Pro",
    maxWorkflows: null,
    maxCredentials: null,
    maxAgentChatsPerWindow: 500,
    chatWindow: "calendar_month",
    executionHistoryDays: null,
  },
};
```

Rules:

- Numbers may be overridden via env (`FREE_MAX_WORKFLOWS`, `FREE_AGENT_CHATS_PER_MONTH`, …) parsed in `src/env.ts` with zod, so ops can tune without deploys.
- No other module may hardcode a limit constant. Lint-enforceable by convention + code review.
- The Pro product ID moves here from `auth.ts` (`PRO_PRODUCT_ID` env var), removing the hardcoded UUID and fixing gap G9.

## 3. Entitlement service

New module `src/lib/entitlements/`:

| File | Responsibility |
|---|---|
| `get-plan.ts` | Resolve a user's effective plan from DB (`Subscription` mirror). Defaults to `free` when no row exists. Never calls Polar. |
| `check-quota.ts` | Pure function: `(plan, feature, currentUsage) → { allowed: boolean, reason?, used, limit }`. Unit-testable without DB. |
| `consume.ts` | Atomic reservation of quota units (workflows, chats) — see §5. |
| `snapshot.ts` | Aggregates everything the UI needs: `{ plan, workflows: {used,limit}, chats: {used,limit,windowEnd}, credentials: {...} }` — one call powering meters. |
| `errors.ts` | Throws typed `QuotaExceededError { feature, used, limit, plan, windowResetAt }`; translated to tRPC error metadata at procedure boundaries. |

Design properties:

1. **Read path is one indexed query per counter** — microseconds, no external calls.
2. **Pure decision logic separated from I/O** → trivially unit-testable (doc 08).
3. **Fail-open vs fail-closed policy:** quota *checks* for creation mutations fail **closed** (deny) if the DB is unreachable — because the DB being down means we cannot verify capacity. Reads (snapshots) fail soft to `{ plan: "free", unknown: true }` so UI renders degraded rather than crashing.

## 4. Data flow: subscription lifecycle

### Upgrade (free → pro)

```
User clicks Upgrade → Polar hosted checkout → payment succeeds
  → Polar fires subscription.created / subscription.updated webhook
  → POST /api/webhooks/polar verifies signature + dedupes by event id
  → upserts Subscription row { userId, planId:"pro", status:"active",
                               currentPeriodEnd, polarCustomerId, ... }
  → next request resolves plan=pro, quotas lifted
```

Latency guarantee: webhook typically lands in seconds. If the user returns from checkout before the webhook arrives, the success page triggers a **client-side re-fetch loop** that calls the reconciliation-for-user endpoint (doc 06 §5) — worst case the user waits one extra second; they are never wrongly charged twice (Polar owns charging).

### Downgrade (pro → free at period end)

```
Polar fires subscription.canceled (or updated with status=canceled)
  → webhook updates row: status="canceled", keeps currentPeriodEnd
  → get-plan() treats status active-until-period-end as pro
  → after currentPeriodEnd passes, same resolver yields free
     (pure date comparison — no scheduled job required to flip the flag)
```

This removes an entire class of bugs: there is **no cron needed to downgrade users**, the plan resolver compares `now < currentPeriodEnd` at read time.

## 5. Quota consumption patterns (the consistency core)

Two distinct meter types need two different mechanisms:

### 5.1 Stock meters (workflow count, credential count)

A *stock* = how many entities exist right now. Truth = `COUNT(*)` on the entity table itself. **No separate counter to drift.**

Race-safe create under a limit uses a **transactional advisory lock keyed by user+resource**:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:' || $userId || ':workflow'));
-- inside lock:
SELECT count(*) FROM workflow WHERE user_id = $userId;   -- e.g. 5
IF count >= limit THEN ROLLBACK; throw QUOTA_EXCEEDED; END IF;
INSERT INTO workflow ... ;                                -- workflow #6 blocked, #≤5 fine
COMMIT;
```

Why advisory locks: concurrent double-click creates two requests; both would pass a naive count check (G5). The serializes only quota-critical sections per user (microseconds), while normal CRUD concurrency is untouched. Alternative considered — unique-slot rows (`WorkflowSlot {userId, slot}` with 5 pre-created rows) — rejected: invasive migration, awkward grandfathering.

### 5.2 Flow meters (agent chats per window)

A *flow* = units consumed over time. Truth = increment-only counters.

`UsageCounter { userId, resource: "agent_chat", periodStart, periodEnd, used }`

Atomic consume — single conditional UPDATE, race-free without explicit locks:

```ts
const res = await tx.usageCounter.updateMany({
  where: {
    userId, resource: "agent_chat",
    periodStart: { lte: now }, periodEnd: { gt: now },
    used: { lt: limit },           // ← the guard
  },
  data: { used: { increment: 1 } },
});
// res.count === 0 ⇒ either no active row (create it, then retry once)
//                 or limit reached (throw QuotaExceededError)
```

Because the guard lives **inside the UPDATE's WHERE clause**, two concurrent requests can never both push `used` past `limit` — the database arbitrates.

Window handling: rows are created lazily per user/resource with fixed `[periodStart, periodEnd)` windows — for chats, the **calendar month** (UTC): `periodStart = first day of month`, `periodEnd = first day of next month` (decision D1). A lazy "roll forward" helper creates the current month's row when none exists; stale rows are garbage-collected by the existing maintenance cron pattern.

Drift control (e.g., crash between run start and increment): chat increments happen **before** the agent run is dispatched; a failed run does not refund the message by default (documented policy; refunds possible manually via admin). Counters additionally cross-checked against `AgentRun.count()` in the daily reconciliation job (doc 06 §6).

## 6. Error contract

One machine-readable shape for every limit denial, end to end:

```jsonc
// tRPC error (code: FORBIDDEN), data:
{
  "code": "QUOTA_EXCEEDED",              // distinguishes from generic FORBIDDEN
  "feature": "workflow_create",          // | "credential_create" | "agent_chat"
  "plan": "free",
  "used": 5,
  "limit": 5,
  "windowResetAt": null,                 // ISO date for flow meters, null for stock
  "upgradeUrl": "/checkout/pro"
}
```

Client contract: `useUpgradeModal().handleError` switches on `data.code === "QUOTA_EXCEEDED"` to render the *specific* message ("You've used 5 of 5 free workflows") instead of today's generic text. Backwards compatible: plain `FORBIDDEN` still opens the generic modal.

## 7. Enforcement surface map (target state)

| Surface | Today | Target |
|---|---|---|
| `workflows.create` | premiumProcedure (paywalled) | protectedProcedure + stock-meter check (doc 05 §2) |
| `credentials.create` | premiumProcedure | protectedProcedure + stock-meter check |
| Agent SSE runs route | unprotected | chat flow-meter check before run creation |
| MCP tools | duplicate guard | shared entitlement service (delete `subscription-guard.ts`) |
| MCP rate limiter tier | hardcoded "free" | real plan from snapshot (fixes G8) |
| `premiumProcedure` | live Polar call | thin wrapper: resolve plan locally; kept temporarily for E2E compat, then removed |

## 8. What deliberately stays out

- **No payment logic on our servers.** We never compute charges, prorate, or store card data.
- **No per-token billing in v1.** Token columns stay unwired until v2 (cost analytics only).
- **No admin-impersonation features.** Admin override ships as a single server env var (`ADMIN_USER_IDS`) usable by the reconciliation drill, not a UI.
