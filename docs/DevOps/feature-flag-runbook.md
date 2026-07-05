# Feature Flag, Canary, And Kill Switch Runbook

This runbook explains how a8n controls risky production behavior after code is deployed.

## Implemented Controls

| Control | Artifact |
|---|---|
| Flag registry | `src/config/feature-flags.ts` |
| Server evaluator | `src/lib/feature-flags.ts` |
| Readiness check | `pnpm feature-flags:check` |
| CI workflow | `.github/workflows/feature-flags.yml` |
| Evidence | `docs/api/evidence/feature-flags` |
| Workflow kill switch | `KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION` |
| Webhook kill switch | `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING` |
| MCP mutation kill switch | `KILL_SWITCH_DISABLE_MCP_MUTATIONS` |

## Flag Types

| Type | Example | Purpose |
|---|---|---|
| Release flag | `newWorkflowEditor` | Ship code before exposing it broadly |
| Canary flag | `apiCanary` | Route a small deterministic user slice through new behavior |
| Security flag | `credentialRotationFlow` | Roll out sensitive operational changes carefully |
| Kill switch | `disableWorkflowExecution` | Stop high-risk behavior immediately during incidents |
| Experiment | `workflowOnboardingV2` | Assign users to variants for measured product learning |

## Environment Variables

| Variable | Use |
|---|---|
| `FEATURE_FLAGS_ENABLED` | Global on/off for non-kill-switch feature flags |
| `FEATURE_FLAG_OVERRIDES` | Comma-separated override list like `apiCanary=true,newWorkflowEditor=false` |
| `CANARY_ROLLOUT_PERCENT` | Shared fallback rollout percentage from 0 to 100 |
| `FEATURE_FLAG_NEW_WORKFLOW_EDITOR_ROLLOUT_PERCENT` | Rollout for `newWorkflowEditor` |
| `FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT` | Rollout for `apiCanary` |
| `FEATURE_FLAG_MCP_ENHANCED_TOOLING_ROLLOUT_PERCENT` | Rollout for `mcpEnhancedTooling` |
| `FEATURE_FLAG_CREDENTIAL_ROTATION_FLOW_ROLLOUT_PERCENT` | Rollout for `credentialRotationFlow` |
| `KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION` | Blocks new workflow execution dispatch |
| `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING` | Returns controlled 503 responses for Google Form and Stripe webhooks |
| `KILL_SWITCH_DISABLE_MCP_MUTATIONS` | Blocks MCP write, admin, and side-effect tools while preserving read tools |
| `KILL_SWITCH_READ_ONLY_MODE` | Reserved global read-only switch for future expansion |
| `EXPERIMENT_EVENT_LOG_ENABLED` | Enables experiment exposure events |
| `EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT` | Forces `workflowOnboardingV2` to a valid variant for rollback/debugging |

## Rollout Process

1. Add the flag to `src/config/feature-flags.ts` with owner, description, default, rollout percentage, and explicit rollout env name.
2. Wire the flag on the server side with `isFeatureEnabled` or `getFeatureFlagSnapshot`.
3. Add or update kill switches for any behavior that can create external side effects, data writes, billing changes, credentials, or user-visible incidents.
4. Update `.env.example`, this runbook, and the release checklist.
5. Run `pnpm feature-flags:check`.
6. Release to staging with rollout at `0`.
7. Turn on for internal users or `1-5` percent.
8. Watch error rate, latency, workflow failure rate, webhook failures, MCP guardrail denials, and support signals.
9. Increase to `25`, `50`, then `100` only when guardrails remain healthy.
10. Remove the flag after the rollout is fully complete and stable.

## Kill Switch Process

Use a kill switch before app rollback when the bad behavior is isolated to a controlled path.

| Incident | First Switch |
|---|---|
| Workflow execution outage or unsafe side effects | `KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION=true` |
| Webhook provider storm, forged traffic, or bad payload processing | `KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING=true` |
| MCP unsafe writes, prompt-injection incident, or approval bypass risk | `KILL_SWITCH_DISABLE_MCP_MUTATIONS=true` |

After enabling a kill switch:

1. Record the change in `docs/DevOps/feature-flag-audit-log.md`.
2. Confirm the blocked path returns a controlled failure.
3. Confirm read-only and unaffected paths still work.
4. Notify stakeholders with impact and next update time.
5. Open or update the incident record if user impact exists.
6. Keep the switch enabled until the fix is deployed and verified.

## Audit Rules

Every production flag, rollout, experiment, or kill switch change must record:

- Time.
- Environment.
- Operator.
- Change.
- Reason.
- Expected impact.
- Validation result.
- Rollback or disable condition.

Use `docs/DevOps/feature-flag-audit-log.md` until a database-backed admin UI exists.

## Required Checks

```powershell
pnpm feature-flags:check
pnpm feature-flags:check -- --json
pnpm feature-flags:check -- --strict --json
pnpm feature-flags:check:strict
```

CI writes readiness evidence to:

```text
docs/api/evidence/feature-flags/YYYY-MM-DD/feature-flag-check.json
```
