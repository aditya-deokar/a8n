# ADR-003: Inngest for Durable Workflow Execution

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

Nodebase workflows can contain multiple nodes that make external API calls (AI models, HTTP requests, messaging services). These operations:
- Can take seconds to minutes to complete (AI model generation)
- May fail transiently (rate limits, network errors)
- Should not block the user's HTTP request
- Need to report progress in real-time
- Require failure recovery (retry failed steps without re-executing completed ones)

We need an execution engine that provides **durable, asynchronous, event-driven** function execution.

## Decision

**We chose Inngest v4 as the workflow execution engine.**

### Key Reasons

1. **Durable step functions** — Each step in the execution (create record, fetch workflow, execute node) is individually durable. If step 3 fails and retries, steps 1-2 do not re-execute.

2. **Automatic retries** — Configurable retry policies (3 in production, 0 in development). Transient failures are handled automatically.

3. **Event-driven architecture** — Workflows are triggered by sending an event (`inngest.send()`). The engine runs asynchronously — the HTTP response returns immediately.

4. **Realtime channels** — `@inngest/realtime` enables server-to-browser streaming of execution progress. Each node type has a dedicated channel that publishes loading/success/error status.

5. **Serverless-first** — Inngest functions run as serverless endpoints (`/api/inngest`). No background worker processes, no Redis, no infrastructure.

6. **AI SDK integration** — `step.ai.wrap()` provides native telemetry for Vercel AI SDK calls.

7. **Failure handlers** — `onFailure` callback captures errors and updates the execution record in the database.

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **Synchronous execution** | Workflows can take minutes. Synchronous execution would block the HTTP request and risk timeouts (Vercel has a 30s limit for serverless functions). |
| **Bull/BullMQ** | Requires self-hosted Redis. No built-in step durability. Manual retry logic. No realtime channels. |
| **Temporal** | Powerful but complex. Requires a Temporal server cluster. Steep learning curve. Over-engineered for this use case. |
| **AWS Step Functions** | Vendor lock-in. JSON-based workflow definition (not code). No realtime streaming. |
| **Custom queue (database)** | Build from scratch: polling, retry logic, concurrency control, failure handling. Significant engineering effort with many edge cases. |

## Consequences

### Positive
- Zero infrastructure to manage (serverless)
- Step-level durability prevents wasted work on retries
- Realtime channels provide native server-to-browser streaming
- Clean separation between triggering and execution
- Built-in observability via Inngest dashboard
- Failure handlers ensure executions are always properly marked

### Negative
- Dependency on Inngest as a service (vendor risk)
- Realtime channels require dedicated subscription tokens per node type
- Inngest middleware typing can be complex (realtime middleware type casting)
- Local development requires running the Inngest dev server separately

### Risks
- Inngest Cloud pricing at scale (high-volume workflows)
- Inngest Realtime is still relatively new — API may evolve

---

*Related: [WORKFLOW_ENGINE.md](../WORKFLOW_ENGINE.md) · [TECH_STACK.md](../TECH_STACK.md)*
