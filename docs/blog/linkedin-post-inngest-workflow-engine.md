# How I Built a Durable Workflow Execution Engine for a8n (and Why I Chose Inngest)

*Successor post to: "Building a workflow tool is harder than drawing nodes on a canvas."*

---

In my last post, I said I'd share the actual breakdown of how a8n's execution engine works.

Here it is.

When you click "Run" on a workflow, a lot more happens than what meets the eye. The canvas is visual. The execution engine is where the real engineering lives.

Let me walk you through the architecture, the decisions, and the trade-offs.

---

## The Problem: What Does "Running a Workflow" Actually Mean?

A workflow in a8n looks like a graph — nodes connected by edges on a canvas.

But "running" that graph means solving multiple hard problems at once:

→ **Ordering**: Which node executes first?
→ **Data flow**: How does output from Node A become input for Node B?
→ **Failure handling**: What if an API call times out?
→ **Retries**: Should the whole workflow restart, or just the failed step?
→ **Durability**: What if the server crashes mid-execution?
→ **Observability**: How do you show the user what's happening in real time?

Building a `for` loop that runs nodes sequentially won't survive production. I needed something more robust.

---

## The Execution Pipeline (End to End)

Here's the complete journey when a user clicks "Run Workflow" in a8n:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER CLICKS "RUN"                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  tRPC Mutation: workflows.execute                                   │
│  • Validates user owns the workflow                                 │
│  • Calls sendWorkflowExecution()                                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Inngest Event: "workflows/execute.workflow"                        │
│  • Event dispatched with workflowId + unique eventId                │
│  • Inngest queues and schedules the function                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Inngest Function: executeWorkflow                                  │
│                                                                     │
│  Step 1: "create-execution"                                         │
│    → Creates Execution record in DB (RUNNING status)                │
│                                                                     │
│  Step 2: "prepare-workflow"                                         │
│    → Fetches workflow nodes + connections from DB                   │
│    → Runs topologicalSort() to determine execution order            │
│                                                                     │
│  Step 3: "find-user-id"                                             │
│    → Resolves user context for credential access                    │
│                                                                     │
│  Step 4..N: Execute each node sequentially                          │
│    → getExecutor(node.type) → Runs the right executor               │
│    → Each executor is a step.run() — independently retryable        │
│    → Context flows from node to node                                │
│    → Real-time status published via @inngest/realtime               │
│                                                                     │
│  Final Step: "update-execution"                                     │
│    → Marks execution as SUCCESS                                     │
│    → Stores final output                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Topological Sort — Deciding Execution Order

A workflow is a DAG (Directed Acyclic Graph). Before executing anything, I need to figure out **which node runs first**.

```
Example Workflow:

    [Manual Trigger]
          │
          ▼
    [HTTP Request] ──────► [Gemini AI]
          │                     │
          ▼                     ▼
    [Discord Notify]      [Slack Notify]
```

Topological sort converts this graph into a linear execution order:

```
Manual Trigger → HTTP Request → Gemini AI → Discord Notify → Slack Notify
```

Here's the actual implementation approach:

```
┌──────────────────────────────────────────────────┐
│              topologicalSort()                    │
│                                                  │
│  Input: nodes[], connections[]                   │
│                                                  │
│  1. Build edges: connections.map(                │
│       conn → [conn.fromNodeId, conn.toNodeId]    │
│     )                                            │
│                                                  │
│  2. Handle orphan nodes (no connections):        │
│     → Add self-edges so they're included         │
│                                                  │
│  3. Run toposort algorithm on edges              │
│                                                  │
│  4. Detect cycles → throw "Workflow has a cycle" │
│                                                  │
│  5. Map sorted IDs back to Node objects          │
│                                                  │
│  Output: Node[] in execution order               │
└──────────────────────────────────────────────────┘
```

**Why not just BFS/DFS?**
Topological sort guarantees that every node runs **only after all its dependencies** have completed. BFS/DFS alone doesn't give you that guarantee for DAGs with complex branching.

---

## Step 2: Why Inngest? (The Real Painkiller)

This is the core decision in the entire architecture.

### The Pain I Was Trying to Solve

When you run a workflow that calls 5 external APIs in sequence, a lot can go wrong:

