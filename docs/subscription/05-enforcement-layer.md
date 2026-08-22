# 05 — Enforcement Layer (Code-Level Plan)

> Audience: engineering. Exact changes per enforcement point.
> Every snippet shows the **target shape**; final code follows existing repo conventions (superjson tRPC, zod, Prisma singleton).

## 1. New shared procedures in `src/trpc/init.ts`

`premiumProcedure` is replaced by two composable, plan-aware procedures:

```ts
/** Resolves the effective plan from the local mirror. Never throws for
 *  billing reasons; always provides ctx.plan. Replaces raw protectedProcedure
 *  wherever the UI needs plan context. */
export const planProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const plan = await getEffectivePlan(ctx.auth.user.id);   // local DB only
  return next({ ctx: { ...ctx, plan } });
});

/** Gates a mutation behind an available stock slot (workflows/credentials). */
export function quotaProcedure(feature: "workflow" | "credential") {
  return planProcedure.use(async ({ ctx, next }) => {
    const result = await reserveStockSlot(ctx.auth.user.id, feature, ctx.plan);
    if (!result.allowed) throw quotaError(result);          // see §6
    return next({ ctx: { ...ctx, reservation: result.reservation } });
  });
}
```

Key properties:

- `getEffectivePlan()` reads `Subscription` row → applies status + `currentPeriodEnd` logic → defaults `"free"`. Pure local read; Polar unreachable ≠ user blocked (fixes G3 fail-closed-on-free problem).
- `quotaProcedure("workflow")` performs the advisory-locked count-and-create reservation (doc 03 §5.1). The reservation is consumed by the mutation that follows; if the mutation itself fails, the transaction rolls back together — no orphaned slots because the count check and insert share one transaction.

E2E compatibility: keep the existing `createE2ECustomerState` seam — when `E2E_EXTERNAL_SERVICES=mock`, `getEffectivePlan` returns `pro` for ids/emails containing `"pro"`, `free` otherwise. Same convention as today (`src/trpc/init.ts:82-89`), so existing E2E suites keep passing.

## 2. Workflow creation — `src/features/workflows/server/routers.ts`

```diff
- create: premiumProcedure.mutation(({ ctx }) => {
-   return prisma.workflow.create({ ... });
- }),
+ create: quotaProcedure("workflow").mutation(async ({ ctx }) => {
+   // runs inside the same transaction opened by reserveStockSlot:
+   return prisma.workflow.create({
+     data: {
+       name: generateSlug(3),
+       userId: ctx.auth.user.id,
+       nodes: { create: { type: NodeType.INITIAL, position: { x: 0, y: 0 }, name: NodeType.INITIAL } },
+     },
+   });
+ }),
```

All other workflow verbs stay `protectedProcedure` — editing/deleting/running remains free-tier legal (business rule: never block access to existing data).

## 3. Credential creation — `src/features/credentials/server/routers.ts`

```diff
- create: premiumProcedure.mutation(...),
+ create: quotaProcedure("credential").mutation(...),
```

Business rationale: free users need credentials to make their 5 workflows functional. Limit 10 (doc 01) prevents abuse without blocking usefulness.

## 4. Agent chat — SSE run route

File: `src/app/api/agent/threads/[threadId]/runs/route.ts`. This route bypasses tRPC (raw SSE), so it calls the entitlement service directly — **the service, not copy-pasted logic** (fixes G7 drift risk).

Insert after session validation, before run creation:

```ts
const entitlement = await consumeChatQuota(user.id);        // atomic conditional increment
if (!entitlement.allowed) {
  return quotaDeniedSseResponse(entitlement);               // structured payload, see below
}
```

Ordering matters (doc 07 §3):

1. authn (existing) →
2. thread ownership check (existing) →
3. input validation (existing zod) →
4. concurrency check (`AGENT_MAX_CONCURRENT_RUNS`, existing) →
5. **quota consume (new)** →
6. create AgentRun row (existing idempotent upsert) →
7. dispatch stream.

