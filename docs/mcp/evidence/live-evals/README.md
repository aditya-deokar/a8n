# Live MCP Eval Evidence

`scripts/mcp-live-eval.ts` writes sanitized MCP client traces here.

Default path:

```txt
docs/mcp/evidence/live-evals/YYYY-MM-DD/mcp-live-eval.json
```

## Safe Local Contract Run

```powershell
pnpm mcp:live:eval
```

When no live bearer token is configured, this runs the golden prompt contract harness and records skipped live steps.

## Staging Live Read-Only Run

```powershell
$env:MCP_LIVE_EVAL_URL="https://<staging-domain>/api/mcp?profile=chatgpt"
$env:MCP_LIVE_EVAL_TOKEN="a8n_mcp_..."
pnpm mcp:live:eval -- --require-live
```

## Staging Mutating Run

Use only against a seeded staging/test database.

```powershell
$env:MCP_LIVE_EVAL_URL="https://<staging-domain>/api/mcp?profile=chatgpt"
$env:MCP_LIVE_EVAL_TOKEN="a8n_mcp_..."
$env:MCP_LIVE_EVAL_EXECUTION_ID="<failed-adversarial-execution-id>"
pnpm mcp:live:eval -- --require-live --mutating
```

The mutating run creates a draft, validates it, previews the diff, verifies unapproved apply is rejected, applies with the confirmation hash, optionally runs a workflow test, and diagnoses the seeded failed execution.

## Redaction Requirements

- Traces must not contain bearer tokens, MCP API keys, OAuth tokens, provider keys, or raw credential values.
- Staging payloads should use fake users and fake integrations.
- If a trace contains sensitive data, delete it and rerun after fixing sanitization.
