# Preview Environment Runbook

Preview environments let reviewers test a pull request in a hosted app before it reaches `main`.

## Goals

- Give every app-affecting PR a real preview URL.
- Keep preview isolated from production secrets and production data.
- Run migration preflight before preview deployment.
- Smoke the hosted preview after Vercel reports a successful deployment.
- Preserve evidence for review and debugging.

## Implemented Automation

| Artifact | Purpose |
|---|---|
| `.github/workflows/preview.yml` | PR preview readiness and deployment-status smoke workflow |
| `pnpm smoke:preview` | Smoke test a preview URL |
| `scripts/environment-smoke.ts` | Shared preview/staging/production smoke runner |
| `docs/api/evidence/smoke/preview` | Preview smoke evidence |
| `docs/api/evidence/migrations` | Migration preflight evidence |

## Recommended Platform Setup

Use Vercel Git integration for preview deployments.

| Area | Requirement |
|---|---|
| App deploy | Vercel preview deploy on each PR commit |
| Database | Neon branch per PR, or a disposable shared preview database |
| Auth | Preview OAuth apps or disabled external OAuth |
| Billing | Polar sandbox only |
| Webhooks | Sandbox/test webhook endpoints only |
| Inngest | Preview/dev Inngest app only |
| Secrets | Preview-only values, never production values |

## GitHub Workflow Behavior

`preview.yml` has two paths:

| Trigger | Behavior |
|---|---|
| `pull_request` | Runs env check, Prisma validate, migration preflight, and build readiness |
| `deployment_status` | When Vercel reports a successful Preview deployment, runs `pnpm smoke:preview` against the deployment URL |

The smoke job checks:

- App shell responds without 5xx.
- Anonymous tRPC protected route returns a controlled response.
- Anonymous MCP route returns a controlled auth/protocol response.
- Responses do not leak obvious internal exception or secret strings.

## Required Commands

Local preview smoke:

```powershell
pnpm smoke:preview -- --base-url https://your-preview-url.vercel.app
```

JSON evidence mode:

```powershell
pnpm smoke:preview -- --base-url https://your-preview-url.vercel.app --json
```

Migration safety before preview:

```powershell
pnpm db:migration:preflight
```

## Preview Database Strategy

Best option:

1. Create a database branch for each PR.
2. Set the preview deployment `DATABASE_URL` to that branch.
3. Run `prisma migrate deploy` against the preview branch.
4. Destroy the branch when the PR closes.

Acceptable temporary option:

1. Use a shared preview database.
2. Keep it non-production and disposable.
3. Reset or reseed it regularly.
4. Never use production data unless it is sanitized and approved.

## Pull Request Review Checklist

- [ ] Preview URL is available.
- [ ] Preview uses preview/test secrets only.
- [ ] Migration preflight passed.
- [ ] Preview smoke passed.
- [ ] Database change was reviewed if `prisma/**` changed.
- [ ] External service behavior uses sandbox providers.

## Evidence

CI uploads:

- `preview-readiness-evidence`
- `preview-smoke-evidence`

Local/CI evidence is written under:

```text
docs/api/evidence/migrations
docs/api/evidence/smoke/preview
```

## Teardown

When a PR closes:

- Vercel preview deployment can remain as historical artifact.
- Preview database branch should be deleted.
- Any temporary webhook forwarding URL should be removed.
- Any temporary test users or API keys should be revoked.

## Troubleshooting

| Symptom | Action |
|---|---|
| No preview URL appears | Check Vercel Git integration and branch permissions |
| Preview smoke does not run | Confirm Vercel sends GitHub deployment status with environment `Preview` |
| Smoke fails with 5xx | Open preview logs and check env vars, migration status, and build output |
| tRPC/MCP smoke fails with auth status | 401/403 is acceptable; 5xx or secret leak is not |
| Migration preflight fails | Fix destructive migration pattern or document expand-contract plan |
