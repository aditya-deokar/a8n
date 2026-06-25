# MCP Evaluation And Rollout

> Last updated: June 24, 2026
> Status: Phase 8 baseline implemented

This document explains how to verify that the MCP server is moving toward the product goal: helping non-technical users build, understand, test, and repair workflows through conversation.

## What Is Implemented

- `src/mcp/evals/non-technical-goals.ts` defines 50 beginner-style workflow goals.
- `scripts/mcp-eval.ts` runs a deterministic planner-quality evaluation.
- `npm run eval:mcp` is the local Phase 8 quality gate.
- The eval covers current app capabilities: manual triggers, Google Forms, Stripe, HTTP APIs, OpenAI, Anthropic, Gemini, Slack, Discord, Email, Google Sheets, credentials, integrations, clarification questions, and external side effects.

## Run The Eval

```bash
npm run eval:mcp
```

Expected baseline result:

```text
MCP non-technical workflow evaluation
Cases: 50/50 passed (100%)
Average score: 0.996
Catalog: ok
Redaction: ok
```

The script exits with a non-zero status if the suite drops below the quality gate.

## Quality Gates

The current local gate checks:

- At least 50 eval cases exist.
- Overall pass rate is at least 80%.
- The canonical node, credential, and template manifests are internally consistent.
- Sensitive values such as API keys, bearer tokens, and private keys are redacted.
- Each goal predicts the expected node types, credential types, integrations, trigger, side-effect nodes, and clarification-question coverage.

## Eval Case Shape

Each case contains:

- `id`: stable identifier for regression tracking.
- `persona`: the kind of non-technical user.
- `goal`: plain-language request.
- `expected.nodeTypes`: required graph nodes.
- `expected.credentialTypes`: required credential families.
- `expected.integrations`: required services or app capabilities.
- `expected.trigger`: expected workflow trigger.
- `expected.externalSideEffects`: nodes that can send data, messages, or external calls.
- `expected.mustAskAbout`: required beginner-facing clarification topics.

## Add A New Case

1. Open `src/mcp/evals/non-technical-goals.ts`.
2. Add a new `c(...)` entry with a stable id and natural user phrasing.
3. Include every expected app capability, not only the most obvious one.
4. Run `npm run eval:mcp`.
5. If the new case fails because the evaluator missed legitimate wording, improve `scripts/mcp-eval.ts`.
6. If it fails because the product cannot support the request yet, keep the expected case out of the default gate and track it as roadmap coverage instead.

## What This Eval Does Not Prove Yet

The Phase 8 baseline is useful, but it is not the full product guarantee. It does not yet prove:

- A real MCP client can complete authenticated tool calls end to end.
- Generated drafts save and execute successfully against live services.
- Beginners can complete setup without help from a developer.
- MCP Apps render correctly in every supported client.
- Multi-user rate limits and telemetry work across multiple app instances.

Those are rollout gates, not just unit-style evaluation gates.

## Recommended Release Checklist

Run before merging major MCP changes:

```bash
npm run eval:mcp
npx prisma validate
npx tsc --noEmit --pretty false
```

Run before production release:

- MCP Inspector discovery and `health_check` with a scoped API key.
- Create, validate, apply, and test one manual workflow.
- Create, validate, apply, and test one Google Form sample workflow.
- Create, validate, apply, and test one Stripe sample workflow.
- Confirm persisted audit logs are written for MCP tool calls.
- Confirm webhook verification rejects unsigned or wrong-secret requests.
- Confirm no raw credential values appear in tool responses, execution summaries, or audit records.

## Rollout Stages

1. Internal developer keys.
2. Advanced user beta.
3. Beginner beta with guided setup sessions.
4. Default assistant path for new users.

## Success Metrics

Track these once product analytics are wired:

- First workflow success rate.
- Average clarification turns before draft creation.
- Validation failure rate before apply.
- Execution success after generated workflow creation.
- Tool retry rate.
- Destructive action confirmation rate.
- Number of workflows created without opening the raw editor.
- Support requests avoided or resolved through MCP diagnosis.

