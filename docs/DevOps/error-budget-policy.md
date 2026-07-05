# Error Budget Policy

This policy defines how a8n uses SLOs and error budget status to decide whether normal releases should continue.

## SLO Baseline

| Area | Target | Release Signal |
|---|---|---|
| App/API availability | 99.9 percent monthly | Stop release if broad 5xx or outage is active |
| API p95 latency | See `performance-budgets.json` | Stop release if p95 is above budget after deploy |
| Webhook processing | 99.5 percent monthly | Stop release if valid signed webhooks are failing |
| Workflow execution | 99 percent monthly | Stop release if workflow execution is broadly broken |
| MCP API | 99.5 percent monthly | Stop release if authenticated MCP calls fail or leak internals |

## Error Budget States

| State | Condition | Release Policy |
|---|---|---|
| Healthy | Budget burn is normal | Normal release process |
| At risk | Budget burn is elevated or a major incident happened recently | Require owner approval and tighter canary |
| Exhausted | SLO missed or active production instability exists | Release freeze except hotfixes, rollback, or risk-reduction work |

## Release Freeze

A release freeze applies when the error budget is exhausted.

Allowed changes during a release freeze:

- Rollback.
- Hotfix for an active incident.
- Security patch.
- Reliability improvement that directly reduces current risk.
- Observability or evidence improvement needed to diagnose the issue.

Blocked changes during a release freeze:

- New features.
- Non-urgent refactors.
- Risky migrations.
- Large dependency upgrades without a security reason.

## Rollback Rule

If a release burns error budget quickly, rollback first unless a forward fix is clearly safer and already validated.

## Review

Error budget status is reviewed in the monthly operational review and before risky production releases.

