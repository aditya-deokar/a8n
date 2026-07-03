# Internal API tRPC Backend Testing Plan

> Last updated: July 3, 2026
> Scope: backend/internal API testing for `/api/trpc`, `appRouter`, feature routers, tRPC middleware, Prisma persistence, Better Auth sessions, Polar subscription checks, Inngest dispatch, credential encryption, and the MCP dashboard procedures exposed through tRPC.
> Goal: add an industry-grade backend test program without disturbing the existing MCP test lane.

## Executive Summary

The current app already has a strong production backend shape:

- Next.js App Router exposes tRPC at `src/app/api/trpc/[trpc]/route.ts`.
- tRPC v11 is configured in `src/trpc/init.ts` with SuperJSON, `protectedProcedure`, and `premiumProcedure`.
- `appRouter` composes four internal API routers: `workflows`, `credentials`, `executions`, and `mcp`.
- Prisma is the persistence boundary for users, workflows, nodes, connections, credentials, executions, MCP API keys, OAuth tokens, and audit data.
- Better Auth owns session authentication, and Polar owns premium subscription state.
- Inngest is the durable workflow execution dispatch layer.
- Existing tests and CI currently focus on MCP under `tests/mcp`, `vitest.config.mjs`, and `.github/workflows/mcp-quality.yml`.

The missing layer is a dedicated internal API backend test program for the tRPC procedures that power the dashboard and editor. This plan adds that layer in phases: first deterministic test infrastructure, then contracts, auth/authorization, router integration, transport tests, security regression tests, CI gates, and ongoing release governance.

## Current State Snapshot

| Area | Current state | Key files |
|---|---|---|
| tRPC route | `GET` and `POST` handled by `fetchRequestHandler` | `src/app/api/trpc/[trpc]/route.ts` |
| tRPC init | SuperJSON transformer, protected session middleware, premium subscription middleware | `src/trpc/init.ts` |
| Router composition | `workflows`, `credentials`, `executions`, `mcp` | `src/trpc/routers/_app.ts` |
| Workflows API | CRUD, graph replacement, execution dispatch, pagination/search | `src/features/workflows/server/routers.ts` |
| Credentials API | CRUD, type filtering, encryption before write | `src/features/credentials/server/routers.ts` |
| Executions API | Read execution history with workflow ownership filters | `src/features/executions/server/routers.ts` |
| MCP dashboard API | API key creation/list/revoke and OAuth/security summaries | `src/features/mcp/server/routers.ts` |
| Current tests | MCP-only Vitest and Playwright test suites | `tests/mcp`, `tests/e2e/mcp` |
| Current CI | MCP quality workflow with Prisma validate, typecheck, lint, MCP checks | `.github/workflows/mcp-quality.yml` |

## Procedure Inventory

The first testing target is the complete tRPC procedure surface.

| Router | Procedure | Type | Access | Risk |
|---|---|---:|---|---|
| `workflows` | `create` | mutation | premium | Writes workflow and initial node |
| `workflows` | `remove` | mutation | protected | Destructive workflow delete |
| `workflows` | `update` | mutation | protected | Replaces graph in transaction |
| `workflows` | `updateName` | mutation | protected | Renames workflow |
| `workflows` | `getOne` | query | protected | Reads workflow graph |
| `workflows` | `getMany` | query | protected | Reads paginated workflow list |
| `workflows` | `execute` | mutation | protected | Dispatches Inngest workflow execution |
| `credentials` | `create` | mutation | premium | Writes encrypted secret material |
| `credentials` | `remove` | mutation | protected | Deletes credential metadata/secret |
| `credentials` | `update` | mutation | protected | Re-encrypts and updates secret |
| `credentials` | `getOne` | query | protected | Reads credential record |
| `credentials` | `getMany` | query | protected | Reads paginated credential list |
| `credentials` | `getByType` | query | protected | Reads credentials by provider type |
| `executions` | `getOne` | query | protected | Reads execution output/error |
| `executions` | `getMany` | query | protected | Reads paginated execution history |
| `mcp` | `createKey` | mutation | protected | Creates MCP API key |
| `mcp` | `listKeys` | query | protected | Reads API key metadata |
| `mcp` | `revokeKey` | mutation | protected | Revokes API key |
| `mcp` | `securitySummary` | query | protected | Reads MCP security posture |
| `mcp` | `listOAuthConnections` | query | protected | Reads linked OAuth clients |
| `mcp` | `revokeOAuthConnection` | mutation | protected | Revokes OAuth client tokens |

