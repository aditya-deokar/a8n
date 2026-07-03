# API E2E Evidence

This directory stores generated API E2E release-gate evidence.

Generated artifacts:

- `api-e2e-release-gate.json` - release-gate summary and stop-ship criteria.
- `playwright-report/api-e2e/` - Playwright HTML report.
- `test-results/api-e2e/` - Playwright JSON results and traces.

Run locally:

```powershell
pnpm api:e2e:release:gate -- --json
pnpm api:e2e:release:gate -- --smoke --json
```

The gate must run only against an E2E-safe test database with `E2E_TESTS=true` and `E2E_EXTERNAL_SERVICES=mock`.
