# 02 — Current State Analysis (Code Audit)

> Audience: engineering. Every claim below was verified against the working tree on 2026-08-22.
> Result of this audit drives the target design in [03-architecture.md](03-architecture.md).

## 1. What exists today

### 1.1 Billing provider: Polar.sh via Better Auth plugin

`src/lib/auth.ts:84-107` wires the `@polar-sh/better-auth` plugin with a **single hardcoded product**:

```ts
polar({
  client: polarClient,
  createCustomerOnSignUp: true,   // Polar customer created with externalId = user.id
  use: [
    checkout({
      products: [{ productId: "58285280-605b-468f-b711-5b5c9ff936bd", slug: "pro" }],
      successUrl: env.POLAR_SUCCESS_URL,
      authenticatedUsersOnly: true,
    }),
    portal(),
  ],
}),
```

`src/lib/polar.ts` (entire file):

```ts
export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",   // hardcoded; DEPLOYMENT.md says flip to "production" manually
});
```

The client hooks (`useSubscription`, checkout trigger) live in:
- `src/features/subscriptions/hooks/use-subscription.ts`
- `src/components/app-sidebar.tsx:127-148` ("Upgrade to Pro" + "Billing Portal" buttons)
- `src/components/upgrade-modal.tsx` + `src/hooks/use-upgrade-modal.tsx` (modal on tRPC FORBIDDEN)

### 1.2 The entire "plan system" is one procedure

`src/trpc/init.ts:220-251` — `premiumProcedure`:

```ts
const customer = await polarClient.customers.getStateExternal({ externalId: ctx.auth.user.id });
if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
}
```

Properties worth noting:

- **Binary.** No plans, no quotas — "subscribed" vs not.
- **Synchronous external call per request.** Every gated mutation pays a Polar API round-trip.
- **Fail-closed on outage:** if Polar is down/unreachable the mutation fails (acceptable for *paid-only* actions, unacceptable once free users depend on the same code path for core flows).
- E2E mock at `init.ts:82-89`: any user whose id/email contains `"pro"` gets an active subscription when `E2E_EXTERNAL_SERVICES=mock`.

### 1.3 Enforcement points (complete list)

| Location | Gate | Notes |
|---|---|---|
| `src/features/workflows/server/routers.ts:28` | `premiumProcedure` | `workflows.create` only. All other workflow procedures (`execute`, `remove`, `update`, `updateName`, `getOne`, `getMany`) are `protectedProcedure`. |
| `src/features/credentials/server/routers.ts:9` | `premiumProcedure` | `credentials.create`. Free users cannot create credentials → their workflows can't connect to anything. |
| `src/mcp/middleware/subscription-guard.ts` | manual check | Duplicate logic of premiumProcedure for MCP tools (`create-workflow.tool.ts:49`, `workflow-drafts.tool.ts:7`, `workflow-versioning.tool.ts:7`). |

**Not gated anywhere:** agent threads (`createThread`, `ensureThread` in `src/features/agent/server/routers.ts`), agent runs (SSE route `src/app/api/agent/threads/[threadId]/runs/route.ts`), executions.

### 1.4 What the database knows about billing

**Nothing.** `prisma/schema.prisma` has no `Subscription`, `Plan`, `Quota`, or `Usage` models. Subscription state lives exclusively inside Polar. Closest things:

- `McpRateLimitBucket` (`schema.prisma:314-327`) — per-identifier rate-limit buckets with a `tier` column, used by MCP middleware only.
- `AgentRun.inputTokens / outputTokens / estimatedCostUsd` (`schema.prisma:381-383`) — columns exist but **no application code ever writes them** (verified by grep). Metering infrastructure is pre-wired and unused.

### 1.5 Existing limits that already work

These are plan-independent today but are useful building blocks:

| Limit | Value | Location |
|---|---|---|
| Message length | 20,000 chars (zod) | runs route line 11 |
| Agent input policy | hard cap 10,000 chars | `src/agent/safety/agent-input-policy.ts:18` |
| Max graph steps / tool calls | 20 / 30 | `src/agent/config.ts:9-10` |
| Concurrent agent runs/user | 2 (throws `AGENT_RUN_LIMIT_EXCEEDED`) | `src/agent/concurrency.ts:23-39` |
| Per-run cost budget | $0.50 default — `assertRunBudget()` defined in `src/agent/model/cost.ts:53-64` but **never called** | `src/agent/config.ts:19` |
| MCP rate limit | 30/min free-tier constant, 120/min pro constant | `src/mcp/config.ts:44-52`, applied in `src/mcp/middleware/rate-limiter.ts` |

