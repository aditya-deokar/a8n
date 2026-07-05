# Observability Runbook

Observability is how we understand production behavior without guessing. It covers structured logs, metrics, traces, dashboards, alerts, and SLOs.

## Goals

- Detect production issues quickly.
- Debug failures with correlation IDs and structured context.
- Alert on user-impacting symptoms, not noise.
- Preserve release evidence for deploy decisions.
- Keep secrets and private payloads out of logs.

## Implemented Foundation

| Artifact | Purpose |
|---|---|
| `src/lib/observability.ts` | Structured server-side event, metric, duration, and exception helpers |
| `src/lib/logging/*` | Pino logger, redaction, request context, external provider logs, database logs, and client log ingestion |
| `src/app/api/logs/client/route.ts` | Safe browser error reporting endpoint |
| `src/instrumentation.ts` | Next.js server instrumentation boot event |
| `scripts/observability-check.ts` | Validates observability docs/config and writes evidence |
| `.github/workflows/observability.yml` | PR/main/nightly observability readiness check |
| `docs/DevOps/alert-rules.md` | Alert names, thresholds, severity, and response |
| `docs/DevOps/logging-dashboard-specs.md` | Provider-neutral dashboard and log-query specification |
| `docs/api/evidence/observability` | Observability readiness reports |

## Event Model

Every production event should include:

| Field | Purpose |
|---|---|
| `timestamp` | When the event happened |
| `environment` | `preview`, `staging`, or `production` |
| `release` | Version or commit SHA |
| `component` | `api`, `database`, `workflow`, `webhook`, `mcp`, `billing`, `auth`, `deployment`, or `system` |
| `severity` | `debug`, `info`, `warn`, `error`, or `critical` |
| `name` | Stable event name |
| `correlationId` | Request, workflow, webhook, or release identifier |
| `durationMs` | Runtime for latency-sensitive operations |
| `attributes` | Redacted structured context |

## Structured Logs

Use structured JSON logs for server-side operational events.

Required logging rules:

- Never log raw credentials, tokens, API keys, OAuth codes, webhook secrets, or encryption keys.
- Never log full private webhook payloads unless sanitized.
- Include user id only when needed for debugging and access is controlled.
- Include correlation IDs for request flows.
- Log errors with component and stable event name.

The helpers in `src/lib/logging` redact common secret patterns before writing JSON logs. Direct `console.*` calls are blocked in runtime source by ESLint and `scripts/observability-check.ts`.

Provider field aliases are emitted with the canonical fields:

| Canonical | Alias |
|---|---|
| `environment` | `env`, `deployment.environment` |
| `release` | `version`, `deployment.version` |
| `service` | `service.name` |
| `traceId` | `trace_id`, `dd.trace_id` |
| `spanId` | `span_id`, `dd.span_id` |

Use `requestId`, `correlationId`, `workflowId`, and `executionId` to follow a request through API, webhook, workflow, provider, MCP, and database logs.

## Metrics

Minimum production metrics:

| Metric | Target |
|---|---|
| API 5xx rate | Under 1 percent over 5 minutes |
| API p95 latency | Under 500 ms for normal reads |
| API p99 latency | Under 1500 ms for normal operations |
| tRPC error rate | Under 1 percent for valid requests |
| Webhook 5xx rate | Under 1 percent over 5 minutes |
| Workflow execution failure rate | Under 2 percent over 15 minutes |
| MCP auth failures | Alert on sharp spikes |
| MCP tool error rate | Under 5 percent over 15 minutes |
| Database connection errors | Zero sustained errors |
| Database query p95 | Under 250 ms for common queries |

## Traces

Trace high-value paths:

- tRPC requests.
- Workflow create/save/execute.
- Webhook verification and dispatch.
- MCP auth, rate limit, tool execution, and OAuth token exchange.
- Billing checkout and subscription state reads.
- Database-heavy list/detail queries.

Recommended future providers:

- OpenTelemetry OTLP for traces and metrics.
- Sentry for error tracking.
- Datadog, Grafana Cloud, New Relic, or Honeycomb for unified dashboards.

## Dashboards

Create these dashboards before production launch:

| Dashboard | Panels |
|---|---|
| API Health | request rate, 4xx, 5xx, p50/p95/p99 latency |
| Database Health | connections, query latency, errors, migration events |
| Workflow Health | started, succeeded, failed, retrying, duration |
| Webhook Health | accepted, rejected, signature failures, 5xx |
| MCP Health | auth failures, rate limits, tool errors, OAuth token errors |
| Client Health | client errors by path, digest, release, and browser |
| Provider Health | external provider failures by provider, operation, and node type |
| Release Health | deployment markers, smoke checks, error rate after deploy |

See `docs/DevOps/logging-dashboard-specs.md` for panel-level specs.

## SLOs

Initial SLOs:

| SLO | Target |
|---|---|
| API availability | 99.5 percent monthly |
| Valid API request latency | 95 percent under 500 ms |
| Workflow dispatch acceptance | 99 percent accepted within 5 seconds |
| Webhook acknowledgement | 99 percent under 2 seconds |
| MCP protected endpoint correctness | 99.5 percent controlled auth/protocol responses |

Review SLOs monthly once real production traffic exists.

## Alert Response

For every alert:

1. Confirm user impact.
2. Check latest release manifest.
3. Check production smoke evidence.
4. Check component dashboard.
5. Decide: monitor, mitigate with flag, roll back app, roll forward DB, or start incident.
6. Record action in incident notes if severity is high.

## Required Commands

Readiness check:

```powershell
pnpm observability:check
```

Production strict mode:

```powershell
pnpm observability:check:strict
```

JSON evidence:

```powershell
pnpm observability:check -- --profile production --json
```

## Provider Configuration

The code supports a provider-neutral baseline. Configure one of these before serious production use:

- `ERROR_TRACKING_DSN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OBSERVABILITY_METRICS_ENDPOINT`
- `OBSERVABILITY_PROVIDER`

Use `OBSERVABILITY_PROVIDER=console` only as the initial baseline. A real hosted provider should be added before public production traffic.

## Release Requirements

Before production deploy:

- Observability readiness check passed.
- Runtime console guard passed.
- Client log endpoint is enabled or intentionally disabled.
- Production smoke command is known.
- Alert rules exist for changed components.
- Dashboard exists or manual monitoring path is documented.
- Release manifest will be generated after deploy.
