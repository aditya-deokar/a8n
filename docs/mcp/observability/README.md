# MCP Observability And Runtime Guardrails

Phase 11 adds vendor-neutral production observability for MCP.

## Implemented Surfaces

- Structured `[MCP:OBSERVABILITY]` JSON events.
- In-process metrics for tool calls, auth failures, scope denials, rate limits, prompt-injection warnings, approvals, guardrail denials, and audit persistence failures.
- Alert rule evaluation through `evaluateMcpAlertRules`.
- Dashboard specs through `getMcpDashboardSpecs`.
- Runtime kill-switch flags enforced by `withErrorBoundary`.
- Operator visibility in `server_info` and `security_status`.
- Deterministic gate:

```powershell
pnpm mcp:observability:check
```

## Runtime Kill Switches

| Variable | Default | Effect |
|---|---:|---|
| `MCP_DISABLE_SIDE_EFFECT_TOOLS` | `false` | Blocks tools marked `externalSideEffect` in the MCP contract manifest. |
| `MCP_DISABLE_CREDENTIAL_MUTATION` | `false` | Blocks credential create/update/delete paths. |
| `MCP_FORCE_READ_ONLY_CHATGPT_PROFILE` | `false` | Blocks non-read-only tools visible in the ChatGPT profile. |
| `MCP_SAFETY_STRICT_MODE` | `false` | Enables a stricter safety mode flag for callers and future policy checks. |
| `MCP_OBSERVABILITY_LOG_ENABLED` | `true` | Emits structured `[MCP:OBSERVABILITY]` logs. |

## Alert Rule Tuning

| Variable | Default |
|---|---:|
| `MCP_ALERT_WINDOW_MS` | `300000` |
| `MCP_ALERT_AUTH_FAILURE_THRESHOLD` | `20` |
| `MCP_ALERT_SCOPE_DENIAL_THRESHOLD` | `20` |
| `MCP_ALERT_PROMPT_INJECTION_THRESHOLD` | `5` |
| `MCP_ALERT_APPROVAL_BYPASS_THRESHOLD` | `3` |
| `MCP_ALERT_TOOL_ERROR_RATE_PERCENT` | `10` |
| `MCP_ALERT_RATE_LIMIT_DENIAL_THRESHOLD` | `25` |
| `MCP_ALERT_OAUTH_TOKEN_ERROR_THRESHOLD` | `10` |
| `MCP_ALERT_AUDIT_PERSIST_FAILURE_THRESHOLD` | `1` |

## Operator Workflow

1. Call `server_info` for request and active-alert summary.
2. Call `security_status` for guardrail and dashboard state.
3. Check logs for `[MCP:OBSERVABILITY]` entries by `correlationId`, `tool`, `risk`, `profile`, and `status`.
4. If side effects look unsafe, set `MCP_DISABLE_SIDE_EFFECT_TOOLS=true`.
5. If credential abuse is suspected, set `MCP_DISABLE_CREDENTIAL_MUTATION=true`.
6. If ChatGPT behavior is unstable, set `MCP_FORCE_READ_ONLY_CHATGPT_PROFILE=true`.
7. Add or update a regression eval before closing the incident.
