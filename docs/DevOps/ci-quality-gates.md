# CI Quality Gates

CI quality gates decide whether a change is safe enough to merge or release.

## Required Pull Request Gates

These should be required status checks before merging to `main`.

| Gate | Workflow | Why It Exists |
|---|---|---|
| Environment check | All relevant workflows | Fails early when config is missing or unsafe |
| Prisma validate | Internal API / MCP / release workflows | Catches invalid schema |
| Database migration preflight | Internal API / MCP / E2E / release workflows | Blocks destructive migrations and records migration evidence |
| Typecheck | Internal API / MCP workflows | Catches TypeScript contract errors |
| Lint | Internal API / MCP workflows | Catches code quality and Next.js issues |
| API unit/contract tests | `internal-api-quality.yml` | Protects tRPC surface and validation |
| API integration/security tests | `internal-api-quality.yml` | Protects DB/auth/security behavior |
| API E2E smoke | `backend-e2e.yml` | Verifies backend flows over real HTTP |
| Preview readiness | `preview.yml` | Verifies a PR can build and has migration evidence before hosted review |
| Preview smoke | `preview.yml` | Verifies successful hosted preview deployments do not return 5xx responses |
| MCP quality | `mcp-quality.yml` | Protects MCP protocol and tool behavior |
| Observability readiness | `observability.yml` | Verifies logs, alert docs, SLO docs, and evidence are present |
| Security and supply chain | `security.yml` | Runs CodeQL, dependency review, secret scan, audit, and SBOM evidence |
| Feature flag readiness | `feature-flags.yml` | Verifies rollout registry, kill switches, experiment rules, and runbooks |
| Incident and DR readiness | `restore-drill.yml` | Verifies incident, rollback, restore, and DR runbooks/evidence |
| Performance readiness | `performance-nightly.yml` | Verifies budgets, load-test scripts, slow-query review, and cost controls |
| Governance and environment drift | `governance.yml` | Verifies operational governance docs, access review templates, infra baseline, and drift evidence |
| Build | `backend-release-gate.yml` and future frontend workflow | Catches production build failures |

## Required Release Gates

Before production:

```powershell
pnpm env:check -- --profile production
pnpm db:migration:preflight -- --db
pnpm api:release:gate -- --strict --db --json
pnpm api:e2e:release:gate -- --json
pnpm mcp:release:gate
pnpm smoke:staging -- --base-url https://your-staging-url.example.com
pnpm observability:check -- --profile production --json
pnpm security:release:check -- --strict --json
pnpm feature-flags:check -- --strict --json
pnpm incident:check -- --strict --json
pnpm restore:drill:check -- --strict --json
pnpm performance:check -- --strict --json
pnpm governance:check -- --strict --json
pnpm environment:drift:check -- --strict --json
pnpm build
```

Production deployment additionally requires the protected `production` GitHub environment, backup confirmation, a rollback target, production smoke, security evidence, feature flag evidence, incident/DR evidence, performance evidence, governance evidence, environment drift evidence, and release manifest generation.

## CI Workflow Standards

Every GitHub Actions workflow should:

- Use `pnpm install --frozen-lockfile`.
- Use test-only secrets for PRs.
- Use concurrency cancellation for duplicate branch runs.
- Upload useful artifacts on failure.
- Upload migration preflight evidence for DB-affecting workflows.
- Avoid production secrets in `pull_request` workflows.
- Keep slow checks on nightly, main, or release workflows.

## Current Workflows

