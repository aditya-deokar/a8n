# DevOps Documentation

This folder contains the production DevOps roadmap, runbooks, readiness checks, workflows, and release evidence conventions.

## Current Status

| Phase | Status | Main Artifacts |
|---|---|---|
| Phase 0: DevOps audit and standards | Implemented | CODEOWNERS, PR template, release checklist |
| Phase 1: Environment and secrets foundation | Implemented | `.env.example`, `src/env.ts`, `pnpm env:check`, environment strategy, secrets rotation runbook |
| Phase 2: CI quality gates | Implemented | CI concurrency, env-check steps, quality gate docs |
| Phase 3: Database migration safety | Implemented | Migration preflight, migration runbook, DB release gate evidence |
| Phase 4: Preview environments | Implemented | Preview readiness workflow, preview smoke, preview runbook |
| Phase 5: Staging environment | Implemented | Protected staging deploy workflow, staging smoke, staging runbook |
| Phase 6: Production delivery pipeline | Implemented | Protected production workflow, release manifest, production smoke |
| Phase 7: Observability and alerting | Implemented | Observability utility, readiness workflow, runbook, alert rules |
| Phase 8: Security and supply chain | Implemented | Security workflow, Dependabot, security release check, SBOM evidence, threat model |
| Phase 9: Feature flags, canary, and A/B testing | Implemented | Flag registry, kill switches, canary env controls, experiment helper, rollout runbooks |
| Phase 10: Incident response, backup, and DR | Implemented | Incident runbook, templates, rollback/restore/secret leak runbooks, restore drill workflow |
| Phase 11: Performance, load, and cost controls | Implemented | Performance budgets, k6 load scripts, performance workflow, cost and slow-query runbooks |
| Phase 12: Platform maturity and governance | Implemented | Infra baseline, governance workflow, drift check, operational/access/error-budget templates |

## Files

| File | Purpose |
|---|---|
| `INDUSTRY_GRADE_DEVOPS_IMPLEMENTATION_PLAN.md` | Full industry-grade DevOps roadmap |
| `release-checklist.md` | Production release checklist |
| `environment-strategy.md` | Dev/test/preview/staging/prod environment rules |
| `secrets-rotation-runbook.md` | Planned and emergency secret rotation process |
| `ci-quality-gates.md` | Required PR and release quality gates |
| `database-migration-runbook.md` | Migration preflight, expand-contract, backup, and rollback rules |
| `preview-environment-runbook.md` | Preview deployment, smoke, evidence, and teardown rules |
| `staging-runbook.md` | Staging deploy, staging secrets, release gates, and smoke rules |
| `production-release-runbook.md` | Production deploy approval, backup, smoke, manifest, and rollback rules |
| `observability-runbook.md` | Logs, metrics, traces, dashboards, alerts, and SLO rules |
| `alert-rules.md` | Initial production alert thresholds and response routing |
| `supply-chain-policy.md` | Dependency, SBOM, secret scan, and GitHub Actions security rules |
| `security-release-checklist.md` | Security checks required before production release |
| `threat-model.md` | Initial threat model for auth, MCP, webhooks, credentials, billing, and delivery |
| `feature-flag-runbook.md` | Rollout, canary, kill switch, and audit process |
| `ab-testing-runbook.md` | Experiment lifecycle, metrics, guardrails, privacy, and cleanup rules |
| `feature-flag-audit-log.md` | Manual audit log template for production flag changes |
| `incident-response-runbook.md` | Severity matrix, roles, communication, mitigation, validation, and postmortem rules |
| `rollback-runbook.md` | Feature flag, deploy, database, and restore rollback order |
| `database-restore-runbook.md` | PITR/snapshot restore procedure and integrity validation |
| `disaster-recovery.md` | RPO/RTO, backup verification, restore drills, and DR evidence |
| `secret-leak-runbook.md` | Secret exposure response, rotation, audit, and notification process |
| `performance-runbook.md` | Performance budgets, load-test rules, release guardrails, and evidence |
| `performance-budgets.json` | API, webhook, workflow, frontend, and cost budgets |
| `cost-control-runbook.md` | Cloud, database, AI/provider, observability, and release cost controls |
| `slow-query-review-template.md` | Database slow-query investigation template |
| `governance-runbook.md` | Operational governance cadence, evidence, and action item rules |
| `operational-review-template.md` | Monthly operational review template with SLO and error budget review |
| `access-review-template.md` | Quarterly access review template for GitHub, Vercel, database, and providers |
| `error-budget-policy.md` | SLO, error budget, release freeze, and rollback rules |
| `release-calendar.md` | Release windows, freeze windows, hotfix rules, and release ownership |
| `environment-drift-runbook.md` | Environment baseline and drift response process |
| `quarterly-governance-checklist.md` | Quarterly governance checklist for access, secrets, restore, and threat model reviews |
| `incidents/incident-template.md` | Incident issue content template |
| `incidents/postmortem-template.md` | Postmortem content template |

## Key Commands

```powershell
pnpm env:check
pnpm env:check:production
pnpm db:migration:preflight
pnpm db:migration:preflight:db
pnpm smoke:preview -- --base-url https://your-preview-url.vercel.app
pnpm smoke:staging -- --base-url https://your-staging-url.example.com
pnpm smoke:prod -- --base-url https://your-production-url.example.com
pnpm release:manifest -- --environment production --version v1.0.0 --rollback-target v0.9.0
pnpm observability:check
pnpm security:release:check
pnpm feature-flags:check
pnpm security:release:check -- --strict --json
pnpm feature-flags:check -- --strict --json
pnpm incident:check -- --strict --json
pnpm restore:drill:check -- --strict --json
pnpm performance:check -- --strict --json
pnpm governance:check -- --strict --json
pnpm environment:drift:check -- --strict --json
pnpm load:api
pnpm load:webhooks
pnpm load:workflow
pnpm verify
pnpm verify:backend
```
