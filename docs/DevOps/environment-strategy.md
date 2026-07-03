# Environment Strategy

This project should use separate environments so production secrets, production data, and user traffic are protected from development and testing work.

## Environment Matrix

| Environment | Purpose | Data | Secrets | Deployment |
|---|---|---|---|---|
| Local | Individual development | Local/dev database | Local `.env` only | Manual `pnpm dev` |
| Test/CI | Automated verification | Disposable Postgres service | Test-only GitHub env values | GitHub Actions |
| Preview | Pull request review | Isolated preview DB branch or safe shared preview DB | Preview-only values | Vercel preview |
| Staging | Production-like rehearsal | Staging DB | Staging service accounts | Merge to main/release |
| Production | Real users | Production DB | Production secrets | Approved release |

## Rules

- Never use production secrets outside production.
- Never point tests or preview deployments at the production database.
- Keep test and E2E external services mocked unless a workflow explicitly performs a live staging check.
- Preview and staging OAuth, billing, webhook, and Inngest apps must be separate from production.
- Production deploys require release gates and approval.
- Production environment variables should pass `pnpm env:check -- --profile production`.

## Required Variables By Environment

| Variable | Local | CI/Test | Preview | Staging | Production |
|---|---|---|---|---|---|
| `DATABASE_URL` | Dev DB | Test DB | Preview DB | Staging DB | Production DB |
| `BETTER_AUTH_SECRET` | Local secret | Test secret | Preview secret | Staging secret | Production secret |
| `BETTER_AUTH_URL` | Local URL | Test URL | Preview URL | Staging URL | Production URL |
| `NEXT_PUBLIC_APP_URL` | Local URL | Test URL | Preview URL | Staging URL | Production URL |
| `ENCRYPTION_KEY` | Local key | Test key | Preview key | Staging key | Production key |
| `POLAR_ACCESS_TOKEN` | Sandbox token | Test token | Sandbox token | Sandbox token | Production token |
| `POLAR_SUCCESS_URL` | Local URL | Test URL | Preview URL | Staging URL | Production URL |
| `MCP_API_KEY_HMAC_SECRET` | Local secret | Test secret | Preview secret | Staging secret | Production secret |
| `MCP_OAUTH_TOKEN_HMAC_SECRET` | Local secret | Test secret | Preview secret | Staging secret | Production secret |
| Webhook secrets | Local/test | Test | Preview | Staging | Production |

## CI Safety Defaults

CI should use:

```env
NODE_ENV=test
A8N_ENV_PROFILE=test
E2E_TESTS=true
E2E_EXTERNAL_SERVICES=mock
DATABASE_URL=postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test
```

These settings prevent accidental calls to production systems and keep backend E2E deterministic.

## Production Safety Defaults

Production should use:

```env
NODE_ENV=production
A8N_ENV_PROFILE=production
MCP_RATE_LIMIT_BACKEND=database
MCP_CORS_ORIGINS=https://your-production-domain.com
MCP_SAFE_FETCH_ALLOWLIST_MODE=true
```

Production values must use HTTPS public URLs and real provider secrets.
