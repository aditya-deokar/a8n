# Database Restore Runbook

Use this runbook only for confirmed data corruption, unrecoverable data loss, or a restore drill. Prefer roll-forward fixes when possible.

## Restore Safety Rules

- Never run destructive restore actions without production owner approval.
- Never restore production directly before rehearsing on staging or a disposable database when time allows.
- Preserve forensic evidence before modifying data.
- Confirm RPO and RTO impact before restore.
- Communicate expected downtime or data loss.

## Restore Types

| Type | Use When | Risk |
|---|---|---|
| Point-in-time recovery | Need to recover to a timestamp before corruption | Loses writes after restore point unless replayed |
| Backup snapshot restore | Need known backup version | May lose more data than PITR |
| Table-level repair | Corruption is isolated | Requires careful SQL and validation |
| Roll-forward correction | Bad migration or data bug can be corrected safely | Usually safest when schema already changed |

## Production Approval

Before production restore:

- [ ] Incident issue exists.
- [ ] Incident commander assigned.
- [ ] Database owner approves.
- [ ] Production owner approves.
- [ ] Restore point timestamp selected.
- [ ] Expected data loss window documented.
- [ ] Staging/disposable restore rehearsal completed or explicitly waived.
- [ ] Rollback/roll-forward alternatives considered.

## Restore Drill Procedure

1. Select a non-production restore target.
2. Restore latest backup or PITR snapshot to staging/disposable database.
3. Run Prisma validation and migration status.
4. Run data integrity smoke checks.
5. Run backend smoke or E2E smoke against restored target when possible.
6. Record restore duration.
7. Record RPO/RTO findings.
8. Document issues and follow-up actions.

## Production Restore Procedure

1. Freeze writes if corruption is ongoing.
2. Enable relevant kill switches.
3. Capture current state and logs.
4. Confirm restore point.
5. Restore to a separate database when possible.
6. Validate integrity.
7. Switch app connection only after validation.
8. Run production smoke.
9. Monitor dashboards.
10. Communicate resolution and data loss window.

## Integrity Checks

- [ ] Prisma schema validates.
- [ ] Migration status is understood.
- [ ] Users table exists and expected records are present.
- [ ] Workflow records exist.
- [ ] Credential records exist but raw secret values are not exposed.
- [ ] Recent writes after restore point are identified.
- [ ] API, workflow execution, webhook, MCP, and billing paths are validated as applicable.

## Evidence

Restore drill evidence is written to:

```text
docs/api/evidence/disaster-recovery/YYYY-MM-DD/restore-drill-check.json
```

Attach provider restore logs, restore duration, validation commands, smoke results, and incident links.
