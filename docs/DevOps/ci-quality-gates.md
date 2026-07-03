# CI Quality Gates

CI quality gates decide whether a change is safe enough to merge or release.

## Required Pull Request Gates

These should be required status checks before merging to `main`.

| Gate | Workflow | Why It Exists |
|---|---|---|
| Environment check | All relevant workflows | Fails early when config is missing or unsafe |
| Prisma validate | Internal API / MCP / release workflows | Catches invalid schema |
| Typecheck | Internal API / MCP workflows | Catches TypeScript contract errors |
| Lint | Internal API / MCP workflows | Catches code quality and Next.js issues |
| API unit/contract tests | `internal-api-quality.yml` | Protects tRPC surface and validation |
| API integration/security tests | `internal-api-quality.yml` | Protects DB/auth/security behavior |
| API E2E smoke | `backend-e2e.yml` | Verifies backend flows over real HTTP |
| MCP quality | `mcp-quality.yml` | Protects MCP protocol and tool behavior |
| Build | `backend-release-gate.yml` and future frontend workflow | Catches production build failures |

## Required Release Gates

Before production:

```powershell
pnpm env:check -- --profile production
pnpm api:release:gate -- --strict --db --json
pnpm api:e2e:release:gate -- --json
pnpm mcp:release:gate
pnpm build
```

## CI Workflow Standards

Every GitHub Actions workflow should:

- Use `pnpm install --frozen-lockfile`.
- Use test-only secrets for PRs.
- Use concurrency cancellation for duplicate branch runs.
- Upload useful artifacts on failure.
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

## Branch Protection Recommendation

Configure `main` with:

- Require pull request before merge.
- Require CODEOWNERS review.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Block force pushes.
- Block branch deletion.
- Allow admins to bypass only for emergency hotfixes.
