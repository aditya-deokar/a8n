# Postmortem Template

Use this for SEV1, SEV2, repeated SEV3, data exposure, credential exposure, billing correctness, and production restore incidents.

## Incident Summary

Incident title:

Incident date:

Severity:

Status:

Incident commander:

Technical lead:

Postmortem owner:

Related incident issue:

Related release/commit:

## Impact

Customer impact:

Duration:

Affected systems:

Affected users or percentage:

Data exposure or data loss:

Revenue or billing impact:

## Timeline

| Time | Event | Source |
|---|---|---|
|  |  |  |

## Root Cause

What happened:

Why it happened:

Why existing controls did not catch it:

Contributing factors:

## Detection

How was it detected:

Was alerting timely:

What signal was missing:

## Response

What went well:

What slowed response:

Were runbooks useful:

Was rollback or kill switch used:

## Recovery Validation

Checks run:

- [ ] Smoke checks
- [ ] Observability checks
- [ ] Data integrity checks
- [ ] Affected user journey validation
- [ ] Provider status validation

Evidence links:

## Action Items

| Priority | Action item | Owner | Due date | Tracking link |
|---|---|---|---|---|
| P0 |  |  |  |  |

## Follow-Up

Owner for tracking action items:

Review date:

Docs/runbooks updated:

Tests or monitors added:
