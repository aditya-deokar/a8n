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
- [ ] `pnpm test:mcp` if MCP code changed.
- [ ] `pnpm api:release:gate -- --strict --db --json`
- [ ] `pnpm api:e2e:release:gate -- --json`
- [ ] `pnpm build`

## 3. Database Safety

- [ ] No database change, or migration file is committed.
- [ ] Migration was reviewed.
- [ ] Migration was tested in CI.
- [ ] Migration was tested in staging before production.
- [ ] Expand-contract pattern considered for destructive changes.
- [ ] Backup or restore point exists before production migration.
- [ ] Roll-forward or rollback plan is documented.

## 4. Environment And Secrets

- [ ] `.env.example` is updated if config changed.
- [ ] `pnpm env:check -- --profile production` passes with production secrets in the deploy environment.
- [ ] Production secrets are not exposed to PR workflows.
- [ ] New secrets are stored in Vercel/GitHub environment secrets.
- [ ] Secret rotation impact is understood.

## 5. Security

- [ ] No real secrets are committed.
- [ ] Auth, billing, credential, MCP, webhook, and database changes received focused review.
- [ ] Dependency changes are reviewed.
- [ ] Logs and errors do not expose tokens, credentials, webhook secrets, or private payloads.
- [ ] Rate-limit or abuse impact was considered for public endpoints.

## 6. Release Evidence

- [ ] Internal API release evidence exists under `docs/api/evidence/release-gates`.
- [ ] API E2E evidence exists under `docs/api/evidence/e2e`.
- [ ] CI artifacts are attached to the workflow run.
- [ ] Release manifest or release notes identify commit SHA and version.

## 7. Production Verification

- [ ] Production deployment completed.
- [ ] Production smoke checks passed.
- [ ] Authentication works.
- [ ] Workflow create/save/execute works.
- [ ] Webhook endpoints respond as expected.
- [ ] MCP endpoint works if changed.
- [ ] Error rate and latency look normal.

## 8. Rollback Decision

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
