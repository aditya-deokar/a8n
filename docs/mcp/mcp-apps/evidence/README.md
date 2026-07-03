# MCP App Evidence

This folder stores release evidence for ChatGPT MCP app review, widget E2E runs, and live MCP evaluation traces.

## Folders

- `phase-8/` - submission screenshots and review evidence from the app packaging phase.
- `golden-prompts/` - manual ChatGPT developer-mode prompt evidence and expected behavior notes.

## Rules

- Do not commit raw bearer tokens, API keys, OAuth codes, refresh tokens, credential values, or customer payloads.
- Redact user emails and workspace-specific names unless they are dedicated test accounts.
- Keep screenshots focused on the app surface, OAuth consent, widget rendering, and approval gates.
- Pair every production incident with a regression eval ID in `src/mcp/evals/chatgpt-app-goals.ts`.

Generated live MCP traces are written by:

```powershell
pnpm mcp:live:eval
```

Default trace location:

```txt
docs/mcp/evidence/live-evals/YYYY-MM-DD/mcp-live-eval.json
```
