# Backend E2E Testing Implementation Plan

> Last updated: July 3, 2026
> Scope: production-style backend E2E tests for the a8n Next.js app, focused on real HTTP routes, auth cookies/sessions, `/api/trpc`, Prisma persistence, webhook routes, OAuth/MCP boundaries, workflow execution dispatch, and critical failure modes.
> Goal: prove that the backend works as a deployed system, not only as isolated routers, mocks, or in-process handlers.

## Short Answer

Yes, backend E2E tests are needed, but they should be fewer than unit/integration tests.

The existing internal API tests prove tRPC logic, middleware, validation, security regressions, and mocked route behavior. Backend E2E tests should prove the full production-like path:

```txt
HTTP client -> Next route -> Better Auth/session cookies -> tRPC handler -> Prisma DB -> service side effect/mock -> HTTP response
```

## Current State

| Area | Current state |
|---|---|
| Unit/API tests | `tests/api/**` with Vitest and mocked service boundaries |
| MCP E2E | `tests/e2e/mcp/widgets.spec.ts` uses Playwright for widget rendering |
| Playwright config | `playwright.config.mjs` starts `pnpm dev` and runs under `tests/e2e` |
| API release gate | `scripts/api-release-gate.ts` runs Prisma/typecheck/API tests |
| Missing layer | Black-box backend E2E against running Next app and real test DB |

## What Backend E2E Should Cover

Backend E2E should focus on production-critical journeys, not every edge case.

| Domain | E2E coverage |
|---|---|
| Auth | signup/login/logout, protected route rejection, session cookie persistence |
| tRPC transport | real `/api/trpc` query, mutation, batching, validation error, unauthorized error |
| Workflows | create, list, get, rename, graph save, delete, execute dispatch in safe mode |
| Credentials | create encrypted credential, list metadata, update secret, delete, no raw secret in API responses |
| Executions | seed/trigger execution, list execution history, get execution details, tenant isolation |
| Billing/premium | free user blocked from premium create actions, pro/test-premium user allowed |
| Webhooks | Google Form shared-secret path, Stripe signature path, malformed payload rejection |
| MCP dashboard API | create/list/revoke API key through dashboard tRPC, OAuth connection summary/revoke where seeded |
| Tenant isolation | user A cannot read/write user B workflows, credentials, executions, keys |
| Side effects | workflow execution dispatch is recorded, but real external providers are never called |
| Error safety | 400/401/403/404/500 responses do not leak stack traces, DB URLs, API keys, or raw secrets |
| Observability evidence | request IDs/log events where available, trace artifacts on failure |

## Non-Goals

Do not use backend E2E for:

- Every Zod validation branch.
- Every pagination branch.
- Every Prisma cascade edge.
- Every MCP tool. MCP already has its own protocol/eval/security suite.
- Real emails, Slack messages, Discord posts, Google Sheets writes, OpenAI calls, Anthropic calls, Gemini calls, or arbitrary HTTP node calls.

Those belong in unit, integration, contract, adversarial, or staging smoke tests.

## Target File Layout

```txt
tests/
  e2e/
    api/
      README.md
      auth.setup.ts
      fixtures/
        users.ts
        workflow-graphs.ts
      helpers/
        api-client.ts
        auth.ts
        db.ts
        trpc.ts
        secrets.ts
        assertions.ts
      specs/
        auth.e2e.ts
        trpc-transport.e2e.ts
        workflows.e2e.ts
        credentials.e2e.ts
        executions.e2e.ts
        tenant-isolation.e2e.ts
        webhooks.e2e.ts
        mcp-dashboard.e2e.ts
        error-safety.e2e.ts

playwright.api-e2e.config.mjs
```

## Target Scripts

Add scripts:

```json
{
  "test:api:e2e": "playwright test --config playwright.api-e2e.config.mjs",
  "test:api:e2e:ui": "playwright test --config playwright.api-e2e.config.mjs --ui",
  "test:api:e2e:headed": "playwright test --config playwright.api-e2e.config.mjs --headed",
  "test:backend:e2e": "pnpm test:api:e2e && pnpm test:mcp:e2e"
}
```