```
┌──────────────────────────────────────────────────────────────────┐
│                    WHAT CAN GO WRONG                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ❌ Server restarts mid-execution → all progress lost            │
│  ❌ API #3 rate-limits you → whole workflow dies                 │
│  ❌ Database timeout on step 4 → retry from step 1?             │
│  ❌ Lambda/serverless cold start timeout                         │
│  ❌ Memory lost between function calls in serverless             │
│  ❌ No visibility into which step failed and why                 │
│                                                                  │
│  With a naive approach:                                          │
│  → You'd need to build retry logic per step                     │
│  → You'd need to persist intermediate state to DB               │
│  → You'd need your own job queue (Bull, Redis, etc.)            │
│  → You'd need to handle idempotency yourself                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### What Inngest Gave Me (Out of the Box)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INNGEST VALUE PROPOSITION                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ Durable Execution                                                │
│     Each step.run() is checkpointed. If the server crashes           │
│     after step 3, Inngest resumes from step 4 — not from scratch.   │
│                                                                      │
│  ✅ Per-Step Retries                                                 │
│     Failed HTTP request? Inngest retries just that step.             │
│     Not the entire workflow. Configurable: 3 retries in prod,        │
│     0 in dev.                                                        │
│                                                                      │
│  ✅ Event-Driven Architecture                                        │
│     inngest.send({ name: "workflows/execute.workflow", data })       │
│     Fire and forget. Inngest handles queuing, scheduling,            │
│     and delivery.                                                    │
│                                                                      │
│  ✅ Built-in Failure Hooks (onFailure)                               │
│     If a workflow fails after all retries, onFailure fires:          │
│     → Updates execution status to FAILED in DB                       │
│     → Logs the error with full stack trace                           │
│     → No manual cleanup needed                                       │
│                                                                      │
│  ✅ @inngest/realtime Channels                                       │
│     Publish node status (loading → success → error) in real time    │
│     to the frontend via subscription — zero WebSocket boilerplate.   │
│                                                                      │
│  ✅ Next.js Native Integration                                       │
│     serve() in a single API route. No separate worker process.       │
│     No infrastructure to manage.                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### The Killer Feature: `step.run()`

This is what makes Inngest fundamentally different. Every `step.run()` call is a **durability checkpoint**:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Without step.run() (naive approach):                            │
│  ─────────────────────────────────────                           │
│  [Step 1] → [Step 2] → [Step 3] → 💥 CRASH                     │
│                                     ↓                            │
│                              Restart from Step 1                 │
│                              (all progress lost)                 │
│                                                                  │
│                                                                  │
│  With step.run() (Inngest):                                      │
│  ──────────────────────────────                                  │
│  [Step 1 ✓] → [Step 2 ✓] → [Step 3] → 💥 CRASH                │
│       │             │                     ↓                      │
│    (saved)       (saved)          Resume from Step 3             │
│                                   (steps 1 & 2 cached)          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

In a8n, every node execution is wrapped in `step.run()`:

```
for (const node of sortedNodes) {
    const executor = getExecutor(node.type);
    context = await step.run(`execute-${node.id}`, () =>
        executor({ data, nodeId, userId, context, step, publish })
    );
}
```

If the Gemini API call fails, Inngest retries **just that step**. The HTTP Request node that already succeeded? Cached. Not re-executed.

---

## Step 3: Real-Time Node Status (How the UI Stays Alive)

When a workflow runs, users need to see which node is loading, which succeeded, and which failed — live.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME STATUS FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Server (Inngest Function)              Client (React UI)               │
│  ────────────────────────               ──────────────────              │
│                                                                         │
│  executor starts                                                        │
│    │                                                                    │
│    ├─► publish({ status: "loading" })  ──►  useInngestSubscription()    │
│    │                                         │                          │
│    │   [... API call happens ...]            ├─► setStatus("loading")   │
│    │                                         │   (spinner on node)      │
│    ├─► publish({ status: "success" })  ──►   │                          │
│    │                                         ├─► setStatus("success")   │
│    │                                         │   (green checkmark)      │
│    │                                         │                          │
│    │   [... or if it fails ...]              │                          │
│    │                                         │                          │
│    └─► publish({ status: "error" })    ──►   └─► setStatus("error")    │
│                                                  (red X on node)       │
│                                                                         │
│  Each node type has its own channel:                                    │
│    • http-request-execution                                             │
│    • gemini-execution                                                   │
│    • discord-execution                                                  │
│    • slack-execution                                                    │
│    • ... (11 channels total)                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Each channel is defined with typed topics:

```
channel("http-request-execution")
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>()
  );
