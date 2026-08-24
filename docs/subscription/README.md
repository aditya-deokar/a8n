# Subscription & Quota System — Implementation Plan

> **Status:** Approved (v1.1 — decisions locked) · **Date:** 2026-08-22 · **Owner:** a8n core team
>
> Goal: move a8n from the current *binary* paywall ("Pro users can create anything, Free users can create nothing") to a **freemium quota model**: every user gets a genuinely usable free tier — **5 workflows + 25 agent chats per month** — and is prompted to upgrade to Pro only when they hit those limits.

---

## Why this plan exists

Today a8n's "subscription system" is one boolean: *does this user have an active Polar.sh subscription?*

That gate is enforced in exactly two places — `workflows.create` (`src/features/workflows/server/routers.ts:28`) and `credentials.create` (`src/features/credentials/server/routers.ts`) — both via `premiumProcedure` (`src/trpc/init.ts:220`). The consequences:

1. **The free tier is unusable.** A new user cannot create even one workflow or credential without paying. There is nothing to try before buying.
2. **Agent chat is completely unmetered.** Any authenticated user can send unlimited agent messages (each costing real LLM tokens), regardless of plan.
3. **No quota concept exists anywhere** in schema, API, or UI.
4. **Every premium check makes a synchronous call to Polar's API**, adding latency and creating a hard runtime dependency on an external service for core product actions.
5. Marketing pages already promise Free vs Pro tiers that don't exist server-side.

This document set specifies a secure, consistent replacement.

## The new model at a glance

| | Free | Pro ($29/mo) |
|---|---|---|
| Workflows owned | max 5 | unlimited |
| Agent chat messages | 25 / month (resets on the 1st) | 500 / month |
| Credentials | 10 (needed to make workflows useful) | unlimited |
| Workflow execution history | last 7 days visible *(v2)* | full history |
| MCP tool rate limit | 30 req/min | 120 req/min |

All numbers live in one config module (`src/config/plans.ts`) and are env-overridable. Enforcement is **server-side only**; the client can render meters but can never change entitlements.

## Document map

| Doc | Audience | Contents |
|---|---|---|
| [01-business-model.md](01-business-model.md) | Non-technical / founder / support | Tiers, pricing psychology, limit rationale, user journeys, comms & refund policy |
| [02-current-state-analysis.md](02-current-state-analysis.md) | Engineering | Line-by-line audit of today's billing code, every gap found |
| [03-architecture.md](03-architecture.md) | Engineering | Target design: local entitlement store, plan config, quota engine, sync strategy |
| [04-data-model-and-migration.md](04-data-model-and-migration.md) | Engineering | Prisma schema changes, backfill, migration safety |
| [05-enforcement-layer.md](05-enforcement-layer.md) | Engineering | Exact code changes per enforcement point (workflows, chat SSE, credentials, MCP) |
| [06-polar-integration.md](06-polar-integration.md) | Engineering | Webhooks, checkout/portal, reconciliation cron, idempotency |
| [07-security-hardening.md](07-security-hardening.md) | Engineering / security | Threat model: race conditions, replay, bypass, abuse; mitigations |
| [08-testing-strategy.md](08-testing-strategy.md) | Engineering / QA | Unit, integration, concurrency, E2E strategy reusing existing E2E mocks |
| [09-rollout-and-monitoring.md](09-rollout-and-monitoring.md) | All | Staged rollout stages, feature flags, metrics, alerts, rollback plan |
| [10-open-questions.md](10-open-questions.md) | All | **Decision record (final)** — D1–D8 answered with business rationale |
| [11-phase-wise-implementation-plan.md](11-phase-wise-implementation-plan.md) | Engineering | Approved build sequence P0–P5: tasks, files, exit criteria, traceability |

## Design principles (non-negotiable)

1. **Server-side enforcement only.** Client-visible limits are cosmetic; every mutation re-checks against the DB.
2. **Single source of truth for entitlements = our Postgres.** Polar remains the source of truth for *billing*, mirrored locally via signed webhooks + daily reconciliation. Core requests never block on a Polar API round-trip.
3. **Race-safe quota checks.** Limits are enforced with atomic conditional writes (advisory locks / conditional `UPDATE ... WHERE used < limit`), not read-then-write checks.
4. **Fail closed on mutations, fail open on reads.** If the billing subsystem is down, users can still view data but cannot consume paid capacity.
5. **Never destroy user data on downgrade.** Over-limit content is grandfathered (readable, runnable) until deleted voluntarily; only *new creation* is blocked.
6. **Idempotent everywhere money is involved.** Webhook events are deduplicated by event ID; counters are increment-once per verified action.
7. **One config module.** `src/config/plans.ts` defines all tiers; no magic numbers scattered in routers.

## Scope

**In scope (v1):**
- Local subscription mirror synced from Polar
- Workflow count quota (5 free)
- Agent chat message quota (25/month free)
- Credential quota (10 free)
- Upgrade UX: usage meters, contextual upgrade modal with specific reason
- Polar webhook receiver + reconciliation job
- Downgrade/grandfathering semantics

**Out of scope (v1, deferred):**
- Execution-count metering & 7-day history retention (landing page promise — v2, see doc 09)
- Annual plans, team seats, coupons/trials
- Payment methods other than Polar
- Usage-based (per-token) billing

## Effort estimate

Detailed phase breakdown, task lists and exit criteria: [11-phase-wise-implementation-plan.md](11-phase-wise-implementation-plan.md).

| Phase | Content | Estimate |
|---|---|---|
| P0 | Foundations: data model + plan config + entitlement service + unit tests | ≈ 3 days |
| P1 | Enforcement wiring (workflows, credentials, chat SSE, MCP, execution valves) | ≈ 3 days |
| P2 | Billing sync: webhook route + reconciliation cron + backfill | ≈ 3 days |
| P3 | UX layer (meters, modals, pricing page truth-alignment) + support macros | 2–3 days |
| P4 | Hardening pass: amplified race tests, failure drills, observability | ≈ 2 days |
| P5 | Staged rollout & launch (dark launch → internal → GA per doc 09) | ≈ 2 days + watch |

Total ≈ 12–15 engineering days for a solo developer.

## Decision summary (full rationale in doc 10)

| ID | Decision |
|---|---|
| D1 | Chat quotas reset on calendar month (the 1st), both tiers |
| D2 | Executions unmetered in v1 + hidden 100/day abuse guard + wired per-run budget; plan quotas deferred to v2 |
| D3 | Pro = hard 500 chats/month cap (honest, enforceable) |
| D4 | Refunds via Polar merchant-of-record defaults; zero refund code in a8n |
| D5 | Keep single-subscription schema; Teams deferred |
| D6 | Sandbox→production cutover is config-driven (`POLAR_SERVER` env, fail-fast) |
| D7 | MCP tools draw from the same quota pool as the app UI |
| D8 | No trials, monthly billing only, feature-flag ships OFF |
