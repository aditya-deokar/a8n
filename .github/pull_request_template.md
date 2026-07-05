## Summary

Describe what changed and why.

## Risk Level

- [ ] Low: docs, tests, or isolated code
- [ ] Medium: user-visible behavior, API behavior, or database reads/writes
- [ ] High: auth, billing, credentials, webhooks, MCP, workflow execution, database schema, CI/CD, or production config

## DevOps Checklist

- [ ] I reviewed the affected environment variables and updated `.env.example` if needed.
- [ ] I considered whether this needs a feature flag or kill switch.
- [ ] I considered canary rollout, A/B testing, or audit requirements for this change.
- [ ] I considered rollback behavior for this change.
- [ ] I considered incident response, restore, performance, and cost impact for this change.
- [ ] I considered governance, environment drift, and access/secret review impact for this change.
- [ ] I checked the preview environment impact for this change.
- [ ] I considered observability, alerts, and release evidence for this change.
- [ ] I updated docs/runbooks if this changes production operation.

## Test Evidence

- [ ] `pnpm env:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:api`
- [ ] `pnpm db:migration:preflight`
- [ ] `pnpm api:release:gate -- --strict --json`
- [ ] `pnpm api:e2e:release:gate -- --smoke --json`
- [ ] `pnpm observability:check`
- [ ] `pnpm security:release:check`
- [ ] `pnpm feature-flags:check`
- [ ] `pnpm incident:check`
- [ ] `pnpm restore:drill:check`
- [ ] `pnpm performance:check`
- [ ] `pnpm governance:check`
- [ ] `pnpm environment:drift:check`
- [ ] Preview smoke passed, if a preview URL was created.
- [ ] Not applicable, reason:

## Database

- [ ] No database change.
- [ ] Migration added and reviewed.
- [ ] Migration preflight passed or CI evidence is attached.
- [ ] Staging/preview migration status considered for non-trivial changes.
- [ ] Expand-contract safety considered.
- [ ] Rollback or roll-forward plan documented.

## Security

- [ ] No secrets, tokens, credentials, or private data added to code/logs/docs.
- [ ] Authz/authn paths reviewed if affected.
- [ ] Webhook signature/shared-secret behavior reviewed if affected.
- [ ] Dependency changes reviewed if `package.json` or `pnpm-lock.yaml` changed.
- [ ] Feature flag, experiment, or kill switch changes are documented and auditable.

## Performance And Operations

- [ ] Performance budgets are unchanged, or budget changes are documented.
- [ ] Load, webhook burst, workflow execution, database, and cost impact were considered.
- [ ] Incident, rollback, restore, or postmortem docs were updated if operational behavior changed.

## Release Notes

User-visible or operator-visible notes:

- 
