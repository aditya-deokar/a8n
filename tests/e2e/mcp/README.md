# MCP E2E Tests

Playwright tests for MCP widgets and ChatGPT-profile browser flows live here.

Implemented:

- `widgets.spec.ts` renders the real ChatGPT widget HTML from `src/mcp/apps/widget-resources.ts`.
- Covers draft preview, setup checklist, execution timeline, and approval widgets.
- Covers empty, normal, error, large-payload, malicious-content, light/dark, and desktop/mobile project states.
- Verifies widget CSP, no external scripts, no iframe/object/embed surfaces, escaped malicious HTML, secret redaction, and approval widget tool-call allowlisting.
- Attaches screenshots as Playwright artifacts for every major widget state.

Run:

```powershell
pnpm test:mcp:e2e
```

These tests use `page.setContent`, so they do not require a running Next server. Playwright browser binaries must still be installed in the local or CI environment.
