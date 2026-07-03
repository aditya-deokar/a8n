# MCP Dashboard Spec

Use these panels in Datadog, Grafana, CloudWatch, or another log/metrics platform. The source events are `[MCP:OBSERVABILITY]` JSON logs and the `server_info` / `security_status` tool outputs.

## MCP Health

- Request volume by minute.
- Tool error rate.
- Average and p95 duration.
- Rate-limit denials.

## Auth And OAuth Health

- Auth failures by status and client.
- Scope denials by required scope.
- OAuth token errors.
- OAuth client IDs and resource/audience mismatches.

## Tool Usage And Latency

- Top tools.
- Tool calls by risk.
- Tool calls by profile.
- Duration by tool.
- External side-effect tool usage.

## Safety Events

- Prompt-injection warning count.
- Approval requested/accepted/denied.
- Runtime guardrail denials.
- Side-effect attempts while kill switches are active.

## Evals Trend

- `pnpm test:mcp` pass/fail.
- `pnpm test:mcp:offline` pass/fail.
- `pnpm mcp:adversarial:eval` pass/fail.
- `pnpm mcp:live:eval` pass/fail for staging.

## Incident Regression Coverage

- Open incidents by severity.
- Incidents missing regression eval IDs.
- Regression eval failures by attack class.
- Time from incident open to regression coverage.
