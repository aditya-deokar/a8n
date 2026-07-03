# Internal API Test Suite

This suite covers the dashboard/editor tRPC backend. It is intentionally separate from `tests/mcp` so MCP protocol quality gates and internal API quality gates can evolve independently.

## Scope

Covered in phases 0-5:

- tRPC router surface contracts.
- Input validation and standard error codes.
- `protectedProcedure` authentication behavior.
- `premiumProcedure` subscription behavior.
- Anonymous access checks for every current tRPC procedure.
- Premium access checks for premium-only procedures.
- Router-level integration checks for workflows, credentials, executions, and MCP dashboard APIs.
- Guarded real-database integrity checks for cascades and uniqueness constraints.
- Mocked service boundaries for Better Auth, Polar, Inngest, and MCP dashboard services in fast tests.

Covered in phases 6-7:

- In-process `/api/trpc` route tests without a Next dev server.
- Batched tRPC query tests through `httpBatchLink`.
- Malformed request and unknown procedure route tests.
- Security regressions for credential secrets, API-key exposure, OAuth token exposure, destructive ownership filters, and side-effect ordering.

Covered in phases 8-10:

- Internal API GitHub Actions quality workflow.
- Combined backend release gate workflow.
- Nightly internal API workflow with coverage, database integrity, and release-gate artifacts.
- `scripts/api-release-gate.ts` for local and CI release evidence.
- Evidence output under `docs/api/evidence/release-gates/YYYY-MM-DD/api-release-gate.json`.

Later phases should add broader load/fuzz testing and authenticated staging smoke bootstrap.

## Commands

```bash
pnpm test:api
pnpm test:api:unit
pnpm test:api:integration
pnpm test:api:coverage
pnpm api:release:gate
```

Real database integrity tests are opt-in:

```bash
API_DATABASE_TESTS=true pnpm test:api:db
```

On Windows PowerShell:

```powershell
$env:API_DATABASE_TESTS="true"; pnpm test:api:db
```

Release gate with database integrity:

```powershell
$env:API_DATABASE_TESTS="true"; pnpm api:release:gate -- --strict --db
```

Nightly-style local run:

```powershell
$env:API_DATABASE_TESTS="true"; pnpm test:api:nightly
```

## No Production Data

The test setup defaults to:

```txt
NODE_ENV=test
DATABASE_URL=postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test
BETTER_AUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
APP_URL=http://127.0.0.1:3000
```

Fast tests mock database and external service modules. The guarded database tests refuse to run unless `DATABASE_URL` points to a dedicated test/local database.

## Procedure Matrix

| Test ID | Procedure | Access | Current coverage |
|---|---|---|---|
| API-WF-001 | `workflows.create` | premium | contract, anonymous, free-user forbidden, pro-user allowed, integration |
| API-WF-002 | `workflows.remove` | protected | contract, anonymous, destructive ownership |
| API-WF-003 | `workflows.update` | protected | contract, validation, anonymous, integration, invalid graph security |
| API-WF-004 | `workflows.updateName` | protected | contract, validation, anonymous, route mutation |
| API-WF-005 | `workflows.getOne` | protected | contract, anonymous, integration |
| API-WF-006 | `workflows.getMany` | protected | contract, validation, anonymous, integration, route query, batched query |
| API-WF-007 | `workflows.execute` | protected | contract, anonymous, integration, side-effect ordering |
| API-CR-001 | `credentials.create` | premium | contract, validation, anonymous, free-user forbidden, pro-user allowed, secret regression |
| API-CR-002 | `credentials.remove` | protected | contract, anonymous, destructive ownership |
| API-CR-003 | `credentials.update` | protected | contract, validation, anonymous, secret regression |
| API-CR-004 | `credentials.getOne` | protected | contract, anonymous, integration |
| API-CR-005 | `credentials.getMany` | protected | contract, validation, anonymous, secret regression |
| API-CR-006 | `credentials.getByType` | protected | contract, validation, anonymous, integration, batched query |
| API-EX-001 | `executions.getOne` | protected | contract, anonymous, integration |
| API-EX-002 | `executions.getMany` | protected | contract, validation, anonymous, integration |
| API-MCP-001 | `mcp.createKey` | protected | contract, validation, anonymous, integration, one-time raw key check |
| API-MCP-002 | `mcp.listKeys` | protected | contract, anonymous, integration, key exposure regression |
| API-MCP-003 | `mcp.revokeKey` | protected | contract, anonymous, destructive ownership |
| API-MCP-004 | `mcp.securitySummary` | protected | contract, anonymous, integration |
| API-MCP-005 | `mcp.listOAuthConnections` | protected | contract, anonymous, integration |
| API-MCP-006 | `mcp.revokeOAuthConnection` | protected | contract, validation, anonymous, destructive ownership, token exposure regression |

## Stop-Ship Criteria

- Anonymous access succeeds for any protected or premium procedure.
- Free user can call `workflows.create` or `credentials.create`.
- Procedure names drift without an intentional contract test update.
- Invalid input reaches mocked persistence or side-effect services.
- Raw credential values appear in responses, logs, or test artifacts.
- Workflow execution dispatches before ownership checks in future integration phases.
- API key hashes or OAuth token hashes leave service boundaries.
- Destructive mutations omit the authenticated user's id from the ownership boundary.

## CI Workflows

| Workflow | Purpose |
|---|---|
| `.github/workflows/internal-api-quality.yml` | PR/push quality lane for tRPC backend changes |
| `.github/workflows/backend-release-gate.yml` | Combined MCP and internal API backend release gate |
| `.github/workflows/internal-api-nightly.yml` | Nightly full API coverage, DB integrity, and evidence artifacts |

## Release Evidence

`pnpm api:release:gate` writes:

```txt
docs/api/evidence/release-gates/YYYY-MM-DD/api-release-gate.json
```

The report redacts database URLs, API keys, bearer tokens, common provider secrets, and sensitive environment values.
