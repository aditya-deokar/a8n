# DevOps Documentation

This folder contains the production DevOps roadmap and the first implemented governance/configuration/CI foundations.

## Current Status

| Phase | Status | Main Artifacts |
|---|---|---|
| Phase 0: DevOps audit and standards | Implemented | CODEOWNERS, PR template, release checklist |
| Phase 1: Environment and secrets foundation | Implemented | `.env.example`, `src/env.ts`, `pnpm env:check`, environment strategy, secrets rotation runbook |
| Phase 2: CI quality gates | Implemented | CI concurrency, env-check steps, quality gate docs |
| Phase 3+ | Planned | See the full implementation plan |

## Files

| File | Purpose |
|---|---|
| `INDUSTRY_GRADE_DEVOPS_IMPLEMENTATION_PLAN.md` | Full industry-grade DevOps roadmap |
| `release-checklist.md` | Production release checklist |
| `environment-strategy.md` | Dev/test/preview/staging/prod environment rules |
| `secrets-rotation-runbook.md` | Planned and emergency secret rotation process |
| `ci-quality-gates.md` | Required PR and release quality gates |

## Key Commands

```powershell
pnpm env:check
pnpm env:check:production
pnpm verify
pnpm verify:backend
```
