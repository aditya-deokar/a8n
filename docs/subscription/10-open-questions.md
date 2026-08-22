# 10 — Decision Record (Final Answers)

> Status: **All questions resolved** on 2026-08-22. Each decision below is locked and reflected across docs 01–09 (inconsistency sweep completed same day).
> Format: Decision ID · Question · Final answer · Why it wins for the business · Consequences already applied to other docs.

---

## D1 — Chat window semantics

**Question:** Free chat quota resets how — rolling 30 days from first message, or calendar month?

**Decision: ✅ Calendar-month reset (both tiers). Counters reset on the 1st of each month (UTC).**

Why it wins:

| Factor | Rolling 30d | Calendar month ✅ |
|---|---|---|
| One-sentence explanation | ❌ "…30 days after your first message" | ✅ "Resets on the 1st" |
| Support load | ❌ every user has a different refill date | ✅ one rule for everyone |
| Analytics | ❌ per-user cohort drift | ✅ clean monthly cohorts |
| Alignment with billing | none | matches Pro's monthly cycle → renewal & upgrade nudges land together |
| Implementation | anchor-date bookkeeping | `periodStart` = first of month — trivial |

Consequences applied: docs 01 (§2 table, §4 copy rules), 03 (§2 `plans.ts`, §5.2 window handling) updated. `UsageCounter` schema unchanged — fixed `[periodStart, periodEnd)` rows already fit calendar months perfectly.

## D2 — Workflow executions on Free in v1

**Question:** Meter workflow executions from day one, or leave unmetered?

**Decision: ✅ Unmetered in v1 — but two cheap safety valves ship anyway; plan-differentiated execution quotas deferred to v2 (post-data).**

Valves that ship in v1 (near-zero marginal cost once counter infra exists):
1. **Hidden abuse guard:** max 100 executions/day/user (env-tunable, never marketed, never shown in UI) — stops runaway-loop/infinite-schedule workflows from burning Inngest compute.
2. **Wire `assertRunBudget()`** (already written in `src/agent/model/cost.ts`, currently orphaned) so any single execution exceeding the configured $ budget is killed mid-run.

Why: execution cost is compute-bound, not LLM-bound; gating executions would suppress activation (the metric we're fixing); real usage data should size future paid limits, not guesses. The landing-page "7-day history" promise stays deferred until the retention job ships (v2 backlog item).

## D3 — Pro chat cap

**Question:** Hard 500 chats/month for Pro, or "unlimited with fair-use clause"?

**Decision: ✅ Hard cap, 500/calendar month.**

Why: "Unlimited" is a support-ticket generator and an LLM-cost blank cheque (agent-as-free-API-proxy at $29/mo would be arbritrageable). A deterministic cap is enforceable in one line of the same conditional-update code path, never produces "why was *my* usage unfair?" disputes, and can be raised via env var the week metrics show a real human hitting it (~16 chats/day is far above observed power-user behaviour). Pricing page states the number honestly.

## D4 — Refund policy on downgrade mid-cycle

**Question:** Custom proration logic, or merchant-of-record defaults?

**Decision: ✅ Polar merchant-of-record defaults; zero refund code in a8n. Cancellation takes effect at end of the paid period.**

Why: Polar already owns charging, invoicing, EU consumer-refund compliance, and disputes — reimplementing any of it adds legal exposure for no revenue upside. Our `currentPeriodEnd` resolver design makes end-of-period cancellation automatic. Support gets one documented macro: goodwill refunds (within 14 days, once per customer, edge cases only) are issued manually from the Polar dashboard and logged — a 2-minute operation, not a feature.

## D5 — Schema headroom for future Team tier

**Question:** Compound unique key now, or `userId @unique`?

**Decision: ✅ `userId @unique`. Revisit only when Teams is actually scheduled.**

Why: YAGNI. The normalizer/upsert logic is one function; widening to `{userId, productId}` later is a mechanical migration with zero user impact. Paying that complexity now buys nothing — no team product, no team pricing, no timeline exists.

## D6 — Sandbox→production billing cutover ownership

**Question:** Manual code edit (today's `server:"sandbox"` hardcode) vs config vs deploy-script step?

**Decision: ✅ Config-driven: `POLAR_SERVER` env var, zod-validated enum (`sandbox|production`), fail-fast validation in the production block of `src/env.ts`.**

Why: removes the documented manual footgun (DEPLOYMENT.md step), works identically across any deploy pipeline, visible in audit logs, and impossible to silently forget once the production validator requires it alongside the existing POLAR_* checks.

## D7 — MCP tool quotas

**Question:** Does `create-workflow` via MCP draw from the same 5-workflow pool, or a separate MCP quota?

**Decision: ✅ Shared pool. One user = one budget, regardless of surface.**

Why: separate pools double effective free capacity (abuse vector: do everything over MCP), create exactly the dual-source-of-truth inconsistency this project exists to eliminate, and produce indefensible support conversations ("the app said I could"). MCP's *rate limiter* stays independent (30/120 req/min burst control) — that's traffic shaping, not entitlement — and finally receives the real user tier (fixes G8).

## D8 — Launch mechanics (locked for planning)

- **No trials in v1** — the free tier *is* the trial. Simpler funnel, fewer states to test.
- **Monthly billing only** ($29/mo). Annual pricing deferred until monthly conversion data exists.
- **Feature-flag default OFF** (`ENTITLEMENTS_ENABLED=false`) — new code deploys inert; enablement is an ops decision gated by doc 09's dark-launch exit criteria, not a code event.
- **Existing subscribers** migrate automatically via webhook mirror + one-time backfill; they see no change except meters appearing.

---

## Residual watchlist (carried from open questions)

| Risk | Signal | Trigger |
|---|---|---|
| "When do my chats reset?" confusion despite calendar model | ticket themes | >5/wk → add "resets in N days" chip (snapshot already returns `windowEnd`) |
| Hidden 100/day execution guard too tight for legit power users | denials telemetry `feature=workflow_execution` | raise env before ever exposing in UI |
| Race suites flaky in CI | CI stability | move contention-amplified mode to nightly job |
| Polar webhook latency spikes | checkout→entitlement p95 | promote blocking `syncNow` on checkout return |
