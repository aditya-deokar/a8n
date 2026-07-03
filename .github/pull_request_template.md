## Summary

Describe what changed and why.

## Risk Level

- [ ] Low: docs, tests, or isolated code
- [ ] Medium: user-visible behavior, API behavior, or database reads/writes
- [ ] High: auth, billing, credentials, webhooks, MCP, workflow execution, database schema, CI/CD, or production config

## DevOps Checklist

- [ ] I reviewed the affected environment variables and updated `.env.example` if needed.
- [ ] I considered whether this needs a feature flag or kill switch.
- [ ] I considered rollback behavior for this change.
- [ ] I updated docs/runbooks if this changes production operation.

## Test Evidence

- [ ] `pnpm env:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:api`
- [ ] `pnpm api:release:gate -- --strict --json`
- [ ] `pnpm api:e2e:release:gate -- --smoke --json`
- [ ] Not applicable, reason:

## Database

- [ ] No database change.
- [ ] Migration added and reviewed.
- [ ] Expand-contract safety considered.
- [ ] Rollback or roll-forward plan documented.

## Security

- [ ] No secrets, tokens, credentials, or private data added to code/logs/docs.
- [ ] Authz/authn paths reviewed if affected.
- [ ] Webhook signature/shared-secret behavior reviewed if affected.
- [ ] Dependency changes reviewed if `package.json` or `pnpm-lock.yaml` changed.

## Release Notes

User-visible or operator-visible notes:

- 
