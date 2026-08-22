# 11 — Phase-Wise Implementation Plan

> Status: **Approved build sequence** · 2026-08-22 · Based on locked decisions D1–D8 in [10-open-questions.md](10-open-questions.md)
>
> Total estimate: **12–15 focused engineering days** for one developer. Each phase ends in a committed, tested, revertible state. Rollout staging itself (flag flips, dark launch) is defined separately in [09-rollout-and-monitoring.md](09-rollout-and-monitoring.md); this doc maps build work → rollout stages.
## Implementation status

| Phase | State | Evidence |
|---|---|---|
| P0 Foundations | ✅ done | Migration 20260822120000_subscription_quota_models (additive, applied to test DB); src/config/plans.ts; src/lib/entitlements/*; env fail-fast |
| P1 Enforcement | ✅ done | Quota procedures + routers + chat SSE 402 + MCP shared guard/tier fix + execution valve. **3 real bugs caught & fixed by the live-PG race suite** (quota-race.db.test.mjs, gated on API_DATABASE_TESTS=true) |
| P2 Billing sync | ✅ done | Signed webhook route w/ dedup + stale-skip; syncNow/getSnapshot; reconcile cron; GC in maintenance; backfill script; checkout-return sync |
| P3 UX layer | ✅ done | Sidebar meters + grandfathered banner (pp-sidebar.tsx); contextual upgrade modal (QUOTA_EXCEEDED payload); composer 402 banner with reset chip; pricing page truth-aligned; support-macros.md |
| P4 Hardening | ✅ code complete | Fault injection (polar-webhook, quota-db); observability events illing.quota.denied/consume; race suites green vs real Postgres. Remaining 4.2 drills + 4.6 gitleaks pass are ops runbook items |
| P5 Rollout | ⏳ ops only | Execute the R0→R4 stage machine in doc 09 |

Verification at completion: tsc clean · eslint 0 errors · API suite **157/157** sequential (+8 DB-gated skipped) · race suite **4/4 live** · MCP contract/integration 44/44.

## Dependency graph

```
P0 Foundations ──► P1 Enforcement ──► P3 UX layer ──► P5 Launch
        │                 ▲    │
        └──► P2 Billing sync ┘   └──► P4 Hardening ─┘
```

P1 and P2 can interleave after P0; P4 runs continuously but gets a dedicated hardening pass before launch.

---

## Phase 0 — Foundations (≈ 3 days)

**Goal:** entitlement data + logic exist and are proven correct, with zero behaviour change in the app.

### Tasks

| # | Task | Files | Ref |
|---|---|---|---|
| 0.1 | Add `Subscription`, `UsageCounter`, `ProcessedWebhookEvent` models + `Workflow`/`Credential` `@@index([userId])`; generate migration | `prisma/schema.prisma` | doc 04 |
| 0.2 | Create plan config module (D1 calendar window, D2 execution guard values, D3 cap=500) | `src/config/plans.ts` NEW | doc 03 §2 |
| 0.3 | Extend env schema: `ENTITLEMENTS_ENABLED` (default false), `POLAR_WEBHOOK_SECRET`, `POLAR_PRO_PRODUCT_ID`, `POLAR_SERVER` enum (D6), `BILLING_RECONCILE_SECRET`, quota overrides; add production fail-fast checks | `src/env.ts` | docs 03 §2, 06 §8 |
| 0.4 | Point `polar.ts` at `env.POLAR_SERVER`; point `auth.ts` checkout product at `env.POLAR_PRO_PRODUCT_ID` | `src/lib/polar.ts`, `src/lib/auth.ts` | G9 |
| 0.5 | Entitlement service core: `getEffectivePlan` (status + `currentPeriodEnd` resolver), `checkQuota` (pure), `reserveStockSlot` (advisory-lock tx), `consumeChatQuota` (conditional update, calendar-month window per D1), `snapshotFor`, `QuotaExceededError`, error factory | `src/lib/entitlements/*` NEW | docs 03 §3–6, 05 §6 |
| 0.6 | E2E mock seam: extend `getEffectivePlan` with the existing `"pro"`-in-email convention when mocks active | entitlements service | doc 05 §1 |
| 0.7 | Unit tests: pure quota math, plan resolver matrix, window boundary (month edges, UTC) | `tests/entitlements/*.test.ts` | doc 08 §2 |

### Exit criteria

- [ ] Migration applies clean up/down; no existing table touched
- [ ] Resolver matrix tests pass (active/canceled/past_due × before/after periodEnd → pro/free)
- [ ] `checkQuota` truth table fully covered incl. null-limit (unlimited)
- [ ] App behaviour **byte-identical** with flag off (manual smoke + existing suites green)

**Rollback:** drop new tables / revert commit. Nothing reads them yet.

---

## Phase 1 — Enforcement wiring (≈ 3 days)

**Goal:** quotas enforced server-side everywhere; free users can genuinely use the product.

### Tasks

| # | Task | Files | Ref |
|---|---|---|---|
| 1.1 | Add `planProcedure` + `quotaProcedure(feature)` to tRPC init; keep legacy `premiumProcedure` delegating to local resolver behind flag | `src/trpc/init.ts` | doc 05 §1 |
| 1.2 | Switch `workflows.create` → `quotaProcedure("workflow")`; all other verbs unchanged | `features/workflows/server/routers.ts:28` | doc 05 §2 |
| 1.3 | Switch `credentials.create` → `quotaProcedure("credential")` | `features/credentials/server/routers.ts:9` | doc 05 §3 |
| 1.4 | Chat gate in SSE route: idempotent `consumeChatQuota(clientMessageId)` between concurrency check and run-row creation; 402 structured denial payload | `app/api/agent/threads/[threadId]/runs/route.ts` | doc 05 §4 |
| 1.5 | Replace MCP `requireActiveSubscription` with shared service (delete duplicate guard); thread `plan` into `checkRateLimitForRequest(key, tier)` fixing G8 | `src/mcp/middleware/subscription-guard.ts` (del), `src/app/api/mcp/route.ts:251`, affected tools | doc 05 §5, D7 |
| 1.6 | Execution abuse valve (D2): daily counter check in `sendWorkflowExecution` path + wire orphaned `assertRunBudget()` into agent cost pipeline | `src/inngest/utils.ts`, `src/agent/service.ts` | D2 |
| 1.7 | Integration tests: stock-meter suite, flow-meter suite, both race suites vs real Postgres, grandfather invariant | `tests/integration/quota-*` | doc 08 §3–4 |

### Exit criteria

- [ ] With flag ON: free user creates exactly 5 workflows; 6th denied with `QUOTA_EXCEEDED` metadata; delete-then-create recovers slot
- [ ] Race suites green: 10 parallel creates vs limit ⇒ exactly N succeed (both meter types)
- [ ] Chat #26 returns 402 shape with `windowResetAt` = first of next month (D1)
- [ ] MCP create-workflow consumes the same pool as app UI (D7)
- [ ] With flag OFF: legacy paywall behaviour intact (existing E2E scenario passes)

**Rollback:** flag flip only.

---

## Phase 2 — Billing sync (≈ 3 days)

**Goal:** Polar lifecycle events reliably drive the local mirror; drift self-heals.

### Tasks

| # | Task | Files | Ref |
|---|---|---|---|
| 2.1 | Webhook route: raw-body signature verify → PK-insert dedup → normalizer → stale-event skip; unlinked-customer no-op+alert | `src/app/api/webhooks/polar/route.ts` NEW | doc 06 §1–3 |
| 2.2 | Shared event normalizer (single mapping fn used by webhooks AND sync) | `src/lib/entitlements/sync.ts` | doc 06 §2 |
| 2.3 | `subscriptions.syncNow` mutation, rate-limited 3/user/hour | subscriptions router | doc 06 §5 |
| 2.4 | Reconciliation cron route: full mirror-vs-Polar compare (Polar wins), counter-vs-AgentRun cross-check, drift logging | `src/app/api/cron/billing-reconcile/route.ts` NEW | doc 06 §6 |
| 2.5 | Maintenance cron gains UsageCounter/ProcessedWebhookEvent GC steps (keep ≤2 completed windows, purge >90d events) | existing maintenance module | doc 04 §6 |
| 2.6 | Checkout success page calls `syncNow` with optimistic "activating" state + stale fallback | success-page component | doc 06 §4 |
| 2.7 | One-time backfill script for existing customers (idempotent) | `scripts/backfill-subscriptions.ts` NEW | doc 04 §3 |
| 2.8 | Webhook fixture integration tests: each event type, bad signature, duplicate, replay-after-newer, out-of-order | tests | doc 08 §3 |

### Exit criteria

- [ ] Sandbox end-to-end: checkout → webhook row within seconds → snapshot shows Pro
- [ ] Duplicate/replay/out-of-order fixtures produce exactly one applied state change
- [ ] Seeded-drift drill: job repairs toward Polar + logs drift event
- [ ] Backfill script run against sandbox: every customer mirrored, re-run = no-op

**Rollback:** disable route via env; mirror rows are inert while flag off.

---

## Phase 3 — UX layer (≈ 2–3 days)

**Goal:** limits are legible, upgrade moments convert, marketing tells the truth.

### Tasks

| # | Task | Files | Ref |
|---|---|---|---|
| 3.1 | `getSnapshot` endpoint (single call powering all meters, 30s staleness) | subscriptions/plans router | doc 05 §7 |
| 3.2 | Sidebar usage meters ("Workflows 2/5 · Chats 18/25"), hidden for Pro-unlimited, degrade gracefully on `stale:true` | `components/app-sidebar.tsx` | docs 01 §3, 05 §7 |
| 3.3 | Upgrade modal: read `QUOTA_EXCEEDED` metadata → specific copy per feature ("You've used 5 of 5 free workflows"); generic fallback preserved | `hooks/use-upgrade-modal.tsx`, `components/upgrade-modal.tsx` | doc 05 §6 |
| 3.4 | Composer banner on 402 chat denial with reset-date chip | agent composer components | doc 01 §2 |
| 3.5 | Grandfathered banner ("12 of 5 workflows — delete some or resubscribe") | dashboard/banner component | doc 01 §2 |
| 3.6 | Pricing page truth-alignment: Free = what ships (5 wf, 25 chats, 10 cred); remove unshipped history claims until the v2 retention job lands | `components/landing/pricing.tsx` | doc 01 §4 |
| 3.7 | Support macros written (reset rule, workflow #6, cancellation/grandfathering, goodwill refund D4) | support docs | doc 01 §4 |

### Exit criteria

- [ ] Every limit surface shows number + reset rule; no dead-end errors
- [ ] Modal copy matches the exact feature that tripped
- [ ] Pricing page claims ⊆ shipped features (audit checklist)

---

## Phase 4 — Hardening pass (≈ 2 days)

**Goal:** prove the system under stress and failure before real money flows.

| # | Task |
|---|---|
| 4.1 | Run full race suites in contention-amplified mode (20ms lock delay env) |
| 4.2 | Failure drills: DB blip during consume (fail-closed verified), Polar down during `syncNow` (stale snapshot), webhook secret mismatch (401 spike alert fires) |
| 4.3 | Fault-injection extension: `throwIfE2EFault("quota-db", "polar-webhook")` wired into new paths |
| 4.4 | Playwright journeys per doc 08 §5 (activation, workflow paywall, chat paywall, upgrade unlock, webhook simulation) |
| 4.5 | Observability: emit `billing.quota.denied/consume`, webhook lifecycle events; dashboards + alerts armed per doc 09 §3 |
| 4.6 | Security checklist walkthrough (doc 07 §5) incl. secrets present in prod vault, none in repo (`gitleaks` clean) |

### Exit criteria
- [ ] All drills produce expected degradation, no data corruption, alerts observable
- [ ] Amplified race suites stable across 3 consecutive CI runs

---

## Phase 5 — Staged rollout & launch (≈ 2 days + watch window)

Execute exactly the stage machine from [09-rollout-and-monitoring.md](09-rollout-and-monitoring.md):

```
Dark launch (flag off, prod): migration + backfill + webhook soak 7d
        │ exit: zero unexplained drift, webhook delivery >99%
        ▼
Internal beta (staff ids) → manual QA checklist (doc 08 §6)
        ▼
GA: ENTITLEMENTS_ENABLED=true globally + comms sequence (email, pricing page live)
        │
        ├─ 48h incident review      (denials sanity, error rates, tickets)
        ├─ Day 14 limit-tuning review (limit-hit rate 10–20% band)
        └─ Day 30 conversion report → go/no-go for v2 scope
           (execution quotas, 7-day retention job, token analytics, Teams decision on D5)
```

Launch-day runbook links: rollback playbook (doc 09 §5), "paid but shows free" and "counter wrong" drills (doc 07 §5).

---

## Traceability matrix

| Decision | Where it lands |
|---|---|
| D1 calendar reset | P0 (plans config, window calc), P1 (chat gate), P3 (copy) |
| D2 execution valves | P1 task 1.6 |
| D3 hard 500 cap | P0 config value, P3 pricing copy |
| D4 refund posture | P2 (no code!), P3 macro 3.7 |
| D5 single-sub schema | P0 schema as designed; revisit gate at Day-30 |
| D6 config cutover | P0 tasks 0.3–0.4 |
| D7 shared MCP pool | P1 task 1.5 |
| D8 no trials/monthly-only/flag-off default | P0 flag, P5 comms |

## Risk-adjusted schedule

| If | Then |
|---|---|
| Race tests reveal advisory-lock contention under load | swap to serializable-isolation variant of `reserveStockSlot` (+0.5d, interface unchanged) |
| Polar sandbox webhook delays >30s consistently | enable blocking `syncNow` on checkout return from day one (already built in P2) |
| Solo-dev time-boxed to 2 weeks | ship through P3, run P4/P5 compressed dark-launch over the following week (flag stays off meanwhile — safe) |
