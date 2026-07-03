# MCP Continuous Improvement

Phase 14 turns the production hardening work into a recurring operating loop.

## Cadence

- Every release: run `pnpm mcp:release:gate -- --profile=chatgpt --strict`.
- Weekly: review rollout incidents, eval regressions, and high-risk tool policy changes.
- Monthly: review the MCP threat model and production readiness configuration.
- Quarterly: run a formal red-team exercise using the template in this folder.

## Required Evidence

- Release gate report in `docs/mcp/evidence/release-gates/`.
- Eval trend report in `docs/mcp/evidence/eval-dashboard/`.
- Incident records in `docs/mcp/mcp-apps/rollout/incidents/`.
- Red-team report using `red-team-exercise-template.md`.

## Gates

Use:

```bash
pnpm mcp:continuous:check
pnpm mcp:eval:trends
```

The continuous check verifies policy-as-code, semantic safety coverage, dashboard controls, responsible disclosure docs, red-team process docs, and release-gate wiring.
