# Cost Control Runbook

Cost control keeps production sustainable as traffic, workflow execution, AI usage, and database size grow.

## Goals

- Keep monthly spend visible.
- Catch unexpected usage spikes.
- Tie cost changes to releases.
- Avoid runaway AI/provider usage.
- Review cost before scaling load.

## Budget Owners

| Area | Owner | Examples |
|---|---|---|
| Hosting | platform | Vercel/serverless usage, bandwidth |
| Database | backend | Neon/Postgres compute, storage, backups |
| AI providers | product/backend | OpenAI, Anthropic, Gemini requests |
| Workflow execution | backend | Inngest/event volume |
| Observability | platform | logs, traces, metrics volume |
| Billing provider | product | Polar usage and webhooks |

## Cost Budgets

Budget thresholds live in:

```text
docs/DevOps/performance-budgets.json
```

Review these budgets monthly and after major launches.

## Release Cost Review

Before production release, review whether the change:

- Adds new AI calls.
- Adds new polling or background jobs.
- Increases workflow execution volume.
- Adds expensive database queries.
- Adds large logs/traces/metrics.
- Increases webhook retries.
- Adds new third-party provider calls.

## Cost Spike Response

1. Identify provider and metric.
2. Check latest release and feature flags.
3. Disable rollout or kill switch if cost spike is unsafe.
4. Reduce log/trace volume if observability cost is the issue.
5. Pause external provider calls if needed.
6. Add rate limits or quotas.
7. Record incident or operational review item.

## AI Provider Controls

- Track request count, token usage, model, and user/workflow context without logging private payloads.
- Add per-user or per-workflow quotas before public scale.
- Prefer cheaper models for non-critical tasks.
- Cache safe deterministic outputs when possible.
- Alert on unusual spend growth.

## Database Cost Controls

- Review slow queries.
- Avoid unbounded pagination.
- Add indexes only after query review.
- Archive or expire high-volume operational logs when safe.
- Monitor connection count, CPU, storage, and backup size.

## Review Cadence

| Cadence | Review |
|---|---|
| Per release | New AI/provider/database/logging cost risk |
| Weekly during growth | Spend trend and anomalies |
| Monthly | Budget versus actual |
| Quarterly | Provider plan, retention, and architecture review |
