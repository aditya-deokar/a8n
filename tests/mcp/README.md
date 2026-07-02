# MCP Test Suite

This folder implements Phase 1 of the MCP production hardening plan.

## Layout

```txt
tests/mcp/
  fixtures/      Shared deterministic test data and factories.
  unit/          Fast tests for sanitization, safety, auth helpers, and guards.
  integration/   Route/tool tests with seeded test data.
  contract/      Manifest/schema/profile checks.
  adversarial/   Prompt-injection, tool-poisoning, SSRF, exfiltration cases.
```

Phase 1 adds the framework and starter unit tests. Later phases should fill the integration, contract, and adversarial folders.

Phase 2 adds the MCP contract manifest and contract checks.
Phase 3 adds starter unit coverage for shared security controls.
Phase 4 adds route-level integration coverage for MCP auth failures, CORS, profile exposure, route rate-limit headers, production error shape, SDK-client helper scaffolding, and tenant-isolation source guards.
Phase 5 adds central approval-guard coverage and mocked handler integration tests for high-risk MCP side effects and destructive actions.

## Commands

```bash
pnpm test:mcp
pnpm test:mcp:coverage
pnpm test:mcp:offline
```

`test:mcp:offline` runs the existing deterministic MCP quality scripts and does not need Vitest.

## Environment

Tests should never use production data. Use deterministic fixtures and a dedicated test database for integration tests.

Required test defaults:

- `NODE_ENV=test`
- `MCP_AUDIT_DB_ENABLED=false`
- `MCP_AUDIT_LOG_ENABLED=false`
- `MCP_API_KEY_HMAC_SECRET=test-mcp-api-key-hmac-secret-32`
- `MCP_OAUTH_TOKEN_HMAC_SECRET=test-mcp-oauth-token-hmac-secret-32`
- `DATABASE_URL=postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test`
