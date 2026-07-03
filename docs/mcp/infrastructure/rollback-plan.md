# MCP Production Rollback Plan

This plan covers Phase 12 MCP infrastructure changes.

## Before Deploy

- Run `pnpm mcp:release:gate -- --profile=chatgpt --strict`.
- Confirm `prisma validate` passes.
- Confirm migration `20260702120000_mcp_distributed_infrastructure` is applied in staging.
- Run `pnpm mcp:maintenance -- --dry-run --json`.
- Confirm backup job includes all tables from `getMcpBackupRestoreManifest`.

## New Tables

- `mcp_rate_limit_bucket`

This table stores short-lived counters only. It is safe to truncate if rate-limit state must be reset.

## Rollback Steps

1. Set emergency flags:

   ```powershell
   $env:MCP_DISABLE_SIDE_EFFECT_TOOLS="true"
   $env:MCP_FORCE_READ_ONLY_CHATGPT_PROFILE="true"
   ```

2. Roll application code back to the previous stable deployment.
3. Keep `mcp_rate_limit_bucket` in place during rollback unless it causes deployment failure.
4. If the table must be removed, first switch to memory mode:

   ```powershell
   $env:MCP_RATE_LIMIT_BACKEND="memory"
   ```

5. Drop only the Phase 12 table:

   ```sql
   DROP TABLE IF EXISTS "mcp_rate_limit_bucket";
   ```

6. Re-run:

   ```powershell
   pnpm mcp:infrastructure:check
   pnpm mcp:production:check
   ```

## Restore Test Expectations

After restoring a backup:

- Workflows load with nodes and connections.
- Drafts and versions retain JSON snapshots.
- Credential records exist and encrypted values are non-empty.
- OAuth client/token/consent records are present or intentionally purged.
- Audit log retention matches `MCP_AUDIT_RETENTION_DAYS`.
- `server_info` and `security_status` work for an operator key.