## Testing Principles

All internal API tests should follow these rules:

- Never touch production data. All integration tests use a dedicated test database.
- No real outbound calls. Polar, Inngest, provider APIs, email, Slack, Discord, Google APIs, and HTTP node execution are mocked unless a staging lane explicitly allows them.
- Test through the narrowest useful boundary. Use unit tests for pure helpers, caller-level tests for router behavior, database integration tests for Prisma guarantees, and transport tests for `/api/trpc`.
- Every procedure gets positive, negative, auth, ownership, validation, and error-shape coverage appropriate to its risk.
- Every production incident becomes a regression test before closure.
- Keep MCP tests separate. Add an internal API lane beside `tests/mcp` rather than broadening the existing MCP-only Vitest config.

## Target Test Layout

```txt
tests/
  api/
    README.md
    setup.mjs
    fixtures/
      factories.mjs
      graph-fixtures.mjs
      auth-fixtures.mjs
    helpers/
      db.mjs
      trpc-caller.mjs
      trpc-http-client.mjs
      mock-auth.mjs
      mock-polar.mjs
      mock-inngest.mjs
      assertions.mjs
    unit/
      trpc-middleware.test.mjs
      pagination.test.mjs
      credential-security.test.mjs
    contract/
      app-router-surface.test.mjs
      procedure-inputs.test.mjs
      error-shape.test.mjs
    integration/
      workflows-router.test.mjs
      credentials-router.test.mjs
      executions-router.test.mjs
      mcp-router.test.mjs
      tenant-isolation.test.mjs
    transport/
      trpc-route.test.mjs
      trpc-batch.test.mjs
      malformed-requests.test.mjs
    security/
      authz-negative-paths.test.mjs
      secret-redaction.test.mjs
      destructive-actions.test.mjs
```

## Target Config And Scripts

Keep the current MCP config unchanged and add a dedicated API config.

```txt
vitest.api.config.mjs
```

Recommended package scripts:

```json
{
  "test:api": "vitest run --config vitest.api.config.mjs",
  "test:api:watch": "vitest --config vitest.api.config.mjs",
  "test:api:unit": "vitest run --config vitest.api.config.mjs tests/api/unit tests/api/contract",
  "test:api:integration": "vitest run --config vitest.api.config.mjs tests/api/integration tests/api/transport tests/api/security",
  "test:api:coverage": "vitest run --config vitest.api.config.mjs --coverage",
  "test:backend": "pnpm test:mcp && pnpm test:api",
  "test:backend:coverage": "pnpm test:mcp:coverage && pnpm test:api:coverage",
  "api:release:gate": "tsx scripts/api-release-gate.ts"
}
```

Recommended API Vitest coverage target:

```txt
coverage/api/
include:
  src/trpc/**/*.ts
  src/app/api/trpc/**/*.ts
  src/features/**/server/**/*.ts
  src/lib/auth.ts
  src/lib/db.ts
  src/lib/encryption.ts
  src/lib/polar.ts
  src/inngest/**/*.ts
exclude:
  src/generated/**
  src/**/*.tsx
thresholds:
  phase 1: 70 percent lines/statements, 60 percent branches
  phase 4: 80 percent lines/statements, 70 percent branches
  phase 8: 85 percent lines/statements, 75 percent branches
```

