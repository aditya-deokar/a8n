# Secrets Rotation Runbook

Use this runbook when a secret is scheduled for rotation or may have been exposed.

## Secret Classes

| Class | Examples | Rotation Risk |
|---|---|---|
| App auth | `BETTER_AUTH_SECRET` | Existing sessions may be invalidated |
| Encryption | `ENCRYPTION_KEY` | Existing encrypted credentials may become unreadable |
| Database | `DATABASE_URL` | App loses DB access if rotated incorrectly |
| Billing | `POLAR_ACCESS_TOKEN` | Checkout/portal/subscription sync can fail |
| MCP | `MCP_API_KEY_HMAC_SECRET`, `MCP_OAUTH_TOKEN_HMAC_SECRET` | API keys/tokens may need compatibility handling |
| Webhooks | `STRIPE_WEBHOOK_SECRET`, shared webhook secrets | Incoming webhooks may fail validation |
| OAuth | GitHub/Google client secrets | OAuth login may fail |

## Planned Rotation Steps

1. Identify all environments that use the secret.
2. Check whether the secret supports dual-read or overlapping validity.
3. Add the new secret to staging.
4. Run `pnpm env:check -- --profile production` with staging-equivalent values.
5. Run staging smoke and release gates.
6. Add the new secret to production.
7. Deploy or restart if the platform requires it.
8. Run production smoke checks.
9. Revoke the old secret.
10. Record the rotation date and owner.

## Emergency Rotation Steps

1. Treat the incident as at least P1 until impact is known.
2. Stop or disable affected access if possible.
3. Rotate the secret in production first.
4. Redeploy/restart the app if required.
5. Rotate staging, preview, CI, and local references.
6. Search logs and audit records for misuse.
7. Invalidate affected sessions/tokens/API keys when needed.
8. Write a postmortem and action items.

## Special Case: `ENCRYPTION_KEY`

Do not rotate `ENCRYPTION_KEY` like a normal secret unless a migration plan exists.

Safe rotation requires:

- Add new key while keeping old key readable.
- Re-encrypt stored credentials from old key to new key.
- Verify every credential can decrypt with the new key.
- Remove old key only after verification.

## Verification

After rotation:

- [ ] `pnpm env:check` passes locally or in CI profile.
- [ ] Production deployment can boot.
- [ ] Login works.
- [ ] Workflow execution works.
- [ ] Credential decrypt/encrypt path works.
- [ ] Webhook validation works if webhook secrets changed.
- [ ] MCP auth works if MCP secrets changed.
