# Staging Environment Runbook

Staging is the production rehearsal environment. It should behave like production but use staging-only data, staging-only secrets, and sandbox external providers.

## Goals

- Deploy `main` and release branches to a stable staging app.
- Run production-strength environment validation with staging values.
- Apply Prisma migrations before app promotion.
- Run backend release gates before exposing the staging deployment.
- Smoke the deployed staging URL.
- Keep evidence for release approval.

## Implemented Automation

| Artifact | Purpose |
|---|---|
| `.github/workflows/staging-deploy.yml` | Protected staging deploy pipeline |
| `pnpm smoke:staging` | Smoke test a staging URL |
| `scripts/environment-smoke.ts` | Shared environment smoke runner |
| `docs/api/evidence/smoke/staging` | Staging smoke evidence |
| `docs/api/evidence/migrations` | Migration preflight and status evidence |
| `docs/api/evidence/security` | Security release evidence |
| `docs/api/evidence/feature-flags` | Feature flag release evidence |
| `docs/api/evidence/incidents` | Incident readiness evidence |
| `docs/api/evidence/disaster-recovery` | Restore drill readiness evidence |
| `docs/api/evidence/performance` | Performance readiness evidence |
| `docs/api/evidence/governance` | Governance readiness evidence |
| `docs/api/evidence/environment-drift` | Environment drift evidence |

## Required GitHub Environment

Create a GitHub Environment named `staging`.

Recommended protection:

- Require approval for manual deploys if the release is risky.
- Allow only maintainers to edit staging secrets.
- Keep staging secrets separate from production secrets.
- Do not expose staging secrets to `pull_request` workflows.

## Required GitHub Variables

| Variable | Example |
|---|---|
| `STAGING_APP_URL` | `https://staging.example.com` |
| `STAGING_WEBHOOK_BASE_URL` | `https://staging.example.com` |
| `STAGING_POLAR_SUCCESS_URL` | `https://staging.example.com/success?checkout_id={CHECKOUT_ID}` |
| `STAGING_FEATURE_FLAGS_ENABLED` | `true` |
| `STAGING_CANARY_ROLLOUT_PERCENT` | `0` |
| `STAGING_FEATURE_FLAG_NEW_WORKFLOW_EDITOR_ROLLOUT_PERCENT` | `0` |
| `STAGING_FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT` | `0` |
| `STAGING_FEATURE_FLAG_MCP_ENHANCED_TOOLING_ROLLOUT_PERCENT` | `0` |
| `STAGING_FEATURE_FLAG_CREDENTIAL_ROTATION_FLOW_ROLLOUT_PERCENT` | `0` |
| `STAGING_EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT` | Empty unless forcing a variant |
| `STAGING_KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION` | `false` |
| `STAGING_KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING` | `false` |
| `STAGING_KILL_SWITCH_DISABLE_MCP_MUTATIONS` | `false` |
| `STAGING_LOAD_TEST_WORKFLOW_ID` | Staging workflow used only for controlled load tests |

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `STAGING_DATABASE_URL` | Staging database connection |
| `STAGING_BETTER_AUTH_SECRET` | Better Auth staging secret |
| `STAGING_ENCRYPTION_KEY` | Staging credential encryption key |
| `STAGING_POLAR_ACCESS_TOKEN` | Polar sandbox/staging token |
| `STAGING_MCP_API_KEY_HMAC_SECRET` | MCP API key hash secret |
| `STAGING_MCP_OAUTH_TOKEN_HMAC_SECRET` | MCP OAuth token hash secret |
| `STAGING_A8N_WEBHOOK_SHARED_SECRET` | App webhook staging secret |
| `STAGING_GOOGLE_FORM_WEBHOOK_SECRET` | Google Forms webhook staging secret |
| `STAGING_STRIPE_WEBHOOK_SECRET` | Stripe sandbox webhook secret |
| `STAGING_STRIPE_WEBHOOK_SHARED_SECRET` | Stripe shared webhook staging secret |
| `STAGING_VERCEL_ORG_ID` | Vercel org for staging project |
| `STAGING_VERCEL_PROJECT_ID` | Vercel staging project id |
| `VERCEL_TOKEN` | Token allowed to deploy only the staging project |
| `STAGING_MCP_LOAD_TEST_BEARER_TOKEN` | Secret used only for controlled MCP/workflow load tests |

## Staging Platform Requirements