## Test Environment Defaults

```txt
NODE_ENV=test
CI=true
DATABASE_URL=postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test
BETTER_AUTH_SECRET=test-better-auth-secret-32-characters
BETTER_AUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
APP_URL=http://127.0.0.1:3000
ENCRYPTION_KEY=test-api-encryption-key-32-characters
POLAR_ACCESS_TOKEN=test-polar-token
POLAR_SUCCESS_URL=http://127.0.0.1:3000/success
MCP_API_KEY_HMAC_SECRET=test-mcp-api-key-hmac-secret-32
MCP_OAUTH_TOKEN_HMAC_SECRET=test-mcp-oauth-token-hmac-secret-32
```

Test helpers should create these standard identities:

| Fixture | Purpose |
|---|---|
| `userAFree` | Authenticated user without active subscription |
| `userAPro` | Authenticated user with active subscription |
| `userBPro` | Second tenant for isolation tests |
| `anonymous` | No session |
| `expiredSession` | Invalid/expired auth behavior |
| `workflowGraphA` | Workflow with nodes and connections |
| `credentialA` | Credential with fake secret value |
| `executionA` | Execution with safe output |
| `maliciousExecutionA` | Execution containing prompt-injection or secret-like strings |

## Phase 0: API Test Governance And Coverage Matrix

Purpose: lock scope, risks, ownership, and release expectations before writing the suite.

Tasks:

1. Create `tests/api/README.md` explaining commands, database setup, fixture policy, and no-network policy.
2. Create a procedure test matrix for all 21 procedures.
3. Classify each procedure by:
   - query vs mutation
   - protected vs premium
   - read vs write vs destructive vs external side effect
   - database tables touched
   - services called
   - expected error codes
4. Define stop-ship criteria:
   - Cross-tenant read or write succeeds.
   - Anonymous access succeeds for a protected or premium procedure.
   - Free user can call premium procedure.
   - Raw credential value is stored unencrypted or returned to the client.
   - Workflow execution dispatches for another user's workflow.
   - Destructive mutation succeeds for another tenant.
   - Error response leaks stack traces or secrets in production-like mode.
5. Add the internal API testing plan to docs.

Acceptance criteria:

- Every tRPC procedure has at least one planned test ID.
- Every high-risk mutation has a negative-path test requirement.
- CI required checks are named before implementation starts.

## Phase 1: Test Harness Foundation

Purpose: make tests deterministic, fast, and easy to write.

Tasks:

1. Add `vitest.api.config.mjs` with Node environment and API-specific includes.
2. Add `tests/api/setup.mjs`.
3. Add a Prisma test database helper:
   - `resetDatabase()`
   - `seedUser()`
   - `seedWorkflow()`
   - `seedCredential()`
   - `seedExecution()`
   - transaction-safe cleanup between tests
4. Add tRPC caller helper:
   - Creates `appRouter` callers.
   - Mocks `auth.api.getSession`.
   - Mocks `next/headers`.
   - Supports anonymous, free, and pro users.
5. Add Polar mock helper:
   - Active subscription state.
   - No subscription state.
   - Polar API failure state.
6. Add Inngest mock helper:
   - Captures `sendWorkflowExecution` calls.
   - Prevents real event dispatch.
7. Add no-network guard:
   - Fail tests on unexpected `fetch`, `http`, or `https` outbound calls unless explicitly allowed.

Acceptance criteria:

- `pnpm test:api:unit` runs without a database.
- `pnpm test:api:integration` runs only against `DATABASE_URL` containing a test database name.
- No test can call real Polar, Inngest, provider APIs, or production URLs by accident.

## Phase 2: Contract And Schema Tests

Purpose: prevent accidental API surface drift.

Tasks:

1. Snapshot the `appRouter` procedure names.
2. Verify router namespaces:
   - `workflows`
   - `credentials`
   - `executions`
   - `mcp`
