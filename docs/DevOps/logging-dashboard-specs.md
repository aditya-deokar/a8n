# Logging Dashboard Specs

These dashboard specs are provider-neutral. Build them in the selected log provider using JSON stdout logs from the app.

## Provider Field Mapping

| Canonical field | Datadog-style field | OpenTelemetry-style field | Purpose |
|---|---|---|---|
| `service` | `service` | `service.name` | Service name |
| `environment` | `env` | `deployment.environment` | Environment |
| `release` | `version` | `deployment.version` | Release or commit SHA |
| `traceId` | `dd.trace_id` | `trace_id` | Trace correlation |
| `spanId` | `dd.span_id` | `span_id` | Span correlation |
| `requestId` | `requestId` | `requestId` | Request correlation |
| `correlationId` | `correlationId` | `correlationId` | Cross-system correlation |

Keep high-cardinality values such as `requestId`, `workflowId`, `executionId`, and `userId` as searchable fields, not low-cardinality dashboard labels.

## API Health

Filters:

- `component:api`
- `event:http_request_completed OR event:http_request_failed`

Panels:

- Request count by `route` and `statusCode`.
- 4xx and 5xx rate by `route`.
- p50, p95, and p99 `durationMs` by `route`.
- Top failed routes by count.

## tRPC Health

Filters:

- `component:trpc`
- `event:trpc_procedure_completed OR event:trpc_procedure_failed`

Panels:

- Procedure volume by `procedurePath` and `procedureType`.
- Error count by `trpcErrorCode`.
- p95 `durationMs` by `procedurePath`.
- Auth failures using `event:trpc_auth_failed`.

## Workflow Health

Filters:

- `component:workflow`

Panels:

- Dispatch requested/completed/failed counts.
- Execution started/completed/failed counts.
- Node failures by `nodeType`.
- p95 workflow execution duration.
- External provider failures by `provider`, `operation`, and `nodeType`.

## Webhook Health

Filters:

- `component:webhook`

Panels:

- Webhook received count by `provider`.
- Verification failures by `provider` and `verificationMode`.
- Dispatch completions by `workflowId`.
- 5xx processing failures by route.

## MCP Health

Filters:

- `component:mcp`

Panels:

- MCP request volume and latency.
- Tool completions/failures by `tool`, `risk`, and `profile`.
- Runtime guardrail denials by `mcpEventType`.
- Audit persistence failures.
- OAuth and auth failure trends.

## Database Health

Filters:

- `component:database`

Panels:

- `db_slow_query` count by `target`.
- p95 slow query `durationMs`.
- `db_query_failed` count by `target`.
- Correlation to API routes by `requestId` when available.

## Client Health

Filters:

- `component:client`
- `event:client_error_reported`

Panels:

- Client error count by `path`.
- Top `errorName` and `digest`.
- Error trend by release.
- Browser distribution using `userAgent` if the provider can parse it safely.

## Release Health

Filters:

- `release:<current-release>`

Panels:

- Error rate by component for 30 minutes after deploy.
- New client error digests.
- Webhook and workflow failure deltas.
- Database slow query delta.
