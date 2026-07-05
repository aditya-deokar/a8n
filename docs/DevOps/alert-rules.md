# Alert Rules

These alert rules define the first production monitoring baseline. Tune thresholds after real traffic is available.

## Severity Levels

| Severity | Meaning | Response |
|---|---|---|
| SEV1 | Broad production outage, data loss, or sensitive data exposure | Immediate incident, rollback/mitigation |
| SEV2 | Major feature broken or elevated sustained errors | Page owner, mitigate quickly |
| SEV3 | Degraded behavior with workaround | Investigate during working hours |
| SEV4 | Informational trend or maintenance issue | Track in backlog |

## Core Alerts

| Alert | Severity | Initial Threshold | Why It Matters | First Response |
|---|---|---|---|---|
| API 5xx rate high | SEV2 | More than 1 percent for 5 minutes | Users cannot complete normal requests | Check latest release, app logs, database errors, roll back app if release-related |
| API latency high | SEV2 | p95 above 1 second for 10 minutes | App feels slow or times out | Check slow routes, database latency, provider incidents |
| tRPC protected route auth anomaly | SEV2 | Spike in unexpected 401/403/5xx | Auth or session behavior may be broken | Check Better Auth, cookies, deploy diff |
| Database connection errors | SEV1 | Any sustained errors for 3 minutes | App may be unable to read/write | Check provider, connection pool, recent migrations |
| Database query latency high | SEV2 | p95 above 500 ms for 10 minutes | API and workflows slow down | Check query insights, indexes, migration changes |
| Workflow failure rate high | SEV2 | More than 2 percent for 15 minutes | Automations are not completing | Check Inngest, node execution logs, provider failures |
| Workflow dispatch stalled | SEV2 | Accepted dispatch count drops unexpectedly | Workflows may not start | Check app dispatch path and Inngest status |
| Webhook 5xx rate high | SEV2 | More than 1 percent for 5 minutes | External events are not acknowledged | Check webhook route logs and provider retries |
| Webhook signature failures spike | SEV3 | More than 20 failures in 10 minutes | Could indicate attack or provider secret mismatch | Check secret rotation and source IPs |
| MCP auth failures spike | SEV3 | More than 50 failures in 10 minutes | Could indicate bad clients, attack, or OAuth issue | Check OAuth/token changes and rate limits |
| MCP tool error rate high | SEV2 | More than 5 percent for 15 minutes | ChatGPT/MCP clients see broken tools | Check tool logs and recent MCP changes |
| MCP rate-limit denial spike | SEV3 | More than 100 denials in 10 minutes | Could indicate abuse or incorrect limits | Check identifiers and rate-limit config |
| OAuth token exchange errors | SEV2 | More than 10 failures in 10 minutes | Users cannot connect MCP clients | Check OAuth issuer, redirect URIs, signing secrets |
| Billing provider errors | SEV2 | More than 5 errors in 15 minutes | Subscription gates and checkout may fail | Check Polar status and token/config changes |
| External provider failure rate high | SEV2 | More than 5 percent provider failures for 15 minutes | Workflow nodes may be failing because providers are unavailable or credentials are invalid | Check `external_provider_request_failed` logs by provider, operation, and node type |
| Client error spike | SEV2 | 2x baseline or more than 25 client errors in 10 minutes | Users may be hitting browser/runtime failures | Check `client_error_reported` logs by path, digest, release, and browser |
| Production smoke failed | SEV1 | Any required smoke check fails after deploy | Release may be bad | Stop rollout, inspect logs, roll back app if needed |
| Error tracking event spike | SEV2 | 2x baseline for 10 minutes | User-impacting bug likely shipped | Check grouped exceptions and release marker |

## Release-Specific Alerts

For 30 minutes after production deploy, watch:

- API 5xx rate.
- API latency.
- Database errors.
- Workflow failures.
- Webhook failures.
- MCP auth/tool errors.
- Error tracking event spike.
- Production smoke status.

Rollback faster when alerts correlate with the latest release manifest.

## Alert Routing

Initial routing:

| Component | Owner |
|---|---|
| API and tRPC | Backend owner |
| Database and migrations | Backend owner |
| Workflow execution | Workflow owner |
| Webhooks | Integrations owner |
| MCP and OAuth | MCP owner |
| Billing | Billing owner |
| Production deploy | Release owner |

## Noise Control

- Page only on user-impacting symptoms.
- Use warnings for isolated test/sandbox provider failures.
- Silence alerts only with an expiry and reason.
- After three repeated noisy alerts, tune the threshold or improve the signal.

## Runbook Links

- Production release: `docs/DevOps/production-release-runbook.md`
- Observability: `docs/DevOps/observability-runbook.md`
- Database migration: `docs/DevOps/database-migration-runbook.md`
- Staging: `docs/DevOps/staging-runbook.md`
