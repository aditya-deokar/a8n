# Operational Review Template

Date:
Review owner:
Participants:
Release window covered:

## Summary

- Overall health:
- Main risks:
- Decisions made:

## SLO And Error Budget

| Service Area | SLO | Current Result | Error Budget Burn | Status |
|---|---|---|---|---|
| App/API availability | 99.9 percent monthly |  |  |  |
| API p95 latency | See `performance-budgets.json` |  |  |  |
| Webhook success rate | 99.5 percent monthly |  |  |  |
| Workflow execution success | 99 percent monthly |  |  |  |
| MCP route availability | 99.5 percent monthly |  |  |  |

Release decision:

- [ ] Error budget healthy, normal release allowed.
- [ ] Error budget at risk, release needs owner approval.
- [ ] Error budget exhausted, release freeze applies except hotfixes.

## Incidents And Follow-Ups

| Incident | Severity | Status | Remaining Action Items | Owner |
|---|---|---|---|---|
|  |  |  |  |  |

## Reliability Review

- Auth:
- tRPC/internal API:
- MCP:
- Webhooks:
- Workflow execution:
- Database:
- Billing:
- External providers:

## Performance And Cost Review

- API p95/p99:
- Slow queries:
- Load-test findings:
- Cost trend:
- Budget exceptions:

## Security And Access Review Notes

- New privileged access:
- Removed access:
- Secrets due for rotation:
- Threat model changes:

## Release Calendar

- Upcoming releases:
- Freeze windows:
- Hotfixes:
- Migration-heavy changes:

## Action Items

| Action Item | Owner | Priority | Target Date | Tracking Link |
|---|---|---|---|---|
|  |  |  |  |  |

