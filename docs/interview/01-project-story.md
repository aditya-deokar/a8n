# Project Story

## 30-second version

"This project is an AI-native workflow automation platform similar in spirit to n8n or Zapier, but built with a modern TypeScript stack. Users create workflows as DAGs in a visual editor, store credentials securely, and trigger executions through a durable event-driven engine. Internally, the product uses tRPC for type-safe full-stack development. Externally, it exposes an MCP server so AI clients can manage workflows and consume platform context through standardized tools, resources, and prompts."

## 2-minute senior version

"At a system level, I treated the product as three separate concerns. First, there is the interactive SaaS application: auth, dashboard, editor, credentials, and execution history. Second, there is the orchestration runtime: once a workflow is triggered, execution should not be tied to the lifecycle of an HTTP request, so it is pushed into Inngest for durable processing, retries, and real-time status updates. Third, there is the AI integration surface: instead of exposing ad hoc endpoints for agents, the platform implements MCP so AI clients can discover capabilities in a standard way.

That separation mattered because the user-facing dashboard and the AI-facing automation layer have different constraints. The dashboard benefits from tRPC and React Query because the client and server are both TypeScript and we want maximum developer velocity. MCP solves a different problem: interoperability with AI tools like Cursor or Inspector, plus protocol-level concepts such as tools, resources, and prompts. So the architecture intentionally uses tRPC for internal product calls and MCP for external agent access, while Prisma and the workflow engine remain shared backend foundations."

## What problem the project solves

The product solves four problems at once:

1. It lets non-trivial automations be modeled visually instead of coded manually.
2. It lets users connect external systems such as AI providers, chat platforms, and webhooks.
3. It executes those automations reliably with history and failure tracking.
4. It makes the same platform programmable by AI clients through MCP.

That fourth point is the differentiator. Many student projects stop at "we built a dashboard." This one adds an AI-native control plane.

## Main system layers

### 1. Presentation layer

- Next.js App Router powers page routing and server rendering.
- React Flow is used for the graph editor.
- Feature modules organize the UI by domain: workflows, credentials, executions, auth, and MCP management.

### 2. Internal API layer

- tRPC routers live in `src/trpc` and `src/features/*/server/routers.ts`.
- Procedures use middleware-based access control:
  - `baseProcedure`
  - `protectedProcedure`
  - `premiumProcedure`
- React Query is used for caching, invalidation, hydration, and server prefetch.

### 3. Workflow execution layer

- Workflow runs are dispatched as Inngest events.
- `src/inngest/functions.ts` creates an execution record, topologically sorts the graph, resolves the user, executes nodes, and updates final status.
- Executors are registered per node type in `src/features/executions/lib/executor-registry.ts`.

### 4. External AI integration layer

- MCP is exposed at `/api/mcp`.
- The server is created by `src/mcp/index.ts`.
- Capabilities are registered through separate registries for tools, resources, and prompts.
- The transport is `WebStandardStreamableHTTPServerTransport` in stateless mode.

### 5. Data and security layer

- Prisma models persistent state in `prisma/schema.prisma`.
- Better Auth handles sessions and identity.
- Credentials are encrypted before persistence.
- MCP adds scoped API keys for least-privilege automation.

## The three flows you must be able to explain

## Flow 1: User edits a workflow in the web app

1. The frontend loads workflow data through tRPC.
2. The graph is edited in the React Flow UI.
3. The updated nodes and edges are sent through `workflows.update`.
4. The backend replaces nodes and connections inside a Prisma transaction.

Why this matters:

- The transaction prevents a half-updated graph.
- The internal API remains type-safe from UI to database.
- The persistence format stays simple enough for execution and MCP reuse.

## Flow 2: User runs a workflow

1. The UI or API calls `workflows.execute`.
2. That sends an execution event instead of doing the work inline.
3. Inngest creates an execution record.
4. The workflow graph is loaded and topologically sorted.
5. Each node executor runs in dependency order and passes context forward.
6. The execution record is marked `SUCCESS` or `FAILED`.

Why this matters:

- Execution is durable and observable.
- Long-running work does not block request threads.
- Failures are captured as domain state, not just logs.

## Flow 3: AI client calls the MCP server

1. The client sends a request to `/api/mcp`.
2. Bearer auth is validated as either a scoped API key or a session token.
3. Rate limiting is checked.
4. A fresh MCP server instance is built for that request.
5. Registered tools, resources, and prompts become available through the transport.
6. The request is handled and rate-limit headers are returned.

Why this matters:

- The server follows official MCP transport patterns for remote servers.
- Stateless handling fits a serverless or horizontally scaled deployment model.
- Scopes let automation be precise instead of all-powerful.

## Why the architecture is strong

This design is strong because it separates responsibilities without fragmenting the platform:

- Next.js owns application delivery
- tRPC owns internal product RPC
- Inngest owns durable orchestration
- MCP owns agent interoperability
- Prisma owns data access and modeling

A weaker design would have tried to do workflow execution inside page requests, or tried to force MCP to replace the product API, or tried to use only REST everywhere. This project avoids those traps.

## Main tradeoffs to acknowledge honestly

### Dual API surfaces

Having both tRPC and MCP is the right design, but it increases maintenance because capability changes may need to be reflected in more than one interface.

### Stateless MCP transport

Stateless Streamable HTTP simplifies deployment, but it gives up resumable session behavior that a stateful transport could support.

### In-memory rate limiting

The current rate-limiter approach is acceptable for local or single-instance use, but for real multi-instance production I would move it to Redis or another distributed store.

### Full graph replacement on update

`workflows.update` deletes and recreates nodes and connections. That is simple and consistent for a student project, but a production editor would likely evolve toward diff-based persistence for better auditability and lower write cost.

## Best "what would you improve next?" answer

"My next improvements would be around operational maturity rather than just adding features. I would move rate limiting and audit logging to shared infrastructure, add stronger structured observability around workflow execution, harden MCP permission boundaries with more granular policy checks, and evolve workflow persistence from full replacement to patch-based updates. That would make the system more scalable, safer for enterprise usage, and easier to debug in production."

## Best "what did you personally learn?" answer

"The biggest lesson was that workflows, product APIs, and agent APIs are related but not identical concerns. Building both tRPC and MCP into the same system forced me to think more carefully about interface design, execution boundaries, and least-privilege access. That shifted my mindset from building features to designing platforms."
