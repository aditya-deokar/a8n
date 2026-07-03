# MCP Alert Rules

These alert IDs are emitted by `evaluateMcpAlertRules` and should map to your log or metrics platform.

## mcp-auth-failure-spike

Signal: repeated MCP bearer auth failures inside `MCP_ALERT_WINDOW_MS`.

First checks:

- Verify OAuth/resource metadata is correct.
- Check API key revocation or rotation events.
- Confirm there is no credential stuffing against `/api/mcp`.

## mcp-scope-denial-spike

Signal: repeated `requireScope` denials.

First checks:

- Confirm the client is using the expected scopes.
- Look for a tool-selection regression causing writes from read-only clients.
- For ChatGPT, re-run `pnpm mcp:chatgpt:app-eval`.

## mcp-prompt-injection-spike

Signal: sanitized MCP output contains untrusted instruction or tool-coercion patterns.

First checks:

- Identify source tool and execution output.
- Treat payload as untrusted data.
- Re-run `pnpm mcp:adversarial:eval`.
- Add a regression case if the pattern is new.

## mcp-approval-bypass-attempts

Signal: repeated approval-required responses or denied approval attempts.

First checks:

- Confirm tool is marked `requiresApproval` in `src/mcp/contracts/tools.manifest.ts`.
- Inspect whether the client is retrying with missing or wrong confirmation hashes.
- If abuse is suspected, set `MCP_DISABLE_SIDE_EFFECT_TOOLS=true`.

## mcp-tool-error-rate

Signal: recent MCP tool error rate exceeds `MCP_ALERT_TOOL_ERROR_RATE_PERCENT`.

First checks:

- Sort logs by `tool`, `risk`, and `profile`.
- Check database and provider availability.
- Re-run `pnpm test:mcp` for handler regressions.

## mcp-rate-limit-saturation

Signal: repeated MCP rate-limit denials.

First checks:

- Confirm whether the same user/API key is retrying.
- Increase client backoff.
- For multi-instance production, prioritize Phase 12 distributed rate limiting.

## mcp-oauth-token-errors

Signal: OAuth token validation/exchange errors exceed threshold.

First checks:

- Verify issuer/resource/redirect URI configuration.
- Check refresh-token rotation behavior.
- Re-run `pnpm mcp:chatgpt:oauth-check`.

## mcp-audit-persistence-failed

Signal: audit event persistence failed.

First checks:

- Confirm `MCP_AUDIT_DB_ENABLED=true`.
- Verify the `mcp_audit_log` migration exists in production.
- Check database connectivity and permission errors.
- Treat this as stop-ship for production releases.