3. Validate input schemas with bad inputs:
   - missing required ids
   - empty names
   - invalid credential type
   - page size below minimum
   - page size above maximum
   - malformed nodes and edges
   - invalid MCP key scope values after scope whitelist hardening
4. Verify standard error shapes:
   - `UNAUTHORIZED`
   - `FORBIDDEN`
   - `BAD_REQUEST`
   - `NOT_FOUND`
   - `INTERNAL_SERVER_ERROR`
5. Verify SuperJSON behavior for dates in responses.
6. Create DTO contract expectations for sensitive objects.

Acceptance criteria:

- Adding, removing, or renaming a procedure fails contract tests unless the snapshot is intentionally updated.
- Invalid inputs fail before touching the database.
- Error responses are stable enough for client hooks and UI copy.

## Phase 3: Authentication, Subscription, And Authorization Tests

Purpose: prove that the middleware chain protects every procedure.

Tasks:

1. Test `protectedProcedure`:
   - anonymous user receives `UNAUTHORIZED`
   - valid session receives `ctx.auth`
   - expired or malformed session receives `UNAUTHORIZED`
2. Test `premiumProcedure`:
   - pro user can call premium procedures
   - free user receives `FORBIDDEN`
   - Polar failure returns a safe server error
3. Apply access tests to every router:
   - `workflows.create` requires premium
   - `credentials.create` requires premium
   - all other current procedures require protected session
4. Add tenant isolation tests:
   - user A cannot read user B workflow
   - user A cannot update user B workflow
   - user A cannot delete user B workflow
   - user A cannot execute user B workflow
   - user A cannot read/update/delete user B credential
   - user A cannot read user B execution
   - user A cannot revoke user B MCP key or OAuth connection

Acceptance criteria:

- Every procedure has an auth negative test.
- Every data access procedure has at least one cross-tenant negative test.
- Premium gating is tested independently from normal authentication.

## Phase 4: Router Integration Tests

Purpose: verify real business behavior against Prisma and mocked side-effect services.

### Workflows Router

Tests:

1. `create`
   - creates workflow for authenticated pro user
   - creates exactly one initial node
   - generated name is non-empty
   - free user is forbidden
2. `getMany`
   - returns only current user's workflows
   - supports search
   - applies pagination metadata correctly
   - orders by `updatedAt desc`
3. `getOne`
   - transforms Prisma nodes into React Flow nodes
   - transforms connections into React Flow edges
   - rejects another user's workflow
4. `update`
   - replaces nodes and connections in one transaction
   - deletes removed nodes through cascade
   - rolls back when a connection references a missing node
   - rejects invalid node types before or during persistence
5. `updateName`
   - renames own workflow
   - rejects empty name
   - rejects another user's workflow
6. `execute`
   - verifies ownership before dispatch
   - calls Inngest dispatch exactly once
   - does not dispatch when workflow is missing or owned by another user
7. `remove`
   - deletes own workflow
   - cascades nodes, connections, and executions
   - rejects another user's workflow

### Credentials Router

Tests:

1. `create`
   - encrypts raw value before persistence
   - never stores raw value
   - requires premium
   - rejects invalid credential type
2. `update`
   - re-encrypts new value
   - does not preserve old ciphertext
   - rejects empty name or value
3. `getOne`, `getMany`, `getByType`
   - return only current user's credentials
   - never return raw secret value
   - preferably return redacted DTOs instead of ciphertext after API hardening
4. `remove`
   - deletes own credential
   - rejects another user's credential
   - handles credentials referenced by nodes according to the Prisma relation policy

### Executions Router

Tests:

1. `getMany`
   - returns only executions for current user's workflows
   - includes workflow id and name
   - paginates and orders by `startedAt desc`
2. `getOne`
   - returns execution with workflow summary
   - rejects another user's execution
   - handles failed executions with `error` and `errorStack` safely

### MCP tRPC Router

Tests:

