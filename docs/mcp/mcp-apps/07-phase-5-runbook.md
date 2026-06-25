# Phase 5 Runbook

This runbook covers the implemented safety, permissions, and prompt-injection hardening layer.

## What Is Implemented

Implemented:

- Central ChatGPT tool risk policy:

  ```txt
  src/mcp/safety/app-tool-policy.ts
  ```

- Prompt-injection detection helpers:

  ```txt
  src/mcp/shared/safety.ts
  ```

- Safety metadata on MCP JSON/text responses:

  ```txt
  src/mcp/shared/sanitize.ts
  ```

- Safer scope error copy for OAuth/API-key/session callers:

  ```txt
  src/mcp/middleware/scope-guard.ts
  ```

- Safety readiness checker:

  ```txt
  pnpm mcp:safety:check
  ```

## Tool Risk Policy

The ChatGPT profile classifies every app-facing tool as one of:

```txt
read_only
draft_write
approval_gated_write
external_side_effect
repair_write
admin_or_destructive
```

Forbidden tools are centrally listed and kept out of the ChatGPT profile:

```txt
create_api_key
list_api_keys
revoke_api_key
create_credential
update_credential
delete_credential
delete_workflow
update_workflow
security_status
list_mcp_audit_events
```

## Prompt-Injection Detection

Tool outputs are still returned as data, but the server now adds `_meta.safety` when sanitized output contains suspicious instructions such as:

- Ignore previous/system/developer instructions.
- Call destructive/admin tools.
- Reveal secrets, tokens, credentials, or hidden prompts.
- Pretend to be a system/developer/admin role.

This does not replace model-side instruction hierarchy. It gives ChatGPT and MCP clients an explicit machine-readable warning that the matched content is untrusted tool data.

## Verification

Run:

```powershell
pnpm mcp:safety:check
```

Expected:

```txt
Result: PASS
```

The checker validates:

- ChatGPT tool policy has 28 tools.
- Forbidden tools are not in the ChatGPT policy.
- Approval-gated tools require approval.
- Prompt-injection patterns are detected.
- MCP responses include safety metadata.
- Secret-looking strings are redacted.

## Remaining Manual Checks

Still verify in ChatGPT developer mode:

- `apply_workflow_draft` requires `approved: true` and a matching confirmation hash.
- `apply_workflow_fix` requires `approved: true` and a matching confirmation hash.
- `run_workflow_test` requires `approved: true`.
- `test_webhook_setup` requires `approved: true`.
- Destructive/admin tools are absent from the ChatGPT tool list.
- Malicious workflow names or execution payloads are treated as data, not instructions.