```

On the frontend, a single React hook subscribes to status updates:

```
const status = useNodeStatus({
    nodeId, channel, topic, refreshToken
});
// Returns: "initial" | "loading" | "success" | "error"
```

**No WebSocket server. No Socket.io. No polling.** Inngest Realtime handles the transport.

---

## Step 4: Context Passing Between Nodes

Each node can produce output that downstream nodes consume. This is how data flows through the workflow:

```
┌───────────────────────────────────────────────────────────────────────┐
│                       CONTEXT FLOW                                    │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Initial Context: {}                                                  │
│       │                                                               │
│       ▼                                                               │
│  [Manual Trigger]                                                     │
│  Output: { trigger: { type: "manual", timestamp: "..." } }           │
│       │                                                               │
│       ▼                                                               │
│  Context: { trigger: { ... } }                                        │
│       │                                                               │
│       ▼                                                               │
│  [HTTP Request] (endpoint: "/api/users")                              │
│  Output: { apiResult: { httpResponse: { status: 200, data: [...] } }}│
│       │                                                               │
│       ▼                                                               │
│  Context: { trigger: { ... }, apiResult: { ... } }                    │
│       │                                                               │
│       ▼                                                               │
│  [Gemini AI] (prompt uses Handlebars: "Summarize {{apiResult}}")      │
│  Output: { summary: "Here are the key findings..." }                  │
│       │                                                               │
│       ▼                                                               │
│  Context: { trigger: { ... }, apiResult: { ... }, summary: "..." }    │
│       │                                                               │
│       ▼                                                               │
│  [Slack Notify] (message: "{{summary}}")                              │
│  Posts the summary to Slack ✓                                         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

Each executor receives the full context and returns a **merged** context:

```
return {
    ...context,                         // everything from previous nodes
    [data.variableName]: responsePayload  // this node's output
};
```

Downstream nodes access upstream data using **Handlebars templates**:

```
Handlebars.compile(data.endpoint)(context)
// "https://api.example.com/users/{{trigger.userId}}"
// → "https://api.example.com/users/42"
```

---

## Step 5: The Executor Registry Pattern

Instead of a massive `switch` statement, a8n uses a registry pattern for node executors:

