# Platform Governance Runbook

This runbook keeps DevOps healthy after the first implementation is complete. It defines review cadence, owners, evidence, and action-item tracking for production operations.

## Governance Cadence

| Activity | Cadence | Owner | Evidence |
|---|---|---|---|
| Operational review | Monthly and after major release | Platform owner | Completed `operational-review-template.md` |
| Error budget review | Monthly and before risky release | Platform owner | Operational review action items |
| Access review | Quarterly | Security owner | Completed `access-review-template.md` |
| Secret rotation review | Quarterly and after leak | Security owner | `secrets-rotation-runbook.md` evidence |
| Restore drill | Quarterly | Platform owner | `docs/api/evidence/disaster-recovery` |
| Threat model refresh | Quarterly and after architecture change | Security owner | Updated `threat-model.md` |
| Environment drift review | Before staging and production release | Platform owner | `docs/api/evidence/environment-drift` |

## Operational Review

Use `docs/DevOps/operational-review-template.md`.

Required topics:

- Availability and SLO status.
- Error budget burn and release risk.
- Incident, rollback, and postmortem action items.
- Database, workflow, webhook, MCP, auth, billing, and provider health.
- Performance, cost, and slow-query trends.
- Upcoming release calendar and freeze windows.

Every operational review must produce one of:

- No action needed.
- Tracked action items with owner, target date, severity, and evidence link.
- Explicit production risk acceptance by the owner.

## Quarterly Access Review

Use `docs/DevOps/access-review-template.md`.

Review at minimum:

- GitHub organization, repo, environment, and Actions access.
- Vercel project access.
- Database provider console access.
- Inngest, Polar, OAuth providers, observability providers, and webhook provider access.
- Emergency break-glass accounts.

Apply least privilege. Remove stale users, rotate shared credentials, and prefer named accounts with audit logs.

## Secret Rotation

Use `docs/DevOps/secrets-rotation-runbook.md`.

Quarterly review must answer:

- Which secrets rotated this quarter?
- Which secrets intentionally did not rotate and why?
- Are any secrets shared across staging and production?
- Did any provider require webhook or OAuth callback changes?

Emergency rotation always overrides normal cadence.

## Threat Model Refresh

Use `docs/DevOps/threat-model.md`.

Refresh when:

- Auth, OAuth, MCP, billing, workflow execution, credential storage, or webhook behavior changes.
- New external providers are added.
- A security incident or near miss happens.
- Quarterly governance review is due.

## Release Calendar Governance

Use `docs/DevOps/release-calendar.md` to track normal release windows, freeze windows, and hotfix exceptions.

Production releases should not happen during a freeze unless the change is an approved hotfix or risk reduction.

## Evidence

Governance checks write machine-readable evidence to:

```text
docs/api/evidence/governance/YYYY-MM-DD/governance-readiness-check.json
docs/api/evidence/environment-drift/YYYY-MM-DD/environment-drift-check.json
```

Attach this evidence to staging and production release artifacts.

