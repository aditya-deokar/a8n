# CI/CD Flow And Real Scenarios

This document explains how the full DevOps pipeline behaves from local development to production.

## Pipeline Map

```mermaid
flowchart LR
    Local["Local Docker Dev"] --> Branch["Feature Branch"]
    Branch --> PR["Pull Request"]
    PR --> CI["CI Quality Gates"]
    CI --> Preview["Preview Readiness"]
    Preview --> Main["Merge To Main"]
    Main --> Staging["Staging Deploy"]
    Staging --> ProdApproval["Production Approval"]
    ProdApproval --> Production["Production Deploy"]
    Production --> Smoke["Smoke + Manifest"]
    Smoke --> Evidence["Release Evidence"]
```

## Local Flow

Use this before opening a PR:

```powershell
pnpm db:local:up
pnpm db:local:wait
pnpm db:local:generate
pnpm db:local:migrate
pnpm env:check:local-docker
pnpm typecheck:local-docker
pnpm build:local-docker
pnpm dev:local-docker
```

For API testing with a separate test database:

```powershell
pnpm db:test:up
pnpm db:test:migrate
pnpm test:api:docker-db
pnpm api:release:gate:docker-db
```

## Pull Request Flow

When you push a branch and open a PR:

1. CODEOWNERS decides whether protected files need owner review.
2. CI installs dependencies from the lockfile.
3. Env checks validate required local/test config.
4. Prisma validate catches schema errors.
5. Typecheck and lint catch code issues.
6. API/MCP tests protect backend behavior.
7. Migration preflight catches risky SQL.
8. Security, feature flag, observability, incident, DR, performance, governance, and drift checks produce evidence.

## Main Branch And Staging Flow

After merge to `main`:

1. `staging-deploy.yml` uses the protected `staging` GitHub environment.
2. Staging secrets are loaded, never production secrets.
3. Migrations are applied to the staging database.
4. API release gate and API E2E smoke run.
5. MCP release gate runs.
6. Security, feature flag, incident, DR, performance, governance, and drift checks run.
7. App deploys to the staging Vercel project.
8. Staging smoke runs against the deployed URL.
9. Evidence is uploaded as workflow artifacts.

## Production Flow

Production is manual:

1. Open GitHub Actions.
2. Run `Production Deploy`.
3. Provide:
   - `version`, for example `v0.1.0`.
   - `rollback_target`, for example previous Vercel deployment URL or commit SHA.
   - `apply_migrations=true`.
   - `backup_confirmed=true`.
4. GitHub waits for protected production approval.
5. Production env validation runs.
6. Security, feature flag, incident, DR, performance, governance, and drift checks run.
7. Prisma validate and migration preflight run.
8. Migrations deploy if enabled.
9. App builds and deploys to production Vercel.
10. Production smoke runs.
11. Release manifest is generated in `docs/releases`.
12. Evidence is uploaded.

## Scenario 1: Simple UI Or Copy Change

Example: You change dashboard text.

Expected flow:

- Local: `pnpm build:local-docker`.
- PR: typecheck, lint, build, and baseline checks run.
- Staging: deploy and smoke.
- Production: normal manual deploy.

Risk:

- Low.

Rollback:

- Roll back Vercel deployment if needed.

## Scenario 2: tRPC Procedure Change

Example: You modify `workflows.create`.

Expected flow:

- Local: `pnpm test:api:docker-db`.
- PR: API unit, contract, integration, security tests run.
- Release gate: `api:release:gate` verifies protected paths and contracts.
- Staging: API E2E smoke verifies HTTP behavior.

Risk:

- Medium to high if auth, persistence, or tenant isolation changed.

Rollback:

- Prefer feature flag or app rollback.

## Scenario 3: Database Migration

Example: You add a required column.

Expected flow:

- Local: run migration against Docker DB.
- PR: migration preflight scans SQL.
- Staging: migration deploy runs before app deploy.
- Production: backup confirmation is required before migration deploy.

Risk:

- High if destructive or non-expand-contract.

Rollback:

- Prefer roll-forward migration.
- Restore only for confirmed corruption.

## Scenario 4: Webhook Change

Example: You change Stripe webhook processing.

Expected flow:

- Local: use Docker DB and mock provider payloads.
- PR: API/security tests and webhook checks run.
- Staging: sandbox provider secrets only.
- Production: deploy with `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING=false`, but be ready to turn it `true`.

Risk:

- High because providers retry and payload signatures matter.

Rollback:

- Enable webhook kill switch.
- Roll back app deployment.

## Scenario 5: MCP Mutation Tool Change

Example: You add a new MCP workflow mutation.

Expected flow:

- PR: MCP quality and offline evals run.
- Release gate: MCP contract and safety checks run.
- Staging: authenticated MCP route smoke.
- Production: keep `KILL_SWITCH_DISABLE_MCP_MUTATIONS` ready.

Risk:

- High because AI clients can trigger side effects.

Rollback:

- Turn on MCP mutation kill switch.
- Roll back deployment if needed.

## Scenario 6: Feature Flag Or Canary Release

Example: You roll out a new workflow editor to 10 percent.

Expected flow:

- PR: feature flag registry check.
- Staging: verify flag and experiment behavior.
- Production: start at 0 percent, then increase gradually.
- Observe error rate, p95 latency, workflow failures, and support signals.

Risk:

- Controlled by rollout percent.

Rollback:

- Set rollout percent to 0.
- Use kill switch if required.

## Scenario 7: Environment Drift

Example: staging has a provider secret missing.

Expected flow:

- `environment:drift:check` fails.
- Staging or production promotion stops.
- Update GitHub environment secret or update `infra/environment-baseline.json` through PR.

Risk:

- High because config can pass locally and fail after deploy.

Rollback:

- Restore previous environment value.
- Rerun staging deploy.

## Scenario 8: Security Dependency Change

Example: you upgrade auth or OAuth packages.

Expected flow:

- PR: dependency review, CodeQL, secret scan, security release check.
- Staging: auth and protected routes smoke.
- Production: deploy only with rollback target and monitoring.

Risk:

- High for auth/session/OAuth behavior.

Rollback:

- Roll back app deployment.
- Rotate secrets only if exposure occurred.

## Scenario 9: Incident Hotfix

Example: production workflow execution is broken.

Expected flow:

- Create hotfix branch.
- Keep scope minimal.
- Run focused local checks.
- Staging if possible.
- Production deploy with approval, backup confirmation, and rollback target.
- Create postmortem action items.

Risk:

- High but necessary.

Rollback:

- Kill switch first, then app rollback.

## Scenario 10: Neon Data Needed Locally

Example: a bug only reproduces with real Neon data.

Expected flow:

```powershell
$env:NEON_DATABASE_URL="postgresql://user:password@ep-your-neon-host/neondb?sslmode=require"
pnpm db:local:up
pnpm db:neon:restore:local -- --yes
pnpm db:local:migrate
pnpm dev:local-docker
```

Rules:

- Never commit the Neon URL.
- Never restore production data into shared staging unless approved.
- Treat local dump files under `tmp/db-dumps` as sensitive.
