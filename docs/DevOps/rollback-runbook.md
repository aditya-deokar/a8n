# Rollback Runbook

Use this runbook when a release causes production instability, unsafe behavior, or user-visible regression.

## Rollback Principles

- Prefer the smallest reversible mitigation first.
- Keep users and data safe.
- Avoid database restore unless data is corrupted or unrecoverable.
- Record every action in the incident timeline.
- Validate recovery before declaring resolution.

## Rollback Order

1. Disable feature flag, rollout, experiment, or canary.
2. Enable a targeted kill switch.
3. Roll back the app deployment.
4. Roll forward with a corrective code or database migration.
5. Restore database from backup only as a last resort for confirmed unrecoverable corruption.

## Feature Flag And Kill Switch Rollback

Use when the issue is isolated to a controlled path.

| Problem | Action |
|---|---|
| Bad feature rollout | Set rollout percentage to `0` or set `FEATURE_FLAG_OVERRIDES=<flag>=false` |
| Workflow execution unsafe | Set `KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION=true` |
| Webhook processing unsafe | Set `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING=true` |
| MCP write/admin/side-effect tools unsafe | Set `KILL_SWITCH_DISABLE_MCP_MUTATIONS=true` |
| Experiment causing regression | Force control variant, then remove exposure |

Validation:

```powershell
pnpm feature-flags:check -- --strict --json
pnpm smoke:prod -- --base-url https://your-production-url.example.com --json
```

## Deployment Rollback

Use when the deployed app version is broadly bad and database compatibility allows rollback.

Checklist:

- [ ] Confirm rollback target.
- [ ] Confirm current database schema is compatible with rollback target.
- [ ] Confirm no irreversible data migration is required.
- [ ] Roll back in hosting provider.
- [ ] Run production smoke.
- [ ] Watch dashboards for 30-60 minutes.
- [ ] Record deployment URL and commit in incident timeline.

## Database Roll Forward Or Restore

Use roll-forward when a migration has already changed production data or schema.

Use restore only when:

- Data corruption is confirmed.
- Roll-forward repair is unsafe or impossible.
- Production owner approves.
- Backup/PITR restore point is confirmed.
- Restore rehearsal has been run against staging or disposable database.

Database restore runbook:

```text
docs/DevOps/database-restore-runbook.md
```

## Validation

After rollback:

- [ ] App shell loads.
- [ ] Auth works.
- [ ] tRPC protected routes return controlled auth behavior.
- [ ] Workflow create/save/execute works when not intentionally disabled.
- [ ] Webhooks validate and process valid traffic when not intentionally disabled.
- [ ] MCP read path works.
- [ ] Error rate and latency are normal.
- [ ] Database dashboards are normal.
- [ ] Billing paths work if affected.

## Evidence

Attach:

- Incident issue.
- Production smoke evidence.
- Release manifest.
- Rollback target.
- Dashboard screenshots or links.
- Any feature flag audit entries.

Rollback is not complete until validation passes or the incident commander explicitly accepts residual risk.
