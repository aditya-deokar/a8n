# Production Release Runbook

Production deploys are controlled, approved, observable, and reversible. Use this runbook for every production deployment.

## Goals

- Require manual production approval through the protected GitHub `production` environment.
- Confirm backup or PITR before changing production.
- Apply committed Prisma migrations in a controlled step.
- Deploy the app to the dedicated production Vercel project.
- Run production smoke checks after deploy.
- Generate a release manifest with rollback target and evidence links.
- Preserve release evidence as GitHub artifacts.

## Implemented Automation

| Artifact | Purpose |
|---|---|
| `.github/workflows/production-deploy.yml` | Manual protected production deployment |
| `pnpm smoke:prod` | Production smoke check |
| `pnpm release:manifest` | Machine-readable release manifest |
| `pnpm observability:check` | Observability readiness evidence |
| `pnpm security:release:check` | Security and supply-chain readiness evidence |
| `pnpm feature-flags:check` | Feature flag, canary, experiment, and kill-switch readiness evidence |
| `pnpm incident:check` | Incident response and rollback readiness evidence |
| `pnpm restore:drill:check` | Disaster recovery and restore drill readiness evidence |
| `pnpm performance:check` | Performance budget, load-test, and cost readiness evidence |
| `pnpm governance:check` | Platform governance, release calendar, access review, and error budget readiness evidence |
| `pnpm environment:drift:check` | Environment baseline and staging/production drift detection evidence |
| `docs/releases` | Release manifests and release notes |
| `docs/api/evidence/smoke/production` | Production smoke evidence |
| `docs/api/evidence/security` | Security release evidence |
| `docs/api/evidence/feature-flags` | Feature flag release evidence |
| `docs/api/evidence/incidents` | Incident readiness evidence |
| `docs/api/evidence/disaster-recovery` | Disaster recovery evidence |
| `docs/api/evidence/performance` | Performance readiness evidence |
| `docs/api/evidence/governance` | Platform governance readiness evidence |
| `docs/api/evidence/environment-drift` | Environment drift detection evidence |

## Required GitHub Environment

Create a GitHub Environment named `production`.

Required protections:

- Manual approval by a maintainer.
- Production secrets only available to this environment.
- No production secrets in `pull_request` workflows.
- Restrict who can approve deployments.
- Keep deployment history and artifacts.

## Required Workflow Inputs

| Input | Required | Meaning |
|---|---|---|
| `version` | Yes | Release version, such as `v1.4.0` |
| `rollback_target` | Yes | Known-good version, commit, or Vercel deployment |
| `release_notes_url` | No | PR, changelog, or release note URL |
| `apply_migrations` | Yes | Whether to run `prisma migrate deploy` |
| `backup_confirmed` | Yes | Must be true before the workflow continues |

## Required GitHub Variables

| Variable | Example |
|---|---|
| `PRODUCTION_APP_URL` | `https://app.example.com` |
| `PRODUCTION_WEBHOOK_BASE_URL` | `https://app.example.com` |
| `PRODUCTION_POLAR_SUCCESS_URL` | `https://app.example.com/success?checkout_id={CHECKOUT_ID}` |
| `OBSERVABILITY_LOG_ENABLED` | `true` |
| `OBSERVABILITY_LOG_LEVEL` | `info` |
| `OBSERVABILITY_PROVIDER` | `console`, `sentry`, `otel`, or `datadog` |
| `OBSERVABILITY_METRICS_ENDPOINT` | Provider metrics endpoint if used |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint if used |
| `OTEL_SERVICE_NAME` | `a8n` |
| `PRODUCTION_FEATURE_FLAGS_ENABLED` | `true` |
| `PRODUCTION_CANARY_ROLLOUT_PERCENT` | `0` |
| `PRODUCTION_FEATURE_FLAG_NEW_WORKFLOW_EDITOR_ROLLOUT_PERCENT` | `0` |
| `PRODUCTION_FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT` | `0` |
| `PRODUCTION_FEATURE_FLAG_MCP_ENHANCED_TOOLING_ROLLOUT_PERCENT` | `0` |
| `PRODUCTION_FEATURE_FLAG_CREDENTIAL_ROTATION_FLOW_ROLLOUT_PERCENT` | `0` |
| `PRODUCTION_EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT` | Empty unless forcing a variant |
| `PRODUCTION_KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION` | `false` |
| `PRODUCTION_KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING` | `false` |
| `PRODUCTION_KILL_SWITCH_DISABLE_MCP_MUTATIONS` | `false` |

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `PRODUCTION_DATABASE_URL` | Production database connection |
| `PRODUCTION_BETTER_AUTH_SECRET` | Better Auth production secret |
| `PRODUCTION_ENCRYPTION_KEY` | Credential encryption key |
| `PRODUCTION_POLAR_ACCESS_TOKEN` | Polar production token |
| `PRODUCTION_MCP_API_KEY_HMAC_SECRET` | MCP API key HMAC secret |
| `PRODUCTION_MCP_OAUTH_TOKEN_HMAC_SECRET` | MCP OAuth token HMAC secret |
| `PRODUCTION_A8N_WEBHOOK_SHARED_SECRET` | App webhook secret |
| `PRODUCTION_GOOGLE_FORM_WEBHOOK_SECRET` | Google Forms webhook secret |
| `PRODUCTION_STRIPE_WEBHOOK_SECRET` | Stripe production webhook secret |
| `PRODUCTION_STRIPE_WEBHOOK_SHARED_SECRET` | Stripe shared webhook secret |
| `PRODUCTION_VERCEL_ORG_ID` | Vercel production org id |
| `PRODUCTION_VERCEL_PROJECT_ID` | Vercel production project id |
| `VERCEL_TOKEN` | Token scoped to production deploy |
| `ERROR_TRACKING_DSN` | Error provider DSN if used |
| `OTEL_HEADERS` | OTLP auth headers if used |
| `ALERT_WEBHOOK_URL` | Alert sink webhook if used |

