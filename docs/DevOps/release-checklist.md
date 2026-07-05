# Production Release Checklist

Use this checklist before promoting a release to production.

## 1. Code Readiness

- [ ] Pull request is reviewed and approved.
- [ ] CODEOWNERS-required files have owner review.
- [ ] Scope and risk level are clear.
- [ ] Rollback behavior is understood.
- [ ] User-facing or operator-facing changes are documented.

## 2. Required Quality Gates

- [ ] `pnpm env:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:api`
- [ ] `pnpm db:migration:preflight`
- [ ] `pnpm test:mcp` if MCP code changed.
- [ ] `pnpm api:release:gate -- --strict --db --json`
- [ ] `pnpm api:e2e:release:gate -- --json`
- [ ] `pnpm smoke:staging -- --base-url <staging-url>`
- [ ] `pnpm observability:check -- --profile production --json`
- [ ] `pnpm security:release:check -- --strict --json`
- [ ] `pnpm feature-flags:check -- --strict --json`
- [ ] `pnpm incident:check -- --strict --json`
- [ ] `pnpm restore:drill:check -- --strict --json`
- [ ] `pnpm performance:check -- --strict --json`
- [ ] `pnpm governance:check -- --strict --json`
- [ ] `pnpm environment:drift:check -- --strict --json`
- [ ] `pnpm build`

## 3. Database Safety

- [ ] No database change, or migration file is committed.
- [ ] Migration was reviewed.
- [ ] `pnpm db:migration:preflight -- --db` passed against CI, preview, or staging database.
- [ ] Migration was tested in CI.
- [ ] Migration was tested in staging before production.
- [ ] Expand-contract pattern considered for destructive changes.
- [ ] Backup or restore point exists before production migration.
- [ ] Disaster recovery and restore drill readiness evidence exists.
- [ ] Roll-forward or rollback plan is documented.

## 4. Environment And Secrets

- [ ] `.env.example` is updated if config changed.
- [ ] `pnpm env:check -- --profile production` passes with production secrets in the deploy environment.
- [ ] Production secrets are not exposed to PR workflows.
- [ ] New secrets are stored in Vercel/GitHub environment secrets.
- [ ] Secret rotation impact is understood.
- [ ] Observability provider variables are configured for production, or console-only baseline is explicitly accepted.
- [ ] Feature flag and kill switch variables are configured in staging/production GitHub or hosting environment variables.
- [ ] `infra/environment-baseline.json` matches the expected staging and production configuration.
- [ ] Environment drift is absent or explicitly accepted with owner, reason, and expiration date.

## 5. Security

- [ ] No real secrets are committed.
- [ ] Auth, billing, credential, MCP, webhook, and database changes received focused review.
- [ ] Dependency changes are reviewed.
- [ ] Logs and errors do not expose tokens, credentials, webhook secrets, or private payloads.
- [ ] Rate-limit or abuse impact was considered for public endpoints.
- [ ] `pnpm security:release:check -- --strict --json` passed.
- [ ] CodeQL, dependency review, and secret scan passed.
- [ ] SBOM artifact is attached for production release.

## 6. Rollout Controls

- [ ] New risky behavior has a feature flag or documented reason it does not need one.
- [ ] Kill switch behavior exists for workflow execution, webhook processing, or MCP mutation risk when applicable.
- [ ] Rollout starts at `0` or a small canary percentage.
- [ ] Canary guardrails are defined: API 5xx, latency, workflow failures, webhook failures, MCP errors, support signals.
- [ ] Production flag or kill switch changes will be recorded in `docs/DevOps/feature-flag-audit-log.md`.

## 7. Incident, DR, Performance, And Cost

- [ ] Incident response runbook and rollback runbook are current for this release.
- [ ] `pnpm incident:check -- --strict --json` passed.
- [ ] `pnpm restore:drill:check -- --strict --json` passed.
- [ ] Backup/PITR/restore point status is known.
- [ ] Restore is not needed, or database restore approval path is documented.
- [ ] `pnpm performance:check -- --strict --json` passed.
- [ ] API, webhook, workflow execution, frontend, and cost budgets were reviewed.
- [ ] Slow query review was completed for database-heavy changes.
- [ ] Load tests were run in staging for major traffic, webhook, workflow, or provider changes.

## 8. Governance And Platform Review

- [ ] `pnpm governance:check -- --strict --json` passed.
- [ ] `pnpm environment:drift:check -- --strict --json` passed.
- [ ] Release is inside the release calendar or approved as a hotfix.
- [ ] Error budget status allows this release, or owner approval is recorded.
- [ ] Access, secret rotation, restore drill, and threat model reviews are current for the quarter.

## 9. Release Evidence

- [ ] Internal API release evidence exists under `docs/api/evidence/release-gates`.
- [ ] API E2E evidence exists under `docs/api/evidence/e2e`.
- [ ] Migration preflight evidence exists under `docs/api/evidence/migrations`.
- [ ] Preview or staging smoke evidence exists under `docs/api/evidence/smoke`.
- [ ] Observability evidence exists under `docs/api/evidence/observability`.
- [ ] Security evidence exists under `docs/api/evidence/security`.
- [ ] Feature flag evidence exists under `docs/api/evidence/feature-flags`.
- [ ] Incident readiness evidence exists under `docs/api/evidence/incidents`.
- [ ] Disaster recovery evidence exists under `docs/api/evidence/disaster-recovery`.
- [ ] Performance evidence exists under `docs/api/evidence/performance`.
- [ ] Governance evidence exists under `docs/api/evidence/governance`.
- [ ] Environment drift evidence exists under `docs/api/evidence/environment-drift`.
- [ ] Production release manifest will be generated under `docs/releases`.
- [ ] CI artifacts are attached to the workflow run.
- [ ] Release manifest or release notes identify commit SHA and version.

## 10. Preview And Staging Verification

- [ ] Preview URL was reviewed for app-affecting PRs.
- [ ] Preview smoke passed for PR-hosted review when available.
- [ ] Staging deployment completed.
- [ ] Staging environment uses staging-only secrets and sandbox providers.
- [ ] Staging smoke passed.
- [ ] Staging release evidence is attached before production promotion.

## 11. Production Verification

- [ ] Production GitHub environment approval completed.
- [ ] Backup/PITR/restore point was confirmed in the workflow input.
- [ ] Rollback target was provided in the workflow input.
- [ ] Production deployment completed.
- [ ] Production smoke checks passed.
- [ ] Release manifest was generated.
- [ ] Authentication works.
- [ ] Workflow create/save/execute works.
- [ ] Webhook endpoints respond as expected.
- [ ] MCP endpoint works if changed.
- [ ] Error rate and latency look normal.
- [ ] API, database, workflow, webhook, MCP, and billing dashboards look normal.
- [ ] Security, feature flag, incident, DR, performance, governance, and environment drift evidence are linked from the workflow artifacts.

## 12. Rollback Decision

Rollback immediately if:

- Login is broadly broken.
- Database migration caused write/read failures.
- Workflow execution is globally broken.
- API 5xx rate rises above the release threshold.
- Webhooks cannot validate or process valid traffic.
- Sensitive data is exposed in logs, responses, or UI.

Preferred rollback order:

1. Turn off feature flag or kill switch.
2. Roll back app deployment.
3. Roll forward database fix if migration already changed production data.
4. Restore from backup only for confirmed corruption or unrecoverable data loss.