```
┌──────────────────────────────────────────────────────────────────┐
│                     EXECUTOR REGISTRY                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NodeType              →  Executor Function                      │
│  ─────────────────────    ──────────────────                     │
│  MANUAL_TRIGGER        →  manualTriggerExecutor                  │
│  HTTP_REQUEST          →  httpRequestExecutor                    │
│  GOOGLE_FORM_TRIGGER   →  googleFormTriggerExecutor              │
│  STRIPE_TRIGGER        →  stripeTriggerExecutor                  │
│  GEMINI                →  geminiExecutor                         │
│  OPENAI                →  openAiExecutor                         │
│  ANTHROPIC             →  anthropicExecutor                      │
│  DISCORD               →  discordExecutor                        │
│  SLACK                 →  slackExecutor                          │
│  EMAIL                 →  emailExecutor                          │
│  GOOGLE_SHEETS         →  googleSheetsExecutor                   │
│                                                                  │
│  Adding a new node type = adding one line to the registry        │
│  + implementing the NodeExecutor interface                       │
│                                                                  │
│  interface NodeExecutorParams {                                  │
│    data: Record<string, unknown>    // node config               │
│    nodeId: string                   // unique ID                 │
│    userId: string                   // for credential access     │
│    context: WorkflowContext         // upstream data             │
│    step: StepTools                  // Inngest step tools        │
│    publish: RealtimePublishFn       // status broadcasting       │
│  }                                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

This is the **Open/Closed Principle** in practice — open for extension (add new executors), closed for modification (core engine unchanged).

---

## Alternatives I Evaluated (and Why I Didn't Use Them)

Inngest wasn't the only option. Here's the full decision matrix:

```
┌──────────────────┬──────────────┬─────────────┬──────────────┬─────────────┐
│                  │   Inngest    │  BullMQ +   │  Temporal    │  DIY with   │
│                  │              │  Redis      │              │  cron/DB    │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Durable          │ ✅ Built-in  │ ❌ Manual   │ ✅ Built-in  │ ❌ Manual   │
│ Execution        │              │             │              │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Per-Step         │ ✅ Automatic │ ⚠️ Per-job  │ ✅ Automatic │ ❌ Manual   │
│ Retries          │              │  only       │              │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Next.js          │ ✅ Native    │ ❌ Separate │ ❌ Separate  │ ⚠️ Hacky   │
│ Integration      │  serve()     │  worker     │  worker      │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Real-time        │ ✅ @inngest/ │ ❌ Need     │ ❌ Need      │ ❌ Need     │
│ Status           │  realtime    │  Socket.io  │  custom      │  polling    │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Infrastructure   │ ✅ Zero      │ ❌ Redis    │ ❌ Temporal  │ ⚠️ DB only │
│ Overhead         │  (managed)   │  required   │  cluster     │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Observability    │ ✅ Dashboard │ ⚠️ Basic   │ ✅ Full      │ ❌ Build    │
│                  │  + events    │  UI         │  dashboard   │  yourself   │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Learning         │ ⚠️ Moderate │ ✅ Simple   │ ❌ Steep     │ ✅ Simple   │
│ Curve            │              │             │  (complex)   │  (at first) │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Serverless       │ ✅ First-    │ ❌ Needs    │ ❌ Needs     │ ⚠️ Limited │
│ Compatible       │  class       │  persistent │  persistent  │             │
│                  │              │  worker     │  cluster     │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Cost at Scale    │ ⚠️ Usage-   │ ✅ Self-    │ ✅ Self-     │ ✅ Minimal  │
│                  │  based       │  hosted     │  hosted      │             │
├──────────────────┼──────────────┼─────────────┼──────────────┼─────────────┤
│ Vendor           │ ⚠️ Yes      │ ✅ No       │ ✅ No        │ ✅ No       │
│ Lock-in          │  (managed)   │  (OSS)      │  (OSS)      │             │
└──────────────────┴──────────────┴─────────────┴──────────────┴─────────────┘
```

### Why Not BullMQ + Redis?

BullMQ is great for job queues, but it doesn't give you **durable multi-step functions**. Each job is atomic — if you need 5 steps, you'd need to chain 5 separate jobs and manage state between them yourself. Plus, I'd need a separate Redis instance and a separate worker process. For a final-year project deployed on Vercel, that's a lot of infrastructure.

### Why Not Temporal?

Temporal is the gold standard for workflow orchestration. It has everything — durable execution, replay, versioning. But:
- It requires running a **Temporal cluster** (server + DB + worker)
- The learning curve is steep (workflow definitions, activities, workers, task queues)
- Overkill for a project running on serverless infrastructure
- I'd spend more time on DevOps than on the actual product

### Why Not DIY (Cron + DB Polling)?

I could store workflow state in the database and poll for updates. But:
- No durability guarantees (what if the server dies between writes?)
- Retry logic becomes a nightmare to implement correctly
- Idempotency is hard to get right
- Real-time status would require WebSocket infrastructure
- I'd essentially be building a worse version of Inngest from scratch

### The Bottom Line

Inngest won because it sits at the **sweet spot** for a Next.js serverless project:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Simplicity ◄──────────────────────────────► Power      │
│                                                         │
│  DIY     BullMQ     ★ Inngest ★      Temporal          │
│  ───     ──────         ▲             ────────          │
│  Easy    Moderate     Right here      Complex           │
│  Fragile Good        Durable + Easy   Enterprise-grade  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## The Trade-Offs (Being Honest)

No technology is perfect. Here's what I traded:

```
┌──────────────────────────────────────────────────────────────────┐
│                      TRADE-OFFS                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  Vendor Lock-in                                              │
│     My execution engine is tightly coupled to Inngest's          │
│     step.run() API, realtime channels, and event system.         │
│     Migrating to BullMQ or Temporal would mean rewriting         │
│     the core execution loop.                                     │
│                                                                  │
│  ⚠️  Cost at Scale                                               │
│     Inngest charges per step execution. A workflow with          │
│     10 nodes = 10+ step runs per execution. At high volume,     │
│     this adds up. Self-hosted alternatives (BullMQ, Temporal)   │
│     would be cheaper at scale.                                   │
│                                                                  │
│  ⚠️  Debugging Complexity                                        │
│     When something fails inside a step.run(), the error          │
│     surfaces through Inngest's retry/failure system.             │
│     Local debugging requires running the Inngest dev server     │
│     alongside the Next.js dev server.                            │
│                                                                  │
│  ⚠️  Sequential Execution                                        │
│     Currently, a8n runs nodes one-by-one (for loop).            │
│     Parallel branches (nodes with no dependency between them)    │
│     could run concurrently but don't yet.                        │
│     This is a design choice, not an Inngest limitation.          │
│                                                                  │
│  ⚠️  Cold Starts (Serverless)                                    │
│     On Vercel's serverless, the first step.run() after           │
│     inactivity might have a cold start delay.                    │
│     Not an issue once warm, but noticeable for occasional        │
│     workflow runs.                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## The Full Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           a8n ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│   │  React   │    │  tRPC    │    │  Inngest │                          │
│   │  Canvas  │───►│  Server  │───►│  Event   │                          │
│   │  (UI)    │    │ (Mutations)│   │  Queue   │                          │
│   └──────────┘    └──────────┘    └─────┬────┘                          │
│        ▲                                │                               │
│        │                                ▼                               │
│        │                         ┌──────────────┐                       │
│        │                         │  executeWork  │                       │
│        │                         │  flow()       │                       │
│        │                         │  ┌──────────┐ │                       │
│        │                         │  │ Topo Sort│ │                       │
│        │                         │  └────┬─────┘ │                       │
│        │                         │       ▼       │                       │
│        │                         │  ┌──────────┐ │    ┌───────────────┐ │
│        │                         │  │ Executor │─┼───►│  External     │ │
│        │                         │  │ Registry │ │    │  APIs         │ │
│        │                         │  └────┬─────┘ │    │  (Gemini,     │ │
│        │                         │       │       │    │   Slack,      │ │
│        │                         │       ▼       │    │   Discord,    │ │
│   ┌────┴─────┐                   │  ┌──────────┐ │    │   Stripe...) │ │
│   │ @inngest │◄──────────────────┼──│ Realtime │ │    └───────────────┘ │
│   │ /realtime│   status updates  │  │ Channels │ │                      │
│   │ hooks    │                   │  └──────────┘ │                       │
│   └──────────┘                   └──────┬───────┘                       │
│                                         │                               │
│                                         ▼                               │
│                                  ┌──────────────┐                       │
│                                  │   Prisma DB  │                       │
│                                  │  (Postgres)  │                       │
│                                  │  • Workflows │                       │
│                                  │  • Executions│                       │
│                                  │  • Credentials│                      │
│                                  │    (encrypted)│                      │
│                                  └──────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Workflows are DAGs, not flowcharts.** Topological sort is your first real algorithm decision.