| Workflow | Role |
|---|---|
| `.github/workflows/internal-api-quality.yml` | tRPC/internal API static, unit, integration, DB, and coverage checks |
| `.github/workflows/backend-e2e.yml` | API E2E smoke on PRs and full E2E on main/schedule/manual |
| `.github/workflows/mcp-quality.yml` | MCP quality checks |
| `.github/workflows/internal-api-nightly.yml` | Deeper scheduled API checks |
| `.github/workflows/backend-release-gate.yml` | Combined backend release gate |
| `.github/workflows/preview.yml` | PR preview readiness and hosted preview smoke |
| `.github/workflows/staging-deploy.yml` | Protected staging deploy, migration, release gate, and smoke pipeline |
| `.github/workflows/production-deploy.yml` | Manual protected production deploy, migration, smoke, and release manifest |
| `.github/workflows/observability.yml` | Observability readiness and evidence |
| `.github/workflows/security.yml` | CodeQL, dependency review, secret scan, audit, and SBOM |
| `.github/workflows/feature-flags.yml` | Feature flag, kill switch, canary, and experiment readiness |
| `.github/workflows/restore-drill.yml` | Incident response and disaster recovery readiness |
| `.github/workflows/performance-nightly.yml` | Performance budgets and staged load-test workflow |
| `.github/workflows/governance.yml` | Platform governance, access review, and environment drift readiness |

## Database Migration Gate

Migration checks run before backend release work and after migrations are applied in DB-backed jobs.

| Command | Use |
|---|---|
| `pnpm db:migration:preflight` | Static SQL scan for destructive or risky migration patterns |
| `pnpm db:migration:preflight -- --db` | Static scan plus `prisma migrate status` against the target DB |
| `pnpm db:migration:preflight -- --changed-only --strict` | Strict review mode for newly changed migrations |

Evidence is written to `docs/api/evidence/migrations` and uploaded from CI where artifacts are available.

## Preview And Staging Gates

| Gate | Command | Evidence |
|---|---|---|
| Preview readiness | `pnpm env:check`, `pnpm db:migration:preflight`, `pnpm build` | `preview-readiness-evidence` |
| Preview smoke | `pnpm smoke:preview -- --base-url <preview-url> --json` | `docs/api/evidence/smoke/preview` |
| Staging release | `pnpm api:release:gate -- --strict --db --json` | `docs/api/evidence/release-gates` |
| Staging smoke | `pnpm smoke:staging -- --base-url <staging-url> --json` | `docs/api/evidence/smoke/staging` |

## Production Delivery Gates

| Gate | Command / Control | Evidence |
|---|---|---|
| Production approval | GitHub `production` environment reviewers | GitHub deployment record |
| Backup confirmation | `backup_confirmed=true` workflow input | Workflow summary |
| Production env check | `pnpm env:check -- --profile production` | Workflow logs |
| Observability readiness | `pnpm observability:check -- --profile production --json` | `docs/api/evidence/observability` |
| Security release check | `pnpm security:release:check -- --strict --json` | `docs/api/evidence/security` |
| Feature flag readiness | `pnpm feature-flags:check -- --strict --json` | `docs/api/evidence/feature-flags` |
| Incident readiness | `pnpm incident:check -- --strict --json` | `docs/api/evidence/incidents` |
| Restore drill readiness | `pnpm restore:drill:check -- --strict --json` | `docs/api/evidence/disaster-recovery` |
| Performance readiness | `pnpm performance:check -- --strict --json` | `docs/api/evidence/performance` |
| Governance readiness | `pnpm governance:check -- --strict --json` | `docs/api/evidence/governance` |
| Environment drift check | `pnpm environment:drift:check -- --strict --json` | `docs/api/evidence/environment-drift` |
| Production migration | `pnpm db:migration:preflight -- --db --json` | `docs/api/evidence/migrations` |
| Production smoke | `pnpm smoke:prod -- --base-url <production-url> --json` | `docs/api/evidence/smoke/production` |
| Release manifest | `pnpm release:manifest -- --environment production ...` | `docs/releases` |

## Branch Protection Recommendation

Configure `main` with:

- Require pull request before merge.
- Require CODEOWNERS review.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Block force pushes.
- Block branch deletion.
- Allow admins to bypass only for emergency hotfixes.
