# A/B Testing Runbook

This runbook defines how product experiments should be launched, measured, stopped, and cleaned up.

## Principles

- Use experiments for product learning, not for security-critical behavior.
- Define the primary metric before launch.
- Define guardrail metrics before launch.
- Assign users deterministically so a user stays in the same variant.
- Keep personally identifiable or private workflow data out of analytics events.
- Stop the experiment when the decision is made.
- Remove losing variants and stale experiment code.

## Implemented Baseline

| Item | Artifact |
|---|---|
| Experiment registry | `src/config/feature-flags.ts` |
| Deterministic assignment | `assignExperimentVariant` in `src/lib/feature-flags.ts` |
| Exposure event | `recordExperimentExposure` |
| Readiness check | `pnpm feature-flags:check` |
| Evidence | `docs/api/evidence/feature-flags` |

## Experiment Lifecycle

1. Write the hypothesis.
2. Select the audience.
3. Define variants and weights.
4. Define the primary metric.
5. Define guardrail metrics.
6. Define the minimum runtime and stopping rule.
7. Add the experiment to `src/config/feature-flags.ts`.
8. Emit an exposure event once per meaningful user exposure.
9. Launch at a small rollout.
10. Monitor guardrails daily.
11. Decide: ship winner, keep control, iterate, or stop.
12. Remove dead variants and update docs.

## Experiment Template

| Field | Value |
|---|---|
| Experiment key |  |
| Owner |  |
| Hypothesis |  |
| Audience |  |
| Variants | `control`, `variant` |
| Primary metric |  |
| Guardrail metrics | API 5xx rate, workflow execution failure rate, latency, support contacts |
| Start date |  |
| Planned end date |  |
| Minimum sample |  |
| Stop conditions |  |
| Rollback | Force control variant or disable related feature flag |

## Metric Rules

Primary metric examples:

- Workflow created within 24 hours.
- First successful workflow execution.
- Integration setup completed.
- Trial-to-paid conversion.

Guardrail metric examples:

- API 5xx rate.
- p95 API latency.
- Workflow execution failure rate.
- Webhook processing failure rate.
- MCP tool error rate.
- Support contact rate.
- Billing error rate.

Do not ship a winning variant when guardrails regress materially, even if the primary metric improves.

## Assignment And Exposure

Use deterministic assignment:

```ts
const variant = assignExperimentVariant("workflowOnboardingV2", {
  userId,
  plan,
  environment: process.env.A8N_ENV_PROFILE,
});
recordExperimentExposure("workflowOnboardingV2", variant, { userId, plan });
```

Only record exposure when the user could actually see or experience the variant.

## Production Controls

| Control | Use |
|---|---|
| `EXPERIMENT_EVENT_LOG_ENABLED=false` | Stop exposure logging during analytics incidents |
| `EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT=control` | Force the initial onboarding experiment variant during rollback or debugging |
| Related feature flag override | Turn off the experiment-backed feature path |
| Related kill switch | Stop writes, webhooks, workflow execution, or MCP mutations |

## Privacy And Compliance

- Do not send raw workflow payloads, credential values, webhook bodies, OAuth codes, tokens, or private execution output to analytics.
- Prefer user IDs and plan/environment metadata.
- Keep experiment event names stable.
- Document any analytics vendor data movement before production use.

## Decision Record

When closing an experiment, record:

- Final dates.
- Sample size.
- Primary metric result.
- Guardrail results.
- Decision.
- Follow-up cleanup PR.
- Owner.

The decision can live in release notes, a product decision doc, or the PR that removes the experiment.
