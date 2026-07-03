# Backend API E2E Tests

These tests exercise the backend over real HTTP against a running Next.js server and a real test database.

## Scope In This Slice

Implemented phases 0-2:

- E2E safety foundation.
- Better Auth email/password signup, login, logout, and protected-session checks.
- Real `/api/trpc` query, mutation, batching, validation, unknown procedure, malformed JSON, and SuperJSON checks.
- Deterministic `e2e_` data cleanup and seed helpers.
- Secret-leak assertions for HTTP responses and test artifacts.

Implemented phases 3-4:

- Workflow lifecycle E2E: premium create, free-user block, list/get, rename, graph save, invalid graph rollback, delete.
- Credential lifecycle E2E: premium create, free-user block, encrypted persistence, metadata list/filter, update encryption, delete, cross-tenant rejection.

Implemented phases 5-6:

- Execution and side-effect E2E: workflow execute dispatch is recorded in E2E mock mode, cross-user execution attempts do not dispatch, execution history list/get works through tRPC.
- Webhook E2E: Google Form shared-secret checks, Stripe signature checks, malformed payload rejection, and dispatch recording without real Inngest calls.

Implemented phase 7:

- MCP dashboard backend E2E: API key create/list/revoke, raw-key one-time exposure checks, OAuth connection list/revoke, security summary counts, and cross-user rejection.

Implemented phases 8-10:

- Tenant isolation E2E: consolidated cross-tenant workflow, credential, execution, API-key, OAuth, and dispatch denial checks.
- Error safety E2E: malformed JSON, unknown procedures, large bad requests, invalid input, invalid graph references, and simulated Prisma/Inngest/Polar failures.
- CI and release gates: smoke/full API E2E release gate script, GitHub Actions smoke/full/nightly lanes, and release workflow blocking.

## Commands

```powershell
pnpm test:api:e2e
pnpm test:api:e2e:smoke
pnpm test:api:e2e:headed
pnpm test:api:e2e:ui
pnpm api:e2e:release:gate
pnpm api:e2e:release:gate:smoke
```

Focused phase 5-6 run:

```powershell
pnpm exec playwright test --config playwright.api-e2e.config.mjs tests/e2e/api/specs/executions.e2e.ts tests/e2e/api/specs/webhooks.e2e.ts
```

Focused phase 6-7 run:

```powershell
pnpm exec playwright test --config playwright.api-e2e.config.mjs tests/e2e/api/specs/webhooks.e2e.ts tests/e2e/api/specs/mcp-dashboard.e2e.ts
```

Focused phase 8-9 run:

```powershell
pnpm exec playwright test --config playwright.api-e2e.config.mjs tests/e2e/api/specs/tenant-isolation.e2e.ts tests/e2e/api/specs/error-safety.e2e.ts
```

Release evidence gate:

```powershell
pnpm api:e2e:release:gate -- --json
```

If a dev server is already running:

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER="true"
pnpm test:api:e2e
```

## Required Test Database

The server refuses E2E mode unless `DATABASE_URL` points to a test database name such as `a8n_test`.

Before running locally, apply migrations to the test database:

```powershell
$env:DATABASE_URL="postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test"
pnpm exec prisma migrate deploy
pnpm test:api:e2e
```

## Safety

- `E2E_TESTS=true` enables server-side E2E safety checks.
- `E2E_EXTERNAL_SERVICES=mock` is required.
- Helpers only delete records with deterministic `e2e_` identifiers.
- Raw secrets, API keys, token hashes, database URLs, and sensitive env names are scanned in responses.
- Test-only dispatch and fault-injection routes are available only when `E2E_TESTS=true` and `E2E_EXTERNAL_SERVICES=mock`.