## Production Workflow

`production-deploy.yml` runs only by manual dispatch.

The workflow:

1. Requires `backup_confirmed=true`.
2. Waits for protected production environment approval.
3. Installs dependencies with a frozen lockfile.
4. Runs production-profile env validation.
5. Runs observability readiness.
6. Runs security release check.
7. Runs feature flag readiness check.
8. Runs incident readiness.
9. Runs restore drill readiness.
10. Runs performance readiness.
11. Runs governance readiness.
12. Runs environment drift detection.
13. Validates Prisma schema.
14. Runs migration preflight.
15. Applies production migrations if enabled.
16. Runs migration status against production.
17. Builds the app.
18. Deploys to the production Vercel project.
19. Runs production smoke against the production URL.
20. Generates release manifest.
21. Uploads release evidence.

## Required Pre-Production Gates

Before running production deploy:

- Staging deploy passed.
- Staging smoke passed.
- Migration status passed in staging.
- API release gate passed in staging or release CI.
- API E2E smoke passed in staging or release CI.
- MCP release gate passed if MCP changed.
- Security release check passed.
- Feature flag readiness check passed.
- Incident readiness passed.
- Restore drill readiness passed.
- Performance readiness passed.
- Governance readiness passed.
- Environment drift check passed.
- Backup/PITR/restore point is available.
- Rollback target is known.

## Production Smoke

Run manually when needed:

```powershell
pnpm smoke:prod -- --base-url https://your-production-url.example.com
```

JSON evidence:

```powershell
pnpm smoke:prod -- --base-url https://your-production-url.example.com --json
```

The smoke check verifies:

- App shell does not return 5xx.
- Anonymous tRPC protected route returns controlled auth behavior.
- Anonymous MCP route returns controlled auth/protocol behavior.
- Responses do not leak obvious internal exceptions or secret names.

## Release Manifest

Generate manually when needed:

```powershell
pnpm release:manifest -- --environment production --version v1.4.0 --rollback-target v1.3.9 --deployment-url https://your-production-url.example.com --security-status checked --feature-flag-status checked --incident-status checked --restore-drill-status checked --performance-status checked --governance-status checked --environment-drift-status checked
```

Manifests are written to:

```text
docs/releases/YYYY-MM-DD/production/release-manifest.json
docs/releases/YYYY-MM-DD/production/release-manifest.md
```

## Rollback Rules

Rollback order:

1. Turn off feature flag or kill switch.
2. Roll back the app deployment in Vercel.
3. Roll forward with a corrective database migration if schema/data changed.
4. Restore database only for confirmed corruption or unrecoverable data loss.

Do not run `prisma migrate reset` in production.

## Stop-Ship Conditions

Stop or roll back production deploy if:

- Env validation fails.
- Migration preflight finds destructive unapproved SQL.
- Migration status fails.
- Build fails.
- Security release check fails.
- Feature flag readiness check fails.
- Incident readiness fails.
- Restore drill readiness fails.
- Performance readiness fails.
- Governance readiness fails.
- Environment drift check fails.
- Production smoke fails.
- Production 5xx, latency, workflow, webhook, MCP, or database alerts fire during rollout.
- Sensitive data appears in logs or responses.

## Evidence

Production workflow uploads:

- `docs/releases`
- `docs/api/evidence/migrations`
- `docs/api/evidence/smoke/production`
- `docs/api/evidence/observability`
- `docs/api/evidence/security`
- `docs/api/evidence/feature-flags`
- `docs/api/evidence/incidents`
- `docs/api/evidence/disaster-recovery`
- `docs/api/evidence/performance`
- `docs/api/evidence/governance`
- `docs/api/evidence/environment-drift`
- Vercel deployment URL artifact

Keep this evidence with the release notes.