## Test Environment

Required environment:

```txt
NODE_ENV=test
E2E_TESTS=true
E2E_EXTERNAL_SERVICES=mock
DATABASE_URL=postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test
BETTER_AUTH_SECRET=test-better-auth-secret-32-characters
BETTER_AUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_WEBHOOK_BASE_URL=http://127.0.0.1:3000
ENCRYPTION_KEY=test-api-encryption-key-32-characters
POLAR_ACCESS_TOKEN=test-polar-token
MCP_API_KEY_HMAC_SECRET=test-mcp-api-key-hmac-secret-32
MCP_OAUTH_TOKEN_HMAC_SECRET=test-mcp-oauth-token-hmac-secret-32
WEBHOOK_SHARED_SECRET=test-webhook-secret
STRIPE_WEBHOOK_SECRET=whsec_test_secret
```

Safety requirements:

- The test server must refuse to boot E2E mode if `DATABASE_URL` does not contain `test` or `a8n_test`.
- E2E mode must block real provider calls by default.
- All generated users, workflows, credentials, executions, API keys, and OAuth records must use deterministic prefixes like `e2e_`.
- Test cleanup must delete only records with those deterministic prefixes.

## Playwright API Config

Create `playwright.api-e2e.config.mjs`:

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e/api/specs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/api-e2e", open: "never" }],
    ["json", { outputFile: "test-results/api-e2e/results.json" }]
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "true"
      ? undefined
      : {
          command: "pnpm dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            E2E_TESTS: "true",
            E2E_EXTERNAL_SERVICES: "mock",
          },
        },
});
```

Use Playwright `request` fixtures for API calls. Browser UI is not required for backend E2E unless verifying auth redirects or cookies.

## Phase 0: E2E Safety Foundation

Purpose: prevent E2E tests from touching production data or real external systems.

Tasks:

1. Add E2E mode:
   - `E2E_TESTS=true`
   - `E2E_EXTERNAL_SERVICES=mock`
2. Add a startup guard:
   - reject E2E mode unless `DATABASE_URL` points to a test database.
3. Add outbound network guard for workflow execution:
   - block OpenAI, Anthropic, Gemini, Slack, Discord, Google APIs, SMTP, arbitrary HTTP node URLs unless explicitly mocked.
4. Add deterministic test IDs:
   - users: `e2e_user_a`, `e2e_user_b`, `e2e_pro_user`
   - workflows: `e2e_workflow_*`
   - credentials: `e2e_credential_*`
   - API keys: `e2e_api_key_*`
5. Add cleanup helper:
   - deletes only `e2e_*` records.
6. Add Playwright API E2E config and scripts.

Acceptance criteria:

- E2E tests cannot run against production database names.
- E2E tests cannot call real external providers.
- Re-running tests leaves the test database clean.

## Phase 1: Auth And Session E2E

Purpose: prove the real auth boundary works over HTTP.

Test cases:

1. Sign up a new test user through `/api/auth`.
2. Log in with email/password and capture cookies.
3. Call protected `/api/trpc/workflows.getMany` with session cookies and get 200.
4. Call protected `/api/trpc/workflows.getMany` without cookies and get 401.
5. Logout and prove the same protected call fails.
6. Attempt invalid login and verify safe error response.

Acceptance criteria:

- Auth cookies are set and honored by the actual Next server.
- Protected tRPC route rejects missing/invalid sessions.
- Error response does not expose Better Auth internals.

## Phase 2: tRPC Transport E2E

Purpose: prove real HTTP tRPC transport behavior.

Test cases:

1. Query:
   - `workflows.getMany`
   - real HTTP request with cookies
   - expected response shape
2. Mutation:
   - `workflows.updateName`
   - DB row changes after response
3. Batch:
   - `workflows.getMany` + `credentials.getByType`
   - one request, two valid results
4. Validation:
   - invalid page size returns tRPC `BAD_REQUEST`
5. Unknown procedure:
   - returns safe tRPC error
6. Malformed JSON:
   - returns safe 400-class response
7. SuperJSON:
   - Date fields deserialize correctly on client side where applicable

Acceptance criteria:

- Real `/api/trpc` behaves like the in-process transport tests.
- Batch behavior works through the deployed route.
- Malformed requests do not leak stack traces or environment values.

## Phase 3: Workflow Lifecycle E2E

Purpose: prove the main product backend flow works end to end.

Test cases:

1. Pro/test-premium user creates workflow.
2. Free user cannot create workflow.
3. User lists workflows and sees only their own records.
4. User gets workflow graph.
5. User saves a valid graph:
   - nodes persisted
   - edges persisted
6. User attempts invalid graph:
   - rejected
   - previous graph remains intact
7. User renames workflow.
8. User deletes workflow.
9. Deleted workflow no longer appears.

Acceptance criteria:

- CRUD behavior works through real HTTP, auth, tRPC, and Prisma.
- Graph updates are atomic from the user's perspective.
- Tenant boundaries hold through HTTP.

## Phase 4: Credential Lifecycle E2E

Purpose: prove credential security across real HTTP and database persistence.

Test cases:

1. Pro/test-premium user creates credential.
2. Free user cannot create credential.
3. Stored DB value is encrypted and not equal to raw input.
4. API response does not contain raw secret.
5. User lists credential metadata.
6. User filters by credential type.
7. User updates credential secret:
   - new DB value is encrypted
   - old ciphertext changes
8. User deletes credential.
9. Another user cannot read/update/delete the credential.

Acceptance criteria:

- Raw secrets never appear in API responses, logs, traces, or Playwright artifacts.
- Credential ownership is enforced through the HTTP boundary.

## Phase 5: Execution And Side-Effect E2E

Purpose: prove workflow execution dispatch without real external provider side effects.

Required app support:

- E2E Inngest mock or local Inngest test recorder.
- A way to read dispatch records, for example a test-only route guarded by `E2E_TESTS=true`.

Test cases:

1. Create workflow with manual trigger.
2. Save executable graph.
3. Execute workflow.
4. Verify:
   - ownership lookup succeeded
   - dispatch record exists
   - response returns workflow
5. Attempt to execute another user's workflow:
   - request fails
   - no dispatch record created
6. Seed execution records and verify:
   - `executions.getMany`
   - `executions.getOne`
   - failed execution payloads are safe

Acceptance criteria:

- E2E proves dispatch path without sending real external messages.
- Failed authorization cannot create dispatch records.

## Phase 6: Webhook E2E

Purpose: prove public backend entry points reject bad traffic and accept signed traffic.

Test cases:

1. Google Form webhook:
   - missing shared secret rejected
   - wrong shared secret rejected
   - valid shared secret accepted
   - malformed payload rejected safely
2. Stripe webhook:
   - missing signature rejected
   - wrong signature rejected
   - valid test signature accepted
   - replay/old timestamp rejected if timestamp tolerance is configured
3. Confirm webhook responses:
   - no stack traces
   - no raw secrets
   - deterministic status codes

Acceptance criteria:

- Public webhook routes fail closed.
- Valid test-signed events can pass without contacting real Stripe.

## Phase 7: MCP Dashboard Backend E2E

Purpose: cover the dashboard tRPC procedures that manage MCP auth state.

Test cases:

1. Create MCP API key.
2. Assert raw key is returned once.
3. List keys:
   - no raw key
   - no key hash
4. Revoke key.
5. List keys and verify revoked metadata.
6. Seed OAuth connection.
7. List OAuth connections.
8. Revoke OAuth connection.
9. Verify access/refresh tokens revoked in DB.
10. Other user cannot list/revoke these records.

Acceptance criteria:

- API key and OAuth token sensitive fields never leave service boundaries.
- Revocation works through real HTTP and DB state.

## Phase 8: Tenant Isolation E2E

Purpose: prove cross-tenant isolation for every critical backend object.

Seed:

- `userA`
- `userB`
- workflow A/B
- credential A/B
- execution A/B
- MCP key A/B
- OAuth connection A/B

Test cases:

1. User A cannot get User B workflow.
2. User A cannot rename User B workflow.
3. User A cannot save graph for User B workflow.
4. User A cannot delete User B workflow.
5. User A cannot execute User B workflow.
6. User A cannot get/update/delete User B credential.
7. User A cannot get User B execution.
8. User A cannot revoke User B API key.
9. User A cannot revoke User B OAuth connection.

Acceptance criteria:

- Cross-tenant attempts return safe 403/404-class responses.
- No DB state changes for User B.
- No side effects are created.

## Phase 9: Error Safety And Abuse E2E

Purpose: verify production-safe errors at the real HTTP layer.

Test cases:

1. Oversized request body after request-size limit is introduced.
2. Malformed JSON body.
3. Unknown tRPC route.
4. Invalid enum.
5. Invalid graph references.
6. Simulated Prisma failure in E2E mock mode.
7. Simulated Inngest failure in E2E mock mode.
8. Simulated Polar failure in E2E mock mode.

Every response and trace must be scanned for:

- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `BETTER_AUTH_SECRET`
- `POLAR_ACCESS_TOKEN`
- `keyHash`
- `tokenHash`
- raw credential value
- stack traces in production-like mode

Acceptance criteria:

- Failures are safe and actionable.
- Test artifacts do not leak secrets.

## Phase 10: CI And Release Gate

Purpose: make backend E2E repeatable but not too slow for every PR.

Recommended scripts:

```json
{
  "test:api:e2e": "playwright test --config playwright.api-e2e.config.mjs",
  "test:backend:e2e": "pnpm test:api:e2e && pnpm test:mcp:e2e"
}
```

Recommended CI lanes:

| Lane | Trigger | Checks |
|---|---|---|
| API E2E Smoke | PRs touching backend routes/tests | auth, tRPC transport, one workflow happy path |
| Full API E2E | `main`, `codex/**`, manual | all backend E2E specs |
| Nightly E2E | scheduled | full backend E2E, MCP E2E, coverage artifacts, DB cleanup audit |
| Release E2E | before production deploy | full backend E2E against staging-like test DB |

Artifacts:

```txt
playwright-report/api-e2e/
test-results/api-e2e/
docs/api/evidence/e2e/YYYY-MM-DD/
```

Acceptance criteria:

- PR smoke E2E finishes in under 5 minutes.
- Full E2E finishes in under 15 minutes.
- Release gate blocks on failed auth, tenant isolation, credential secrecy, workflow dispatch, or webhook security tests.

## Minimum Smoke Suite

If time is limited, implement these first:

1. Login and protected tRPC query succeeds.
2. Anonymous protected tRPC query fails.
3. Pro/test-premium user creates workflow.
4. Free user cannot create workflow.
5. Save workflow graph.
6. Create credential and verify raw secret is not returned.
7. Execute workflow in E2E mock mode and verify dispatch record.
8. User A cannot read User B workflow.
9. Valid webhook accepted and invalid webhook rejected.

## Production Stop-Ship Criteria

Backend E2E must block release if any of these happen:

- Anonymous user reaches protected backend data.
- Free user reaches premium-only backend mutation.
- User A reads or mutates User B data.
- Raw credential value appears in response, logs, traces, screenshots, or artifacts.
- API key hash or OAuth token hash appears in response.
- Workflow execution dispatch occurs after failed authorization.
- Webhook accepts missing or invalid signature/secret.
- Malformed request leaks stack trace, database URL, or secret env value.
- E2E cleanup fails and leaves test records in the database.

## Final Definition Of Done

Backend E2E is production-grade when:

- Critical auth, tRPC, workflow, credential, execution, webhook, MCP dashboard, and tenant-isolation paths run against a real Next server and real test database.
- Real external side effects are impossible in E2E mode.
- E2E tests generate useful Playwright traces and JSON reports.
- CI has smoke, full, nightly, and release lanes.
- Every production backend incident adds or updates an E2E, integration, or security regression test.
- Release cannot pass if backend E2E exposes a P0 data, auth, secret, or side-effect failure.
