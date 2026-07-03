# MCP Dependency And Supply-Chain Policy

Phase 12 requires release gates for dependency and supply-chain risk.

## Required Gates

- Lockfile integrity: `pnpm-lock.yaml` must exist and be committed.
- Offline secret scan: high-confidence API keys, MCP keys, bearer tokens, and private keys must not appear in `src/`, `scripts/`, or `prisma/`.
- License scan: dependency package metadata should include licenses for at least 90 percent of installed packages.
- SBOM evidence: store generated or offline package inventory under `docs/mcp/evidence/sbom/`.
- Vulnerability audit: run `pnpm audit` in CI or release infrastructure with registry access.

Local deterministic check:

```powershell
pnpm mcp:infrastructure:check
```

Strict release check:

```powershell
pnpm mcp:infrastructure:check -- --strict
```

## Update Cadence

Review these packages at least monthly and before major app submission changes:

- `@modelcontextprotocol/sdk`
- `next`
- `prisma`
- `@prisma/client`
- `better-auth`
- `@polar-sh/better-auth`
- OAuth/account-linking helpers
- Playwright/Vitest test infrastructure

## Stop-Ship Rules

- Critical or high production-reachable dependency vulnerability without mitigation.
- Secret scan finding in source, scripts, migrations, or release artifacts.
- Missing lockfile.
- MCP contract changes without updated eval coverage.
- Production release without a stored release-gate report.
