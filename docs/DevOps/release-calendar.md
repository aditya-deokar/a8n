# Release Calendar

The release calendar makes production change timing explicit. It reduces surprise deploys, protects freeze windows, and makes hotfix exceptions auditable.

## Normal Release Windows

| Window | Owner | Rule |
|---|---|---|
| Weekly minor release | Platform owner | Use staging first, then protected production deploy |
| Patch release | Release owner | Allowed when gates pass and rollback target is known |
| Major migration release | Platform owner and database reviewer | Requires staging rehearsal and backup confirmation |

## Freeze Windows

Freeze windows block normal production releases. Hotfixes can proceed with explicit approval.

| Freeze | Dates | Owner | Notes |
|---|---|---|---|
| Exam/demo freeze | TBD | Platform owner | Avoid risky production changes during project demonstrations |
| Incident freeze | During active SEV1/SEV2 | Incident commander | Only hotfixes and rollback allowed |
| Error budget freeze | When budget is exhausted | Platform owner | See `error-budget-policy.md` |

## Hotfix Rules

Hotfixes are allowed during a freeze when they fix:

- Security exposure.
- Production outage.
- Data corruption.
- Broken auth, billing, workflow execution, webhooks, or MCP behavior.

Hotfix requirements:

- Owner approval.
- Minimal change scope.
- Rollback target.
- Production smoke.
- Release evidence.
- Post-release operational review entry.

## Release Record

| Version | Target Date | Owner | Risk | Status | Notes |
|---|---|---|---|---|---|
|  |  |  |  | Planned |  |

