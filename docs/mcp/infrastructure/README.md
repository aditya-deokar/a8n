# MCP Production Infrastructure

This folder contains the Phase 12 and Phase 13 production-hardening artifacts for MCP.

## Implemented Controls

- Distributed rate limiting through the `mcp_rate_limit_bucket` database table.
- Local development fallback through the existing in-memory limiter.
- Daily maintenance support for OAuth cleanup, audit retention, rate-limit bucket cleanup, and audit health.
- Backup/restore manifest for workflows, drafts, versions, credentials, OAuth records, audit logs, and rate-limit buckets.
- Rollback plan for Phase 12 database changes.
- Dependency and supply-chain policy covering lockfile integrity, audit cadence, license review, SBOM storage, and stop-ship criteria.
- Combined release gate through `pnpm mcp:release:gate -- --profile=chatgpt --strict`.

## Commands

```bash
pnpm mcp:maintenance -- --dry-run --json
pnpm mcp:infrastructure:check -- --strict
pnpm mcp:release:gate -- --profile=chatgpt --strict
```

Use `--allow-dev-hosts` only for local production-readiness rehearsal, not for real production release sign-off.
