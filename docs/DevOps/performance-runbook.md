# Performance, Load, And Capacity Runbook

Use this runbook before major releases, after performance incidents, and during scheduled capacity reviews.

## Goals

- Catch slowdowns before users do.
- Keep API, webhook, and workflow execution latency within budget.
- Understand capacity before launch.
- Tie performance regressions to rollback decisions.
- Keep cost visible while scaling.

## Implemented Controls

| Control | Artifact |
|---|---|
| Performance readiness check | `pnpm performance:check` |
| Performance budgets | `docs/DevOps/performance-budgets.json` |
| API load test | `tests/load/api.k6.js` |
| Webhook burst test | `tests/load/webhooks.k6.js` |
| Workflow execution load test | `tests/load/workflow-execution.k6.js` |
| CI workflow | `.github/workflows/performance-nightly.yml` |
| Evidence | `docs/api/evidence/performance` |

## Budget Guardrails

Default budgets are stored in `docs/DevOps/performance-budgets.json`.

Key production guardrails:

- API p95 latency should stay below budget.
- API 5xx/error rate should stay below budget.
- Webhook p95 latency should stay below budget.
- Workflow dispatch p95 should stay below budget.
- Load tests should not run against production unless explicitly approved.

## Load Test Rules

- Use staging by default.
- Never run unbounded load against production.
- Use small smoke profiles before larger profiles.
- Mock or sandbox external providers.
- Do not use real customer payloads.
- Stop if error rate, latency, database CPU, queue depth, or provider rate limits exceed guardrails.

## Commands

Readiness only:

```powershell
pnpm performance:check -- --strict --json
```

Load tests require k6 and a target URL:

```powershell
$env:BASE_URL="https://your-staging-url.example.com"
pnpm load:api
pnpm load:webhooks
pnpm load:workflow
```

Workflow execution load tests also require:

```powershell
$env:MCP_BEARER_TOKEN="Bearer <staging-token>"
$env:WORKFLOW_ID="<staging-workflow-id>"
```

## Release Decision Rules

Treat performance as release-blocking when:

- API p95 latency is over budget after warmup.
- API 5xx rate is above budget.
- Webhook processing fails valid requests.
- Workflow execution queue or dispatch latency exceeds budget.
- Database slow queries regress materially.
- Cost projection exceeds approved budget.

Rollback or pause rollout if performance guardrails fail after production deploy.

## Evidence

Performance readiness evidence is written to:

```text
docs/api/evidence/performance/YYYY-MM-DD/performance-readiness-check.json
```

k6 summaries should be uploaded by CI when load tests run.

## Slow Query Review

Use `docs/DevOps/slow-query-review-template.md` for queries that:

- Exceed p95 budget.
- Cause database CPU or IO spikes.
- Regress after schema or code changes.
- Need new indexes or query rewrite.