| Area | Requirement |
|---|---|
| Vercel | Dedicated staging project, not the production project |
| Database | Dedicated staging DB or Neon branch, not production |
| Inngest | Dedicated staging app |
| OAuth | Staging callback URLs and staging OAuth apps |
| Billing | Polar sandbox |
| Webhooks | Sandbox/test provider webhooks |
| Email | Test mailbox or disabled sending |
| MCP | Staging OAuth issuer/resource and CORS origin |

## Workflow Behavior

`staging-deploy.yml` runs on `main`, `release/**`, and manual dispatch.

The pipeline:

1. Installs dependencies with frozen lockfile.
2. Runs production-profile env validation using staging secrets.
3. Validates Prisma schema.
4. Runs database migration preflight.
5. Applies migrations to the staging database.
6. Runs migration status with DB checks.
7. Runs internal API release gate with DB checks.
8. Runs API E2E smoke gate.
9. Runs MCP release gate.
10. Runs observability readiness.
11. Runs security release check.
12. Runs feature flag readiness check.
13. Runs incident readiness.
14. Runs restore drill readiness.
15. Runs performance readiness.
16. Runs governance readiness.
17. Runs environment drift detection.
18. Builds the app.
19. Deploys to the dedicated Vercel staging project.
20. Runs staging smoke against the deployed URL.
21. Uploads release, migration, E2E, observability, security, feature flag, incident, DR, performance, governance, drift, and smoke evidence.

## Required Commands

Smoke an existing staging URL:

```powershell
pnpm smoke:staging -- --base-url https://staging.example.com
```

Run staging-style gates locally when a staging database is configured:

```powershell
pnpm env:check -- --profile production
pnpm db:migration:preflight -- --db
pnpm api:release:gate -- --strict --db --json
pnpm api:e2e:release:gate -- --smoke --json
pnpm security:release:check -- --strict --json
pnpm feature-flags:check -- --strict --json
pnpm incident:check -- --strict --json
pnpm restore:drill:check -- --strict --json
pnpm performance:check -- --strict --json
pnpm governance:check -- --strict --json
pnpm environment:drift:check -- --strict --json
```

## Promotion Rules

Staging must pass before production when a release includes:

- Database migrations.
- Auth, billing, webhook, MCP, or credential changes.
- Workflow execution changes.
- New environment variables.
- External provider behavior.
- User-facing flows that need manual QA.

## Staging Release Checklist

- [ ] Staging environment secrets are present and staging-only.
- [ ] `pnpm env:check -- --profile production` passed in staging workflow.
- [ ] Migrations applied to staging.
- [ ] Migration status passed.
- [ ] API release gate passed.
- [ ] API E2E smoke passed.
- [ ] MCP release gate passed if MCP changed.
- [ ] Observability readiness passed.
- [ ] Security release check passed.
- [ ] Feature flag readiness passed.
- [ ] Incident readiness passed.
- [ ] Restore drill readiness passed.
- [ ] Performance readiness passed.
- [ ] Governance readiness passed.
- [ ] Environment drift check passed.
- [ ] Staging smoke passed against deployed URL.
- [ ] Release evidence uploaded.

## Rollback And Recovery

If staging deployment fails:

1. Do not promote to production.
2. Inspect workflow evidence and Vercel logs.
3. If migration failed, fix with a new migration and rerun staging.
4. If deployment failed after migration, prefer roll-forward with a code fix.
5. If staging data was corrupted, reset staging from backup or recreate the staging branch.

Staging can be reset more aggressively than production, but it should still be treated as production rehearsal.

## Evidence

Staging workflow uploads:

- `docs/api/evidence/migrations`
- `docs/api/evidence/release-gates`
- `docs/api/evidence/e2e`
- `docs/api/evidence/observability`
- `docs/api/evidence/security`
- `docs/api/evidence/feature-flags`
- `docs/api/evidence/incidents`
- `docs/api/evidence/disaster-recovery`
- `docs/api/evidence/performance`
- `docs/api/evidence/governance`
- `docs/api/evidence/environment-drift`
- `docs/api/evidence/smoke/staging`
- `playwright-report/api-e2e`
- `test-results/api-e2e`

## Troubleshooting

| Symptom | Action |
|---|---|
| Env check fails | Add missing staging variable/secret or fix HTTPS URL |
| Migration deploy fails | Rehearse on a disposable DB branch and add a corrective migration |
| Release gate fails | Treat as release-blocking until fixed or explicitly waived |
| Vercel deploy fails | Check `VERCEL_TOKEN`, `STAGING_VERCEL_ORG_ID`, and `STAGING_VERCEL_PROJECT_ID` |
| Smoke fails | Check deployed URL, app logs, route errors, and staging env values |
