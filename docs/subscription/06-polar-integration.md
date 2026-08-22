# 06 — Polar Integration: Webhooks, Sync & Reconciliation

> Audience: engineering. Polar remains merchant-of-record; this doc defines how *our* entitlement mirror stays correct.

## 1. Webhook endpoint

New route: `src/app/api/webhooks/polar/route.ts`

```ts
export async function POST(req: Request) {
  const raw = await req.text();                       // RAW body — never req.json() first
  const valid = await validatePolarWebhook(raw, req.headers); // Polar SDK webhook util
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(raw);
  const stored = await prisma.processedWebhookEvent
    .create({ data: { id: event.id, type: event.type, payloadHash: sha256(raw) } })
    .catch(() => null);
  if (!stored) return Response.json({ ok: true, deduped: true }); // PK conflict ⇒ replay

  await applySubscriptionEvent(event);                // §2
  return Response.json({ ok: true });
}
```

Non-negotiables:

1. **Signature verification before anything else.** Polar signs deliveries (Webhook-Signature header scheme); verification uses `POLAR_WEBHOOK_SECRET` added to `src/env.ts` as a **required-in-production** secret alongside the existing POLAR vars.
2. **Raw-body handling.** Verification must run on the exact bytes received (same discipline as the existing Stripe trigger route).
3. **Dedup by event id via PK insert** (`ProcessedWebhookEvent`, doc 04). Polar retries on non-2xx; our handler is idempotent so replays are harmless no-ops.
4. **Respond fast, process inline.** Event application is a single upsert — well under any timeout. No queue needed at current volume; revisit if >1 webhook/sec sustained.

Register the URL in the Polar dashboard for events listed in §2. Add the route to the deployment checklist next to the existing Stripe trigger webhook docs.

## 2. Events handled

| Polar event | Action |
|---|---|
| `subscription.created` | Upsert Subscription `{ status, planId: mapProduct(product), currentPeriodEnd, cancelAtPeriodEnd:false }` |
| `subscription.updated` | Same upsert (covers plan changes, renewals, `cancelAtPeriodEnd` flips) |
| `subscription.active` | status=`active` |
| `subscription.canceled` | status=`canceled`; keep `currentPeriodEnd` → resolver grants Pro until then |
| `subscription.past_due` / `uncanceled` / `incomplete` | Mirror status verbatim; resolver treats only `active` (+ grace rule below) as paid |
| `customer.updated` (if subscribed to it) | Refresh `polarCustomerId ↔ userId` linkage |

**Product→plan mapping:** `event.product_id === env.POLAR_PRO_PRODUCT_ID ? "pro" : "free"`. Unknown products map to `free` and raise an alert — never silently grant entitlements.

**Grace rule:** statuses `past_due`/`trialing` are configurable in `plans.ts` (`GRACE_STATUSES`); default policy = treat `past_due` as still-Pro until `currentPeriodEnd` (dunning window), because Polar retries collection before final cancellation.

## 3. User↔customer linkage

Today `createCustomerOnSignUp` sets Polar `externalId = user.id`. All lookups (`getStateExternal({ externalId })`) key off that. The webhook payload carries the same external id; `applySubscriptionEvent` resolves `userId = event.data.customer.externalId`.

Defensive check: if `externalId` is missing or matches no local user → **do not guess**, log `billing.webhook.unlinked_customer` with the customer id, store nothing, return 200 (prevents retry storms), alert. Reconciliation (§5) repairs linkage later from the Polar side of truth.

## 4. Checkout success path

Existing flow kept: sidebar/modal → `authClient.checkout({ slug: "pro" })` → hosted Polar page → redirect to `POLAR_SUCCESS_URL`.

One addition: the success page component calls `refetchSubscriptionState()` which invokes the per-user sync endpoint below, closing the "webhook slower than redirect" gap. The UI shows an optimistic "activating…" state until the snapshot reflects `pro` (max ~seconds; hard timeout falls back to "check back shortly", never a false success).

## 5. On-demand user reconciliation

New authenticated tRPC mutation `subscriptions.syncNow`:

```ts
// rate-limited: max 3 calls/user/hour (abuse guard)
const state = await polarClient.customers.getStateExternal({ externalId: ctx.auth.user.id });
await upsertSubscriptionFromCustomerState(state);   // same normalizer as webhooks
return snapshotFor(ctx.auth.user.id);
```

Used by: checkout success page, billing-portal return, support flows. It's the *only* request-path code allowed to call Polar — and it's opt-in/rare, not hot-path. Normalizer is shared with the webhook handler so both paths produce identical rows (single mapping function = single place to get right).

## 6. Scheduled full reconciliation

Daily job following the established cron-route pattern (`src/app/api/cron/mcp-maintenance/route.ts`):

```
POST /api/cron/billing-reconcile   (Bearer CRON_SECRET or dedicated BILLING_RECONCILE_SECRET)

for each Subscription row (and each Polar customer, paginated):
    expected = normalize(polar.customers.getStateExternal(externalId))
    actual   = db.Subscription
    if differs → upsert expected, log drift {userId, field, was, now}
if UsageCounter.used ≠ AgentRun.count(window) → reset counter to DB truth, log drift
alert (Sentry/observability channel) on ANY drift event beyond threshold
```

Properties:

- **Polar wins conflicts.** The mirror's purpose is fidelity to billing reality.
- Counters self-heal toward `AgentRun` counts (the immutable ledger), not vice versa.
- Runs are paginated + serialized to stay under rate limits; job duration logged as metric.
- Secret-guarded exactly like the MCP maintenance route; disabled (503) in dev unless configured.

## 7. Failure & degradation matrix

| Scenario | Behaviour |
|---|---|
| Polar API down, user browses/creates within quota | Fully functional (no Polar calls on these paths) |
| Polar API down, checkout attempted | Checkout page unreachable — acceptable; enforcement unaffected |
| Polar down during `syncNow` | Return stale snapshot + `stale:true` flag; UI keeps meters |
| Webhook secret rotated | Old signatures fail 401; rotate in dashboard+env together; alerts fire on 401 spikes |
| Missed/dropped webhook | Next daily reconcile repairs; worst case one day of stale entitlements; `syncNow` available sooner |
| Duplicate webhook delivery | Dedup table no-ops it |
| Out-of-order webhooks (updated then older created redelivered) | Handler compares `event.timestamp` vs row `lastSyncedAt`; stale events skipped |

## 8. Config additions (`src/env.ts`)

| Var | Required | Notes |
|---|---|---|
| `POLAR_WEBHOOK_SECRET` | prod: yes | signature verification |
| `POLAR_PRO_PRODUCT_ID` | yes | replaces hardcoded UUID in auth.ts |
| `POLAR_SERVER` (`sandbox\|production`) | yes | replaces hardcoded `"server:"sandbox"` in polar.ts |
| `BILLING_RECONCILE_SECRET` | prod: yes | cron auth |
| `FREE_MAX_WORKFLOWS`, `FREE_MAX_CREDENTIALS`, `FREE_AGENT_CHATS_PER_MONTH`, `PRO_AGENT_CHATS_PER_MONTH` | no | defaults from plans.ts |

Production validation block (`env.ts:348-370`) extended to enforce the new required vars — deploy fails fast rather than running unverified.