1. `createKey`
   - creates key for current user
   - returns raw key only once
   - validates scopes against known MCP scopes
   - handles expiration days correctly
2. `listKeys`
   - returns only current user's key metadata
   - does not return key hashes
3. `revokeKey`
   - revokes own key
   - rejects another user's key
4. `securitySummary`
   - returns user-scoped summary
5. `listOAuthConnections`
   - returns only current user's clients
6. `revokeOAuthConnection`
   - revokes current user's tokens for the requested client
   - does not revoke another user's tokens

Acceptance criteria:

- Each router has happy path, validation path, auth path, ownership path, and persistence path coverage.
- High-risk writes prove side effects do not happen after failed authorization.
- Integration tests run repeatably from an empty database.

## Phase 5: Database, Migration, And Data Integrity Tests

Purpose: prove the API behaves correctly against the real schema.

Tasks:

1. Add PostgreSQL service in CI.
2. Run `pnpm exec prisma validate`.
3. Run `pnpm exec prisma migrate deploy` against the test database.
4. Add tests for:
   - cascade deletion from workflow to nodes, connections, and executions
   - unique connection constraints
   - credential deletion behavior when linked to nodes
   - execution `inngestEventId` uniqueness
   - user deletion cascade for workflows, credentials, sessions, accounts, API keys, OAuth records
5. Add migration drift check in release gate.
6. Add seed data builders that avoid hard-coded ids except where test readability requires them.

Acceptance criteria:

- Integration CI always tests the real migrations.
- The suite fails if Prisma schema changes break current API assumptions.
- Data cleanup leaves no records after each test file or test transaction.

## Phase 6: HTTP Transport And Batch Tests

Purpose: test the actual `/api/trpc` route, not just direct router callers.

Tasks:

1. Add route helper for `fetchRequestHandler`:
   - constructs real `Request` objects
   - sends cookies/headers needed for Better Auth
   - supports batched calls
2. Test `POST /api/trpc/{procedure}`:
   - query call
   - mutation call
   - validation error
   - auth error
3. Test batched requests:
   - mixed successful queries
   - one failed procedure does not corrupt all expected responses
   - SuperJSON serialization remains valid
4. Test malformed requests:
   - bad JSON
   - unknown procedure
   - unsupported method behavior
   - oversized payload policy after body limit is introduced
5. Test error logging:
   - no console noise in `NODE_ENV=test`
   - production-like mode does not leak stacks to clients

Acceptance criteria:

- Route tests cover both unbatched and batched tRPC requests.
- Client-observable errors match expected tRPC error format.
- No route test requires a running Next dev server.

## Phase 7: Security Regression Tests

Purpose: add backend security checks that are broader than functional correctness.

Tasks:

1. Secret handling:
   - raw credential values never appear in database, response payloads, logs, or test artifacts
   - encrypted values are not accidentally decrypted by read procedures
   - API key hashes and OAuth token hashes never leave service boundaries
2. Authorization:
   - every query and mutation has cross-tenant negative coverage
   - destructive actions require ownership and valid session
3. Input abuse:
   - long names
   - empty strings
   - invalid enum values
   - cyclic or duplicate graph edges
   - oversized node `data`
   - unsafe JSON values
4. Side effects:
   - workflow execution dispatch only happens after ownership succeeds
   - failed mutations do not partially write graph data
5. Error safety:
   - Prisma errors are not exposed with connection strings or internal stack traces
   - Polar and Inngest mock failures return safe errors
6. Future production controls:
   - add rate-limit or abuse-control tests when tRPC route rate limiting is introduced
   - add audit logging tests if internal API audit events become required

Acceptance criteria:

- P0 security regressions block merges.
- Sensitive data tests scan both API responses and captured logs.
- Every new high-risk mutation requires a security test before merge.

## Phase 8: CI Implementation

Purpose: make backend API quality mandatory in pull requests, main branch pushes, and release gates.

### CI Lanes

