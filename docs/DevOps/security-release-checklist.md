# Security Release Checklist

Use this checklist before production release and for high-risk pull requests.

## Required Gates

- [ ] `pnpm security:release:check -- --strict --json`
- [ ] CodeQL passed.
- [ ] Dependency review passed.
- [ ] Secret scan passed.
- [ ] SBOM artifact generated.
- [ ] `pnpm env:check -- --profile production` passed in protected environment.
- [ ] `pnpm observability:check -- --profile production --json` passed.

## Dependency Review

- [ ] No critical vulnerabilities.
- [ ] High vulnerabilities are fixed or waived with owner approval.
- [ ] New packages are necessary and maintained.
- [ ] Package licenses are acceptable.
- [ ] Install scripts are expected and limited.

## Secret Review

- [ ] No real secrets in code, docs, tests, or CI logs.
- [ ] New secrets are added to GitHub/Vercel environment secrets.
- [ ] New secrets are listed in `.env.example`.
- [ ] Rotation and rollback impact is understood.

## Sensitive Surfaces

Extra review is required for:

- Auth and session handling.
- Credential encryption/decryption.
- Billing and subscription gates.
- Webhook verification.
- MCP OAuth, API keys, scopes, and tool execution.
- Prisma migrations and data access boundaries.
- Production deploy workflows.
- Feature flags and kill switches.

## Logging And Privacy

- [ ] Logs do not expose tokens, credentials, webhook payload secrets, OAuth codes, or private data.
- [ ] Error messages are safe in production.
- [ ] Security failures emit enough context for debugging without leaking secrets.

## Release Evidence

- [ ] Security evidence exists under `docs/api/evidence/security`.
- [ ] Release manifest exists under `docs/releases`.
- [ ] SBOM is attached to CI artifacts.
- [ ] Any security waiver is linked in release notes.

## Stop-Ship Conditions

Do not release if:

- A real secret is committed.
- A critical vulnerability is unpatched and unwaived.
- Authz/authn tests fail.
- Webhook signature validation fails.
- MCP scope or tenant isolation checks fail.
- Production deployment requires secrets unavailable to the protected environment.