2. **Durable execution is non-negotiable.** If your server can die mid-workflow, you need checkpointing. `step.run()` gave me this for free.

3. **Per-step retries > workflow-level retries.** Retrying a whole 10-node workflow because node 7 failed is wasteful and error-prone.

4. **Real-time feedback matters.** Users need to see progress. Inngest Realtime + React hooks = zero-infra real-time status.

5. **The executor registry pattern scales.** Adding a new integration (e.g., Google Sheets) means implementing one function and adding one line to the registry.

6. **Pick tools that match your deployment model.** I'm on Vercel (serverless). Inngest is serverless-native. Temporal isn't. This mattered more than feature comparison.

7. **Trade-offs are real.** Vendor lock-in and per-execution costs are genuine concerns. For a production SaaS, I'd evaluate self-hosting Inngest or migrating to Temporal as traffic grows.

---

Building a8n taught me that the execution engine of a workflow tool is a **distributed systems problem** dressed up as a drag-and-drop UI.

The canvas is what users see.
The engine is what makes it actually work.

---

*This is Part 2 of my a8n deep-dive series.*
*Part 1: "Building a workflow tool is harder than drawing nodes on a canvas."*
*Next: How a8n handles encrypted credential management and multi-provider auth.*

*#workflows #inngest #typescript #nextjs #systemdesign #softwareengineering #durableexecution #buildinpublic*