| Lane | Trigger | Purpose | Required |
|---|---|---|---|
| Internal API Quality | PRs touching tRPC/backend files, pushes to `main` and `codex/**` | Fast unit, contract, integration, transport, security tests | Yes |
| Backend Combined Quality | Pushes to `main`, release branches, manual dispatch | Runs MCP plus internal API suites | Yes for release |
| Nightly Backend Stress | Scheduled nightly | Full API suite, coverage, optional mutation/fuzz/load jobs | No for PR, required before GA |
| Staging Release Gate | Manual release workflow | Runs API release gate against staging env and test data | Required before production deploy |

### Recommended Workflow File

Create:

```txt
.github/workflows/internal-api-quality.yml
```

Workflow:

```yaml
name: Internal API Quality

on:
  pull_request:
    paths:
      - "src/trpc/**"
      - "src/app/api/trpc/**"
      - "src/features/**/server/**"
      - "src/lib/auth.ts"
      - "src/lib/db.ts"
      - "src/lib/encryption.ts"
      - "src/lib/polar.ts"
      - "src/inngest/**"
      - "prisma/**"
      - "tests/api/**"
      - "scripts/api-*.ts"
      - "package.json"
      - "pnpm-lock.yaml"
      - "vitest.api.config.mjs"
  push:
    branches:
      - main
      - "codex/**"
  workflow_dispatch:

jobs:
  api-static:
    runs-on: ubuntu-latest
    env:
      CI: "true"
      NODE_OPTIONS: "--max-old-space-size=4096"
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Prisma validate
        run: pnpm exec prisma validate

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: API unit and contract tests
        run: pnpm test:api:unit

  api-integration:
    runs-on: ubuntu-latest
    needs: api-static
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: a8n_test
          POSTGRES_PASSWORD: a8n_test
          POSTGRES_DB: a8n_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      CI: "true"
      NODE_ENV: test
      NODE_OPTIONS: "--max-old-space-size=4096"
      DATABASE_URL: postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test
      BETTER_AUTH_SECRET: test-better-auth-secret-32-characters
      BETTER_AUTH_URL: http://127.0.0.1:3000
      NEXT_PUBLIC_APP_URL: http://127.0.0.1:3000
      APP_URL: http://127.0.0.1:3000
      ENCRYPTION_KEY: test-api-encryption-key-32-characters
      POLAR_ACCESS_TOKEN: test-polar-token
      MCP_API_KEY_HMAC_SECRET: ci-mcp-api-key-hmac-secret-32
      MCP_OAUTH_TOKEN_HMAC_SECRET: ci-mcp-oauth-token-hmac-secret-32
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm exec prisma generate

      - name: Apply migrations
        run: pnpm exec prisma migrate deploy

      - name: API integration, transport, and security tests
        run: pnpm test:api:integration

      - name: API coverage
        run: pnpm test:api:coverage

      - name: Upload API coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-coverage
          path: coverage/api
```

### Combined Backend Release Gate

Create:

```txt
.github/workflows/backend-release-gate.yml
```

This workflow should run on `workflow_dispatch`, release branches, and protected `main` pushes:

```yaml
name: Backend Release Gate

on:
  workflow_dispatch:
  push:
    branches:
      - main
      - "release/**"

jobs:
  backend-release-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Prisma validate
        run: pnpm exec prisma validate
      - name: Typecheck
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
      - name: MCP tests
        run: pnpm test:mcp
      - name: Internal API tests
        run: pnpm test:api
      - name: MCP offline evals
        run: pnpm test:mcp:offline
      - name: MCP contract check
        run: pnpm mcp:contract:check
      - name: Internal API release gate
        run: pnpm api:release:gate
      - name: Build
        run: pnpm build
```

### Branch Protection

Required checks before merge:

- `api-static`
- `api-integration`
- existing `mcp-quality`
- `typecheck`
- `lint`

Required before production release:

