# Infrastructure

This folder is the starting point for Infrastructure as Code ownership in a8n. The project can run without Terraform or Pulumi today, but production infrastructure decisions should still be represented as code, reviewed like code, and checked for drift.

## Goals

- Keep local, test, preview, staging, and production infrastructure definitions visible.
- Make infrastructure changes reviewable through pull requests and CODEOWNERS.
- Detect environment drift before staging or production releases.
- Record ownership, review cadence, and operational evidence in the repo.

## Current Scope

| Artifact | Purpose |
|---|---|
| `infra/environment-baseline.json` | Source-controlled baseline for required environment variables, secret ownership, and runtime configuration sources |
| `docs/DevOps/environment-drift-runbook.md` | Process for reviewing and resolving drift |
| `scripts/environment-drift-check.ts` | Non-destructive drift readiness check that writes release evidence |

## Infrastructure as Code Direction

Future infrastructure code should live under this folder. Add provider-specific folders only when the project is ready to manage those resources directly.

Recommended future layout:

```text
infra/
  README.md
  environment-baseline.json
  terraform/
    preview/
    staging/
    production/
  scripts/
```

Rules:

- No production secret values in this repo.
- Infrastructure changes require PR review and CODEOWNERS approval.
- Staging and production must use separate projects, databases, OAuth apps, provider tokens, and webhook secrets.
- Changes to required variables must update `.env.example`, `src/env.ts`, relevant GitHub workflows, and the environment baseline.
- Drift findings must create tracked action items with an owner and target date.

## Ownership

| Area | Owner | Review Cadence |
|---|---|---|
| Environment baseline | Platform owner | Quarterly and before production release |
| Staging and production GitHub environments | Platform owner | Quarterly access review |
| Database provider projects | Platform owner | Quarterly restore drill and access review |
| Vercel projects | Platform owner | Quarterly access review |
| Provider credentials | Security owner | Quarterly secret rotation review |

