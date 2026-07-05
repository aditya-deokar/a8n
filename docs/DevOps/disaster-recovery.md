# Disaster Recovery

Disaster recovery defines how a8n recovers from major production failure, data corruption, provider outage, or unavailable infrastructure.

## Goals

- Know how much data loss is acceptable.
- Know how quickly the service should recover.
- Verify backups before they are needed.
- Practice restore steps before a real incident.
- Keep recovery evidence.

## RPO And RTO Targets

| System | RPO Target | RTO Target | Notes |
|---|---|---|---|
| Production database | 15 minutes or provider PITR window | 2 hours for restore decision and validated recovery | Final value depends on database provider plan |
| App deployment | No data loss | 30 minutes | Hosting rollback should be fast |
| Webhooks | Provider retry window | 1 hour | Confirm providers retry failed requests |
| Workflow execution | Depends on queued events | 1 hour | Kill switch may intentionally pause execution |
| MCP | No data loss | 1 hour | Read-only mode may remain available during mutation incident |
| Secrets | No data loss | 4 hours for full rotation | Exposure response may require user/session invalidation |

## Critical Assets

- Production database.
- Credential encryption key.
- Better Auth secret and sessions.
- MCP API key and OAuth token HMAC secrets.
- Webhook secrets.
- Billing provider tokens.
- Vercel/GitHub deploy credentials.
- Release manifests and CI evidence.

## Backup Verification

Backup Verification must happen:

- Before risky production migrations.
- Before production restore.
- Quarterly as a restore drill.
- After changing database provider, region, plan, or backup configuration.

Verification checklist:

- [ ] Backup or restore point exists.
- [ ] Restore point timestamp is visible.
- [ ] PITR retention is known.
- [ ] Restore target can be created without touching production.
- [ ] Required credentials are available to approved operators.
- [ ] Restore duration is recorded.
- [ ] Integrity checks pass on restored target.

## Restore Drill Cadence

Run a restore drill quarterly, and after major database topology changes.

Use:

```powershell
pnpm restore:drill:check -- --strict --json
```

The GitHub workflow `.github/workflows/restore-drill.yml` records readiness evidence. Real provider restore steps remain manual/provider-specific until infrastructure automation is added.

## Recovery Playbooks

| Scenario | Runbook |
|---|---|
| Bad release | `docs/DevOps/rollback-runbook.md` |
| Database corruption | `docs/DevOps/database-restore-runbook.md` |
| Secret exposure | `docs/DevOps/secret-leak-runbook.md` |
| Major outage | `docs/DevOps/incident-response-runbook.md` |

## Evidence

DR and restore readiness evidence is written to:

```text
docs/api/evidence/disaster-recovery/YYYY-MM-DD/restore-drill-check.json
```

Keep restore drill evidence with operational review notes and release records.

## Stop Conditions

Stop restore activity and escalate if:

- Restore target cannot be isolated from production.
- Restore point timestamp is uncertain.
- Data loss window is not understood.
- Required approver is unavailable.
- Validation shows inconsistent data.
- Provider restore behavior differs from the documented process.
