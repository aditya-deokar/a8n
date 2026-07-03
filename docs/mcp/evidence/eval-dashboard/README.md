# MCP Eval Dashboard Evidence

This folder stores generated Phase 14 eval trend reports.

Generate the latest report with:

```bash
pnpm mcp:eval:trends -- --json
```

The report aggregates stored MCP evidence JSON from release gates, live evals, app evals, and adversarial evals. It highlights regressions, pass-rate changes, and adversarial attack-class coverage.
