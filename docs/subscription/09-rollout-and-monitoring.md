# 09 — Rollout Plan & Monitoring

> Audience: all. How this ships without breaking existing users, and how we know it's healthy.

## 1. Rollout strategy: staged flags, dark launch first

A single feature flag controls the entire new system:

```
ENTITLEMENTS_ENABLED=true|false        (env, default false)
```

- **false** (default): all enforcement points behave exactly as today (premium paywall). New code is deployed but inert.
- **true**: quota model active.

This gives a one-variable rollback at any time — no redeploy needed to disable, no schema rollback ever required (tables are harmless when unused).

### Stages

> Stage naming: rollout stages below are **R0–R4** (distinct from build phases P0–P5 in doc 11).

| Stage | Gate | What happens | Exit criteria |
|---|---|---|---|
| **R0 — Build & merge** | flag=false in all envs | Schema migration + entitlement service + tests merged; zero behaviour change | CI green incl. race suites |
| **R1 — Dark launch** | flag=false, prod | Migration applied; webhook route live & receiving events (writes rows only); reconcile cron runs silently; drift metrics collected | 7 days zero unexplained drift; webhook delivery success >99% |
| **R2 — Internal** | flag=true for staff user ids (`ENTITLEMENTS_BETA_USER_IDS` env list) | Team exercises free/pro journeys on prod with sandbox Polar | Manual QA checklist (doc 08 §6) complete |
| **R3 — Free-tier GA** | flag=true globally | The headline change: everyone can create 5 workflows etc.; upgrade modal contextual | Monitor §3 dashboards 48h; support macros ready |
| **R4 — Hardening & v2 prep** | — | Verify execution-valve + per-run-budget telemetry from build P1 (D2); token-metering columns enabled for cost analytics (no billing); MCP tier routing confirmed in prod | cost-per-free-user < $1 |

**Existing paying subscribers:** unaffected by R0–R2. At R3 their `Subscription` rows already exist (webhook+reconcile from R1) and resolve `pro` — verified explicitly during internal phase. Backfill script (doc 04 §3) runs once before R2 as belt-and-braces.

Build-to-stage mapping: build phases P0/P1 (doc 11) land during R0; P2 lands early in R1; P3 completes during R2/R3; build P4 feeds R3→R4 hardening.

## 2. Communication sequence

| When | Channel | Message |
|---|---|---|
| R2 start | In-app banner (staff only) | n/a |
| 3 days before R3 | Email to all users | "a8n Free is here: build up to 5 workflows free…" + what Pro adds |
| R3 day | Blog/pricing page update + in-app announcement card (dismissible, once) | Same message; pricing page copy now truthful |
| R3 + 7d | Changelog | Metrics-informed tweaks announced if limits adjusted |

No surprise-billing risk exists (nothing auto-charges); comms are purely positive announcements.

## 3. Monitoring & alerting

New observability events under the existing `billing` component logger:

```
billing.quota.denied        { userId, feature, plan, used, limit }      // every denial
billing.quota.consume       { userId, resource, usedAfter }             // sampled 10%
billing.webhook.received    { type } / .applied / .deduped / .rejected
billing.reconcile.drift     { userId, field, was, now }                 // alert if any
billing.webhook.unlinked_customer { polarCustomerId }                   // alert
```

### Dashboards

| Panel | Query source | Health |
|---|---|---|
| Denials per feature/day | `quota.denied` count by feature | shape sanity — spikes indicate bugs or abuse |
| Webhook success rate | applied+deduped vs received | >99.5% |
| Reconcile drift events | daily job output | 0 sustained |
| Checkout conversion funnel | checkout clicks → success webhook latency p50/p95 | <10s p95 |
| Chat cost proxy | sampled consumes × avg cost/run | trending within budget |

### Alerts

| Condition | Severity | Action |
|---|---|---|
| Any reconcile drift | warn → page if >5/day | inspect runbook doc 07 §5 |
| Webhook 401 rate > 1/min | page | secret rotation mismatch |
| Denial spike >10× baseline | warn | bug or attack triage |
| `unlinked_customer` event | warn | linkage repair drill |

## 4. Success review cadence

- **48h after R3:** incident-style review — denials sanity, error rates, support volume.
- **Day 14:** limit-tuning review using doc 01 §6 metrics (limit-hit rate outside 10–20% band ⇒ adjust env numbers only).
- **Day 30:** conversion report; go/no-go for v2 scope (execution quotas, history retention).

## 5. Rollback playbook

| Symptom | Action |
|---|---|
| Quota logic misbehaving broadly | Set `ENTITLEMENTS_ENABLED=false` → instant reversion to legacy paywall semantics; investigate; users' data untouched |
| Webhook pipeline broken post-cutover | Entitlements still resolve from last-known rows; force `syncNow` for affected users; repair job |
| Bad limit values shipped | Env-only change + rolling restart; no deploy |
| Migration issue at R1 | Tables dropped safely (no FKs from existing tables besides additive User relations) — but expected unnecessary since additive |

## 6. Definition of done

- [ ] All phases above executed; flag permanently true; legacy `premiumProcedure` deleted (E2E seam migrated)
- [ ] Race suites green under amplified-contention mode
- [ ] Runbooks + alerts armed and tested via game-day drill
- [ ] Pricing page/landing copy matches shipped reality
- [ ] Support macros published; ToS quota clauses live (chat caps, execution guard, grandfathering)
- [ ] 14-day metrics reviewed against doc 01 §6 targets
