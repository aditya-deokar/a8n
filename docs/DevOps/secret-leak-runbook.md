# Secret Leak Runbook

Use this runbook when a token, API key, private key, webhook secret, OAuth secret, database URL, or credential may have been exposed.

## Severity

Treat confirmed production secret exposure as SEV1 unless evidence proves the secret is non-production and unused.

## First Response

1. Open an incident issue.
2. Assign incident commander.
3. Identify the exposed secret type and environment.
4. Stop further exposure by removing public logs/artifacts/commits where possible.
5. Revoke or rotate the secret.
6. Audit recent usage.
7. Redeploy services that depend on the rotated secret.
8. Validate affected paths.
9. Notify stakeholders when user or provider risk exists.

## Secret Types

| Secret | Immediate Action |
|---|---|
| `DATABASE_URL` | Rotate database credentials, audit connections, redeploy |
| `BETTER_AUTH_SECRET` | Rotate with session invalidation plan |
| `ENCRYPTION_KEY` | Treat as high-risk; evaluate credential re-encryption and exposure scope |
| MCP HMAC secrets | Rotate and invalidate affected MCP API keys/OAuth tokens |
| OAuth client secrets | Rotate at provider dashboard and redeploy |
| Webhook secrets | Rotate provider secret and app env together |
| Polar token | Revoke in Polar, create new token, audit billing actions |
| Vercel/GitHub tokens | Revoke, rotate, audit deployments and workflow runs |
| AI provider tokens | Revoke, rotate, audit usage and spend |

## Rotation Checklist

- [ ] Secret identified.
- [ ] Environment identified.
- [ ] Owner assigned.
- [ ] Secret revoked or disabled.
- [ ] Replacement created with least privilege.
- [ ] GitHub/Vercel environment secret updated.
- [ ] App redeployed if needed.
- [ ] Old secret no longer works.
- [ ] Logs/artifacts no longer expose the value.
- [ ] Provider audit logs reviewed.
- [ ] Impact communicated.

## Git History

If a real secret was committed:

- Rotate the secret first.
- Do not rely on history rewrite as the only mitigation.
- Remove the secret from current code.
- Consider history rewrite only after rotation and with owner approval.
- Assume forks, CI logs, and local clones may retain the secret.

## Validation

Run:

```powershell
pnpm security:release:check -- --strict --json
pnpm env:check -- --profile production
pnpm smoke:prod -- --base-url https://your-production-url.example.com --json
```

## Notification

Notify when:

- Production secret was exposed.
- Customer data may be affected.
- Provider terms require notification.
- Billing or payment security could be affected.

Do not include the raw secret in notifications, tickets, screenshots, or postmortems.

## Evidence

Attach:

- Incident issue.
- Rotation timestamp.
- Provider audit log links.
- Security evidence.
- Deployment evidence.
- Final validation notes.
