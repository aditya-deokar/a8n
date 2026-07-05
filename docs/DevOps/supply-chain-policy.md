# Supply Chain Policy

This policy defines how dependencies, build tools, GitHub Actions, secrets, and release artifacts are controlled.

## Goals

- Prevent leaked secrets from reaching source control.
- Detect vulnerable dependencies before merge or release.
- Keep GitHub Actions and npm packages updated.
- Generate an SBOM for production releases.
- Make security evidence available with release artifacts.

## Implemented Controls

| Control | Artifact |
|---|---|
| Code scanning | `.github/workflows/security.yml` with CodeQL |
| Dependency review | `actions/dependency-review-action` |
| Secret scan | Gitleaks workflow step |
| SBOM generation | `anchore/sbom-action` |
| Dependency updates | `.github/dependabot.yml` |
| Local readiness | `pnpm security:release:check` |
| Evidence | `docs/api/evidence/security` |

## Dependency Rules

- Use `pnpm install --frozen-lockfile` in CI.
- Review all dependency updates that touch auth, billing, database, crypto, MCP, webhooks, or build tooling.
- High and critical vulnerabilities block release unless explicitly waived with a tracked mitigation.
- Avoid packages with unclear maintenance, suspicious install scripts, or incompatible licenses such as GPL/AGPL variants unless explicitly approved.
- Keep `pnpm.onlyBuiltDependencies` limited to packages that genuinely need build scripts.

## GitHub Actions Rules

- Prefer official actions from GitHub or established vendors.
- Pin actions to major versions at minimum.
- Use least-privilege workflow permissions.
- Never expose production secrets to `pull_request` workflows.
- Any workflow that reads production secrets must use a protected GitHub Environment.

## Secret Handling Rules

- Do not commit real tokens, API keys, webhook secrets, OAuth secrets, or private keys.
- Use GitHub/Vercel environment secrets.
- Rotate secrets after suspected exposure.
- Redact secrets from release artifacts and logs.
- Keep `.env.example` placeholders realistic but fake.

## SBOM And Release Evidence

Security workflow produces:

```text
docs/api/evidence/security/YYYY-MM-DD/security-release-check.json
sbom.spdx.json
```

Production release evidence should include:

- Security release check.
- Dependency review result.
- CodeQL result.
- Secret scan result.
- SBOM artifact.
- Release manifest.

## Waiver Rules

Security waivers must include:

- Vulnerability or control being waived.
- Affected package or workflow.
- Reason the risk is acceptable.
- Mitigation.
- Expiry date.
- Owner.

Waivers for critical vulnerabilities should be rare and require production owner approval.

## Required Commands

```powershell
pnpm security:release:check
pnpm security:release:check -- --json
pnpm security:release:check -- --strict --json
```

GitHub runs deeper security checks through `.github/workflows/security.yml`.