The quota increment happens **before** the LLM call and is not refunded on failure (policy documented in doc 03 §5.2). Because step 6 upserts on `(threadId, clientMessageId)`, a client retry with the same `clientMessageId` must not double-consume: `consumeChatQuota` accepts the `clientMessageId` and short-circuits if an AgentRun with that key already exists (same idempotency key as the run row).

Denial response shape (JSON over the SSE endpoint's pre-stream phase):

```jsonc
// HTTP 402 Payment Required, body:
{ "error": "QUOTA_EXCEEDED", "feature": "agent_chat", "used": 25, "limit": 25,
  "windowResetAt": "2026-09-01T00:00:00Z", "upgradeUrl": "/checkout/pro" }
```

`402` chosen deliberately: unambiguous, not colliding with auth (401) or rate limits (429), and machine-actionable by the composer UI to show the upgrade banner.

## 5. MCP surfaces

1. Delete `src/mcp/middleware/subscription-guard.ts` (`requireActiveSubscription`) — replaced by `requireEntitlement(tool)` from the shared service. Tools like `create-workflow.tool.ts:49` swap one import for another; behaviour for Pro users unchanged, free users now allowed within quotas (consistent with the app path).
2. Fix tier plumbing bug G8: `src/app/api/mcp/route.ts:251` passes the resolved plan into `checkRateLimitForRequest(key, tier)` — the limiter already supports `"free" | "pro"` (`rate-limiter.ts:58-67`); it just never receives the real value.

## 6. Error translation helper

Single factory used by both tRPC and REST/SSE surfaces:

```ts
export function quotaError(r: QuotaCheckResult): TRPCError {
  return new TRPCError({
    code: "FORBIDDEN",
    message: r.reason,                 // human sentence for logs/fallbacks
    data: {
      code: "QUOTA_EXCEEDED",
      feature: r.feature,
      plan: r.plan,
      used: r.used,
      limit: r.limit,
      windowResetAt: r.windowResetAt?.toISOString() ?? null,
      upgradeUrl: "/checkout/pro",
    },
  });
}
```

Client-side, `useUpgradeModal().handleError` gains one branch:

```ts
if (err.data?.code === "QUOTA_EXCEEDED") {
  openUpgradeModal({ feature: err.data.feature, used: err.data.used,
                     limit: err.data.limit, resetAt: err.data.windowResetAt });
  return;
}
// existing generic FORBIDDEN handling stays as fallback
```

Modal copy maps feature → message ("You've used 5 of 5 free workflows — upgrade to Pro for unlimited").

## 7. Entitlement snapshot endpoint (UI meters)

New tRPC query on a `plansRouter` (or added to subscriptions router):

```ts
getSnapshot: protectedProcedure.query(async ({ ctx }) => snapshotFor(ctx.auth.user.id));
// → { plan: "free",
//     workflows: { used: 3, limit: 5 },
//     credentials: { used: 2, limit: 10 },
//     chats:      { used: 18, limit: 25, windowEnd: "2026-09-01T..." } }
```

Consumed by the sidebar usage meter (`app-sidebar.tsx`), react-cached with a 30s staleness window and invalidated after any create/delete/chat action. Cheap: three indexed reads per fetch.

## 8. Files touched summary

| File | Change |
|---|---|
| `src/config/plans.ts` | NEW — tier definitions + env overrides |
| `src/lib/entitlements/*` | NEW — resolver, checker, consumers, snapshot, errors |
| `src/trpc/init.ts` | add `planProcedure`, `quotaProcedure`; deprecate `premiumProcedure` |
| `features/workflows/server/routers.ts` | `create` → `quotaProcedure("workflow")` |
| `features/credentials/server/routers.ts` | `create` → `quotaProcedure("credential")` |
| `app/api/agent/threads/[threadId]/runs/route.ts` | quota gate before dispatch |
| `mcp/middleware/*`, `mcp/tools/*` | shared service; fix tier arg at `api/mcp/route.ts` |
| `hooks/use-upgrade-modal.tsx`, `components/upgrade-modal.tsx` | structured quota metadata rendering |
| `components/app-sidebar.tsx`, `components/landing/pricing.tsx` | meters + truthful copy |
| `prisma/schema.prisma` | doc 04 models |

Nothing outside this list needs modification — deliberately small blast radius.
