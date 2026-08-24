# 04 — Data Model & Migration Plan

> Audience: engineering. Companion to [03-architecture.md](03-architecture.md).
> All additions are **additive** — no existing table or column is altered or removed, so the migration is zero-downtime and trivially reversible.

## 1. Schema additions (Prisma)

Append to `prisma/schema.prisma`:

```prisma
/// Local mirror of Polar subscription state. Source of truth for MONEY is
/// Polar; this row is the source of truth for ENTITLEMENT decisions.
model Subscription {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  polarCustomerId  String?
  polarProductId   String?

  /// "active" | "canceled" | "past_due" | "incomplete" (mirrors Polar statuses)
  status           String

  /// Denormalized plan tier resolved from the Polar product at webhook time.
  planId           String   @default("free")

  /// End of the current paid period. A canceled subscription keeps Pro
  /// benefits until this instant (resolver compares with now()).
  currentPeriodEnd DateTime?

  /// Set when a cancel-at-period-end is requested; lets support explain state.
  cancelAtPeriodEnd Boolean @default(false)

  lastSyncedAt     DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status])
  @@map("subscription")
}

/// Increment-only usage counters for flow meters (agent chats today,
/// executions later). One row per user/resource/window.
model UsageCounter {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// "agent_chat" | future: "workflow_execution"
  resource    String
  periodStart DateTime
  periodEnd   DateTime
  used        Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, resource, periodStart])
  @@index([periodEnd]) // maintenance cron GC of expired windows
  @@map("usage_counter")
}

/// Webhook dedup ledger. Guarantees each Polar event applies at most once.
model ProcessedWebhookEvent {
  id          String   @id            // Polar event id (uuid)
  provider    String   @default("polar")
  type        String                  // e.g. "subscription.updated"
  receivedAt  DateTime @default(now())
  payloadHash String                  // sha256 of raw body, replay forensics

  @@index([receivedAt])
  @@map("processed_webhook_event")
}
```

And on `User`:

```prisma
model User {
  // ... existing fields ...
  subscription Subscription?
  usageCounters UsageCounter[]
}
```

### Design notes

- `Subscription.userId` is `@unique` → one subscription row per user; upsert semantics everywhere. (If we ever sell multiple products per user this becomes a compound key — deferred.)
- `planId` is denormalized on purpose: the entitlement resolver must not re-derive "which product maps to which plan" on every request. The webhook handler owns that mapping (`POLAR_PRO_PRODUCT_ID` env → `"pro"`), and reconciliation validates it.
- `status` kept as string mirroring Polar's vocabulary verbatim — no enum yet, so unknown future statuses don't break ingestion; they just resolve to `free` unless recognized as active.
- `ProcessedWebhookEvent.id` is the **Polar event id** (not a cuid) so dedup is a primary-key insert whose failure = already processed.

## 2. What we intentionally do NOT add

| Considered | Why rejected |
|---|---|
| `Plan` table | Plans are config, not data. DB rows would drift from code and invite runtime mutation of business rules. |
| `plan` column on `User` | Redundant with `Subscription.planId`; putting it on User tempts code to read it directly bypassing the resolver, recreating inconsistency. |
| Workflow counter column/row | Stock meters count the real rows (doc 03 §5.1) — no second source of truth. |
| Per-message chat log | `AgentRun` already records every run with timestamps + unique clientMessageId — sufficient for both metering cross-checks and support disputes. |
| Refund/credit tables | Out of scope v1; refunds handled in Polar portal manually. |

## 3. Migration mechanics

```bash
pnpm prisma migrate dev --name add_subscription_quota_models   # local
pnpm prisma migrate deploy                                     # prod (after review)
```

Properties:

1. **Additive only** — three new tables + nullable relation columns. Existing queries unaffected.
2. **No backfill required for correctness:** users without a `Subscription` row automatically resolve to `free` (resolver default). Rows appear organically via webhooks / signup sync / reconciliation.
3. Optional warm-start backfill script (`scripts/backfill-subscriptions.ts`, run once post-deploy) pulls every known Polar customer via `customers.getStateExternal` and upserts rows — ensures existing Pro subscribers see no flicker between deploy and their next webhook. Idempotent by construction.

## 4. Rollback plan

Because nothing existing changes:

```bash
# revert app code to previous release; leave tables in place (harmless)
# optional cleanup:
pnpm prisma migrate resolve --rolled-back add_subscription_quota_models
```

The `Subscription` mirror can be dropped later without affecting core product data.

## 5. Index & performance review

| Query | Frequency | Plan |
|---|---|---|
| `subscription.findUnique({ userId })` | every gated request | PK-backed unique index → O(1) |
| `usage_counter.findFirst({ userId, resource, periodStart <= now < periodEnd })` | every chat message | composite unique index → O(1) |
| `workflow.count({ userId })` | workflow creation only (rare) | needs `@@index([userId])` on `Workflow` ← **new index added** |
| `credential.count({ userId })` | credential creation (rare) | same treatment |
| `processed_webhook_event` inserts | per webhook | PK insert |

⚠️ Note: current `Workflow` model has **no index on `userId`** (verified — schema.prisma:112-128). At free-tier scale it's fine, but the quota check makes it hot-path; the migration adds:

```prisma
model Workflow {
  // ...
  @@index([userId])
}
```

Same for `Credential`.

## 6. Data retention & hygiene

- `UsageCounter`: expired windows deleted by the existing maintenance cron pattern (`/api/cron/mcp-maintenance` gains a step, or a sibling route) — keep ≤ 2 completed windows per user for dispute resolution, then purge.
- `ProcessedWebhookEvent`: purged after 90 days (replay window far exceeds any realistic redelivery).
- `Subscription`: retained while user exists (cascade delete on account removal already configured).
