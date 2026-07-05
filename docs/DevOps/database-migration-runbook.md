# Database Migration Safety Runbook

This runbook defines how schema and data migrations should move from local development to production for this project.

## Goals

- Keep Prisma migrations committed, reviewed, and auditable.
- Catch destructive schema changes before they reach staging or production.
- Verify the target database migration state before release.
- Make rollback and roll-forward decisions explicit.
- Protect production data with backups or restore points before risky changes.

## Required Commands

Run these before merging a database change:

```powershell
pnpm exec prisma validate
pnpm db:migration:preflight
pnpm typecheck
pnpm test:api:db
pnpm api:release:gate -- --strict --db --json
```

Run this when a disposable local, CI, preview, or staging database is available:

```powershell
pnpm exec prisma migrate deploy
pnpm db:migration:preflight -- --db
```

Use strict mode for newly changed migrations when Git can compare the branch:

```powershell
pnpm db:migration:preflight -- --changed-only --strict
```

## What The Preflight Checks

`scripts/migration-preflight.ts` scans committed SQL migrations and writes evidence to:

```text
docs/api/evidence/migrations/YYYY-MM-DD/migration-preflight.json
```

The default gate fails on stop-ship migration risks:

| Risk | Why It Blocks |
|---|---|
| `DROP TABLE` | Can permanently remove production data |
| `DROP COLUMN` | Can break old app versions and remove data |
| `TRUNCATE` | Deletes table data without row-level control |
| `DELETE FROM` without inline `WHERE` | Can remove broad production data |
| `UPDATE` without inline `WHERE` | Can rewrite broad production data |
| Failed `prisma migrate status` with `--db` | Indicates drift, unapplied migrations, or database access failure |

The gate warns on changes that need review:

| Warning | Required Review |
|---|---|
| Prisma generated warning comments | Explain why current data makes the migration safe |
| Required column without default | Use expand-contract unless table is proven empty |
| `SET NOT NULL` | Verify backfill completed before constraint |
| Unique index | Verify duplicate data cannot exist |
| Non-concurrent index | Check locking impact for large tables |
| Enum value changes | Confirm old and new app versions tolerate the enum |
| Rename table or column | Prefer add-copy-switch-drop rollout |
| Drop constraint | Explain how integrity is preserved |

## Migration Classes

| Class | Example | Required Path |
|---|---|---|
| Safe additive | New nullable column, new table, new optional index | Normal PR plus preflight |
| Compatibility-sensitive | New enum value, new required field, unique index | PR notes, staging rehearsal, release checklist |
| Risky destructive | Drop column/table, truncate, broad data rewrite | Expand-contract plan, backup, approval, staged contract migration |
| Data backfill | Populate new column from existing data | Batch strategy, idempotency, staging timing, rollback or roll-forward plan |

## Expand-Contract Pattern

Use expand-contract whenever old and new app versions may run during the same rollout.

1. Expand: add nullable column/table/index without breaking old code.
2. Deploy compatible app code that can read/write both old and new shapes.
3. Backfill data in a bounded, observable way.
4. Switch reads to the new shape after verification.
5. Contract: remove old code and old schema in a later release.

This avoids downtime and keeps rollback possible after the first deploy.

## Pull Request Requirements

Every database PR must include:

- Migration file under `prisma/migrations`.
- Output or CI evidence from `pnpm db:migration:preflight`.
- Whether the change is additive, compatibility-sensitive, risky destructive, or data backfill.
- Staging or preview migration result for non-trivial migrations.
- Backup or restore-point requirement before production.
- Rollback or roll-forward plan.

## CI And Release Gate Flow

| Stage | Check |
|---|---|
| Static PR checks | `pnpm db:migration:preflight -- --json` |
| DB-backed CI | `pnpm exec prisma migrate deploy`, then `pnpm db:migration:preflight -- --db --json` |
| API release gate | Includes database migration preflight evidence |
| Nightly | Repeats migration deploy/status against CI database |
| Backend release | Runs migration preflight before backend tests/build |

## Production Release Procedure

Before production migration:

1. Confirm release gates passed.
2. Confirm staging migration passed against staging data.
3. Confirm production backup, PITR, or restore point is available.
4. Confirm the app version is compatible with the pre-migration and post-migration schema.
5. Confirm rollback or roll-forward path is documented.
6. Run production migration through the approved deploy workflow.
7. Run production smoke checks.
8. Monitor API 5xx rate, latency, workflow execution, webhooks, MCP auth, and database errors.

## Rollback Rules

Prefer roll-forward for database issues once production schema or data has changed.

| Situation | Preferred Action |
|---|---|
| App deploy failed before migration | Roll back app deploy |
| Migration not applied | Fix deploy and retry after status check |
| Migration applied, app fails due code bug | Roll back app only if old app is schema-compatible |
| Migration applied, data shape wrong | Roll forward with corrective migration |
| Data deleted or corrupted | Stop writes, restore from backup or PITR, then reconcile |

Do not assume `prisma migrate reset` is acceptable outside disposable local or CI databases. It is destructive.

## Backup And Restore Requirements

Production migration requires one of:

- Managed database backup completed recently.
- PITR enabled and restore point known.
- Provider snapshot or branch created before migration.

For risky migrations, rehearse restore in staging or a disposable branch before production.

## Operational Evidence

Attach or preserve:

- Migration preflight JSON.
- `prisma migrate status` output.
- CI workflow run link.
- Staging migration result.
- Production deploy run link.
- Backup or restore-point confirmation.
- Post-deploy smoke result.

## Troubleshooting

| Symptom | Action |
|---|---|
| Preflight fails on destructive SQL | Convert to expand-contract or document and approve a dedicated data operation |
| Preflight warns on required column | Add nullable column first, backfill, then enforce NOT NULL later |
| `migrate status` cannot reach DB | Verify `DATABASE_URL`, network access, and DB service health |
| `migrate deploy` fails in CI | Inspect migration SQL, run against disposable DB, fix by adding a new migration |
| Drift detected | Do not deploy. Compare actual DB schema to committed migrations and repair through an approved migration |