### 1.6 Background jobs & cron pattern

- Inngest registers exactly one function: `executeWorkflow` (`src/inngest/functions.ts:78`). No cron functions exist yet.
- A bearer-secret-guarded cron route exists at `src/app/api/cron/mcp-maintenance/route.ts` calling `runMcpProductionMaintenance()` — the established pattern for scheduled maintenance (cleanup of OAuth artifacts, audit logs, expired rate-limit buckets).

## 2. Gap analysis

| # | Gap | Impact | Severity |
|---|---|---|---|
| G1 | Free tier unusable: creation fully paywalled | Zero activation before payment; contradicts marketing page | 🔴 Critical |
| G2 | Agent chat unmetered for all users | Unbounded LLM cost exposure; Pro gets no chat advantage | 🔴 Critical |
| G3 | No local subscription state; every check = live Polar call | Latency on every gated action; hard runtime coupling; fail-closed blocks even free users' would-be features during Polar incidents | 🔴 Critical |
| G4 | No quota data model or usage counters | Cannot express "5 workflows" anywhere | 🔴 Critical |
| G5 | Race conditions possible on any count-based limit we add naively (read-count-then-create) | Limit bypass under concurrent requests | 🟠 High |
| G6 | No webhook receiver for subscription lifecycle events | Local mirror (once added) could go stale between reconciliation runs | 🟠 High |
| G7 | Duplicated entitlement logic (tRPC vs MCP guard) | Drift risk — two code paths must stay consistent | 🟡 Medium |
| G8 | MCP rate limiter always uses tier `"free"` — `src/app/api/mcp/route.ts:251` calls `checkRateLimitForRequest(key)` without passing the user's real tier | Subscribers get 30 req/min instead of 120 | 🟡 Medium |
| G9 | Hardcoded product ID inline in auth.ts; `server:"sandbox"` hardcoded in polar.ts | Config drift risk at production cutover | 🟡 Medium |
| G10 | Upgrade modal shows generic message; no usage meters; pricing page overpromises (7-day history doesn't exist) | Poor conversion UX; trust erosion | 🟡 Medium |
| G11 | Token/cost metering unwired (`AgentRun.*Tokens`, `estimateCost`, `assertRunBudget` all orphaned) | Can't measure true cost per user/tier. *Note: D2 wires `assertRunBudget` in v1; token analytics remain v2.* | 🟢 Low (v2) |
| G12 | Landing-page execution-history promise unimplemented | v2 scope | 🟢 Low (deferred) |

## 3. What we keep as-is

Deliberate reuse decisions (cheaper, safer than rebuilding):

1. **Polar stays** as merchant-of-record + checkout + customer portal. The Better Auth plugin's checkout/portal UX works and is already styled into the sidebar/modal.
2. **The upgrade-modal error flow** (`FORBIDDEN` → modal) generalizes cleanly: we'll extend it to read structured quota metadata instead of a generic message (doc 05 §6).
3. **E2E mock seam** (`createE2ECustomerState`) extends naturally to mocked plan states.
4. **Cron-route pattern** (`mcp-maintenance`) is the template for the reconciliation job.
5. **Agent concurrency limiter** stays independent of billing — it's a stability control, not a business control.

## 4. Consequences for the design

- We need a **local entitlement store** (G3, G4) — doc 04 defines schema.
- Enforcement must move from "is subscribed?" to **plan-aware quota checks** (G1, G2) — doc 05.
- Quota checks must be **atomic** (G5) — advisory lock / conditional-update patterns, doc 05 §3.
- A **webhook receiver + reconciliation** closes sync gaps (G6) — doc 06.
- One shared **entitlement service** replaces both `premiumProcedure` internals and `requireActiveSubscription` (G7).
- Plan config becomes a first-class module (G9) — doc 03 §2.
