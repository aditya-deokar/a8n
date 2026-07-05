# Incident Response Runbook

Use this runbook when production behavior is degraded, unavailable, unsafe, or exposing private data.

## Goals

- Protect users and data first.
- Restore service quickly.
- Communicate clearly.
- Preserve enough evidence to understand what happened.
- Create follow-up work that prevents recurrence.

## Severity Matrix

| Severity | User Impact | Examples | Target Response |
|---|---|---|---|
| SEV1 | Broad production outage, data exposure, or unsafe external side effects | Login down, workflows globally failing, credential leak, production DB corruption | Immediate response, incident commander assigned, updates every 15 minutes |
| SEV2 | Major feature broken or high error rate for important traffic | Webhooks failing, MCP writes unsafe, billing broken, elevated API 5xx | Response within 30 minutes, updates every 30 minutes |
| SEV3 | Partial degradation with workaround | Slow API, isolated provider issue, staging-only release blocker | Same business day response |
| SEV4 | Low-risk operational issue | Documentation gap, alert tuning, non-urgent maintenance | Normal backlog |

## Roles

| Role | Responsibility |
|---|---|
| Incident commander | Owns coordination, decisions, timeline, and handoff |
| Technical lead | Leads diagnosis and remediation |
| Communications owner | Writes stakeholder/user updates |
| Scribe | Captures timeline, actions, links, and evidence |
| Reviewer | Confirms mitigation and recovery validation |

One person can hold multiple roles in a small team, but the incident commander should be explicit.

## Incident Lifecycle

1. Detect or receive report.
2. Open an incident issue using `.github/ISSUE_TEMPLATE/incident.md`.
3. Assign severity and incident commander.
4. Stop unsafe behavior with feature flags or kill switches if needed.
5. Triage scope: API, database, workflow execution, webhooks, MCP, billing, auth, provider outage.
6. Mitigate with the safest reversible action.
7. Validate recovery with smoke checks, dashboards, and affected user flow checks.
8. Communicate status and resolution.
9. Create postmortem for SEV1/SEV2 or repeated SEV3 incidents.
10. Track follow-up action items to closure.

## First Response Checklist

- [ ] Incident issue created.
- [ ] Severity assigned.
- [ ] Incident commander assigned.
- [ ] Timeline started.
- [ ] Customer impact described.
- [ ] Current release, commit, and deployment identified.
- [ ] Dashboards checked: API, DB, workflow, webhook, MCP, billing, auth.
- [ ] Rollback target identified.
- [ ] Kill switches considered.
- [ ] Data exposure risk assessed.
- [ ] Communication cadence started.

## Immediate Mitigation Options

| Problem | First Mitigation |
|---|---|
| Bad feature path | Disable feature flag or set rollout to 0 |
| Unsafe workflow execution | `KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION=true` |
| Webhook storm or malformed payload issue | `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING=true` |
| Unsafe MCP writes or prompt-injection risk | `KILL_SWITCH_DISABLE_MCP_MUTATIONS=true` |
| Bad app deploy | Roll back deployment |
| Bad migration/data issue | Stop writes, roll forward fix, restore only for confirmed unrecoverable corruption |
| Secret leak | Follow `docs/DevOps/secret-leak-runbook.md` |

## Communication

For SEV1/SEV2:

- First internal update within 15 minutes.
- Updates every 15-30 minutes until stable.
- Include impact, current status, next action, owner, and next update time.
- Do not speculate about root cause before evidence is available.
- Do not include secrets, tokens, private workflow payloads, or customer data.

## Recovery Validation

Run the relevant checks:

```powershell
pnpm smoke:prod -- --base-url https://your-production-url.example.com --json
pnpm observability:check -- --profile production --json
pnpm incident:check -- --strict --json
pnpm restore:drill:check -- --strict --json
```

Also manually validate the affected user flow.

## Postmortem Rules

Write a postmortem for:

- Any SEV1.
- Any SEV2.
- Repeated SEV3 incidents.
- Any incident involving data exposure, credential exposure, billing correctness, or production restore.

Use `docs/DevOps/incidents/postmortem-template.md`.

## Evidence

Incident readiness evidence is written to:

```text
docs/api/evidence/incidents/YYYY-MM-DD/incident-readiness-check.json
```

Attach incident issue links, release manifests, smoke evidence, logs, dashboards, and postmortem links to the incident issue.
