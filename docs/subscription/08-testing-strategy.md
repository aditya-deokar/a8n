# 08 — Testing Strategy

> Audience: engineering/QA. Reuses the repo's existing stacks: Vitest (unit/integration, `vitest.api.config.mjs`), Playwright (E2E incl. `playwright.api-e2e.config.mjs`), and the established `E2E_EXTERNAL_SERVICES=mock` billing seam.

## 1. Test pyramid for this feature

```
        ┌─────────────┐
        │ E2E (few)   │  full user journeys, mocked Polar
        ├─────────────┤
        │ API/Integra.│  routers + entitlement service + real Postgres (testcontainers)
        ├─────────────┤
        │ Unit (many) │  pure quota logic, plan resolver, webhook normalizer
        └─────────────┘
```

## 2. Unit tests (`*.test.ts`, no DB)

| Target | Cases |
|---|---|
| `check-quota.ts` | at-limit / under-limit / unlimited(null) / unknown feature → default deny; window boundary math |
| `get-plan.ts` (pure part) | status matrix: active→pro; canceled + now<periodEnd→pro; canceled + now≥periodEnd→free; past_due per grace config; missing row→free |
| webhook normalizer | each event type in doc 06 §2 → expected row diff; unknown product→free+alert-flag; missing externalId→no-op+flag; out-of-order timestamps skipped |
| plans config | env override parsing; invalid values rejected by zod schema |

## 3. Integration tests (service + Postgres)

Setup: disposable Postgres (existing test DB harness), Prisma migrations applied, seed users.

| Suite | Assertions |
|---|---|
| **Workflow stock meter** | free user: creates 5 OK, 6th → `QUOTA_EXCEEDED` with correct metadata; delete one → create works again; pro: create #50 OK |
| **Advisory-lock race** (doc 07 T1) | spawn N=10 parallel `workflows.create` for a free user with 4 existing → exactly 1 succeeds; final count = 5. Deterministic via Promise.all against real PG |
| **Chat flow meter** | consume to limit → 26th returns 402 payload shape; new window row created after `periodEnd`; retry with same `clientMessageId` consumes once only |
| **Conditional-update race** | 10 parallel chat consumes vs limit 3 → exactly 3 succeed, `used=3` |
| **Webhook endpoint** | valid signature applies row; bad signature → 401 & no row; duplicate delivery → deduped:true, single row; replay of older event after newer → stale skip |
| **Reconcile job** | seeded drift (DB says canceled, Polar says active) → repaired toward Polar + drift log written; counter drift vs AgentRun count → corrected |
| **Grandfather invariant** | user with 12 workflows downgrades → all reads/executes still pass; create blocked; zero deletions occurred (count unchanged) |

## 4. Concurrency test methodology

The race tests are the most important in this plan — they must run against a real Postgres (not sqlite/mocked Prisma):

```ts
const results = await Promise.allSettled(
  Array.from({ length: 10 }, () => caller.workflows.create()),
);
expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
```

Run the suite twice in CI: once normally, once with `PG_advisory` contention amplified (artificial 20ms delay injected inside the lock section behind an env flag used only by tests) to widen race windows deterministically.

## 5. E2E tests (Playwright)

Extend the existing mock seam — `E2E_EXTERNAL_SERVICES=mock` already fakes customer state by email/id containing `"pro"` (`src/trpc/init.ts:82-89`). Add the same convention inside `getEffectivePlan`. Then:

| Scenario | Steps | Expected |
|---|---|---|
| Free activation journey | signup (no "pro" in email) → dashboard | meter shows 0/5 · 0/25; workflow creation succeeds (today it would be blocked) |
| Workflow paywall | create 5 workflows → click New | upgrade modal with "5 of 5 workflows" copy + checkout CTA |
| Chat paywall | (seed counter at limit via API) send message | composer banner + 402 handling; no LLM dispatch observable |
| Upgrade unlock | login as `pro-*@e2e.test` user | meters hidden/unlimited; create #6 succeeds |
| Webhook simulation | POST signed fixture events to /api/webhooks/polar (test signs with known dev secret) | snapshot flips to pro within 2s |

Existing suites that must keep passing unchanged (regression guard):
- Backend E2E plan scenario "free user blocked from premium create actions" — its *semantics* change (blocked-by-quota instead of blocked-by-paywall), so assertions update but infrastructure (`E2E fault injection: polar`) is reused.
- All auth, workflow CRUD, agent SSE contract tests.

## 6. Manual QA checklist (pre-release)

- [ ] Sandbox Polar checkout end-to-end with test card (upgrade path)
- [ ] Cancel in portal → access persists to period end → free afterwards
- [ ] Grandfathered account (>5 workflows) downgrade UX review
- [ ] Meter accuracy across two browsers/devices same account
- [ ] Kill server mid-chat-stream → counter consistent after restart
- [ ] Reconcile drill: manually corrupt a Subscription row → job repairs + alert fires

## 7. Coverage gates

- Entitlement service modules: ≥95% line coverage (pure logic, cheap to cover).
- Enforcement points: every router/SSE branch asserted in integration suite (no uncovered deny paths allowed).
- Overall project thresholds unchanged.
