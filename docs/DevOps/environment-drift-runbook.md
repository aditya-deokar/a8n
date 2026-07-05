# Environment Drift Runbook

Environment drift happens when local, test, preview, staging, or production configuration no longer matches the repo baseline. Drift is dangerous because the app can pass tests but fail in staging or production.

## Baseline

The baseline lives in:

```text
infra/environment-baseline.json
```

It records:

- Environment purpose.
- Required variables and secrets.
- Expected source: env file, GitHub variable, GitHub secret, or runtime default.
- Whether the value is secret.

## Detection

Run:

```powershell
pnpm environment:drift:check -- --strict --json
```

Evidence is written to:

```text
docs/api/evidence/environment-drift/YYYY-MM-DD/environment-drift-check.json
```

## Staging Drift Response

1. Stop promotion to production.
2. Compare staging GitHub variables and secrets with `infra/environment-baseline.json`.
3. Confirm staging uses staging-only database, Vercel project, OAuth apps, provider tokens, and webhook secrets.
4. Update the environment value or update the baseline through PR review.
5. Rerun staging deploy and smoke checks.

## Production Drift Response

1. Stop production deployment unless this is an approved hotfix.
2. Confirm production variables and secrets match the protected `production` GitHub environment.
3. Check that production does not share staging credentials.
4. Update production config through the hosting/provider console, then document the change in the operational review.
5. If code expectations changed, update `.env.example`, `src/env.ts`, workflows, docs, and `infra/environment-baseline.json` in the same PR.
6. Rerun `pnpm environment:drift:check -- --strict --json`.

## Accepted Drift

Temporary drift must have:

- Owner.
- Reason.
- Expiration date.
- Tracking link.
- Rollback or normalization plan.

## Review Cadence

- Before staging promotion.
- Before production deployment.
- During quarterly governance review.
- After any incident involving configuration, secrets, provider access, or environment mismatch.