- `Backend Release Gate`
- staging smoke test
- latest coverage artifact attached
- release gate report stored

## Phase 9: API Release Gate Script

Purpose: make the local and CI release process repeatable.

Create:

```txt
scripts/api-release-gate.ts
```

The script should run:

1. `pnpm exec prisma validate`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test:api:unit`
5. `pnpm test:api:integration`
6. `pnpm test:api:coverage`
7. migration drift check for the selected environment
8. optional staging smoke tests when `API_RELEASE_GATE_STAGING_URL` is set

Report output:

```txt
docs/api/evidence/release-gates/YYYY-MM-DD/api-release-gate.json
```

Report fields:

- commit sha
- branch
- Node and pnpm versions
- database migration status
- command results
- coverage summary
- failed tests
- duration
- environment name

Acceptance criteria:

- Release gate fails fast on static failures.
- Release gate stores a machine-readable report.
- Release gate can run locally and in CI with the same command.

## Phase 10: Nightly And Production Readiness

Purpose: catch deeper issues without slowing every PR.

Nightly tasks:

1. Run full API and MCP coverage.
2. Run seeded two-tenant API suite with larger data volume.
3. Run graph update fuzz tests:
   - duplicate nodes
   - duplicate edges
   - missing endpoints
   - invalid node types
   - large graph payload
4. Run mutation idempotency/concurrency tests:
   - parallel workflow updates
   - parallel credential updates
   - repeated key revocation
5. Run dependency and lockfile checks.
6. Run optional staging smoke tests:
   - authenticated `workflows.getMany`
   - premium `workflows.create`
   - protected `executions.getMany`
   - no real workflow side-effect execution unless staging is isolated

Acceptance criteria:

- Nightly failures create visible issues or alerts.
- Flaky tests are quarantined with owner and deadline, not ignored silently.
- Staging smoke tests use seeded users and fake provider credentials only.

## Production Metrics To Track

| Metric | Target |
|---|---:|
| Internal tRPC p95 latency | Less than 500 ms excluding workflow execution dispatch |
| Internal tRPC error rate | Less than 1 percent for normal dashboard traffic |
| Unauthorized access incidents | 0 |
| Cross-tenant incidents | 0 |
| Raw credential leakage incidents | 0 |
| Workflow dispatch after failed authz | 0 |
| API release gate pass before production deploy | 100 percent |
| API incident regression coverage | 100 percent of closed incidents |
| API test coverage after phase 8 | 85 percent lines/statements for API-owned modules |

## Recommended Implementation Order

1. Add `vitest.api.config.mjs`, `tests/api/setup.mjs`, and package scripts.
2. Add auth, Polar, Inngest, and Prisma test helpers.
3. Add contract tests for all 21 procedures.
4. Add auth and premium gating tests.
5. Add tenant isolation tests.
6. Add router integration tests for workflows, credentials, executions, and MCP dashboard APIs.
7. Add `/api/trpc` HTTP transport and batch tests.
8. Add security regression tests for credentials, API keys, OAuth connections, destructive actions, and side-effect dispatch.
9. Add `.github/workflows/internal-api-quality.yml`.
10. Add `scripts/api-release-gate.ts` and combined backend release workflow.
11. Raise coverage thresholds after the suite becomes stable.

## Final Definition Of Done

The internal API backend testing program is production-grade when:

- All 21 current tRPC procedures have contract, auth, validation, ownership, and happy-path coverage.
- High-risk mutations have side-effect and rollback tests.
- Cross-tenant access tests exist for every user-owned read/write path.
- Credential and token tests prove raw secrets are never exposed.
- `/api/trpc` route tests cover normal, batched, malformed, unauthorized, and error paths.
- CI runs internal API tests with a real PostgreSQL service and real Prisma migrations.
- MCP and internal API quality gates both pass before backend release.
- Coverage thresholds are enforced and trend upward over time.
- Every backend production incident creates or updates a regression test.
