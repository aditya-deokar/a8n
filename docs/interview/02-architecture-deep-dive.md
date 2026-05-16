# Architecture Deep Dive

## The most important architectural idea

This project has two consumers:

- the first-party web application
- third-party or external AI clients

Those consumers are served by two different interfaces:

- tRPC for the web app
- MCP for AI clients

That split is not duplication for its own sake. It is interface specialization.

## Why tRPC exists in this system

tRPC is the internal product API. It is optimized for:

- TypeScript-to-TypeScript development speed
- zero code generation
- runtime input validation with Zod
- middleware-based auth
- natural React Query integration

In this repo, that shows up in:

- `src/trpc/init.ts`
- `src/trpc/client.tsx`
- `src/trpc/server.tsx`
- `src/trpc/routers/_app.ts`
- `src/features/*/server/routers.ts`

The official tRPC docs emphasize that context is created per request and shared across batched calls, which fits this app because authentication and request-scoped data should remain consistent for a batch. The docs also recommend configuring data transformers on both the server and the client link, and this project follows that with `superjson`.

## Why MCP exists in this system

MCP is the external AI automation API. It is optimized for:

- standard tool discovery
- agent interoperability
- structured access to tools, resources, and prompts
- machine-usable context beyond plain REST endpoints

In this repo, that shows up in:

- `src/app/api/mcp/route.ts`
- `src/mcp/index.ts`
- `src/mcp/tools/*`
- `src/mcp/resources/*`
- `src/mcp/prompts/*`

The official MCP TypeScript SDK guidance is basically:

1. create an `McpServer`
2. choose a transport
3. connect them

This project follows that pattern directly. The SDK docs also distinguish Streamable HTTP for remote servers and stdio for local process-based integrations. Since this product exposes a network endpoint for remote AI clients, Streamable HTTP is the appropriate choice.

## Why `WebStandardStreamableHTTPServerTransport` is the right fit

This code runs in a Next.js App Router route handler, not in a custom long-lived Node process. The MCP quickstart and server guide make an important distinction:

- Node-specific transport types are for Node runtime servers
- the web-standard transport is the right fit for HTTP-based environments beyond that narrow case

Using `WebStandardStreamableHTTPServerTransport` inside `src/app/api/mcp/route.ts` is therefore a good architectural match for Next.js route handlers.

## Why stateless MCP was chosen

The route config sets `sessionIdGenerator: undefined`, which means stateless mode. That was a good choice here because:

- it reduces server-side session complexity
- it avoids stickiness requirements
- it fits serverless deployment models better
- each request can be handled independently

Tradeoff:

- you lose resumability and richer session semantics that stateful transports can provide

Senior framing:

"I chose stateless mode because the deployment model favored horizontal simplicity over advanced connection semantics."

## Internal tRPC design

## Router composition

The app router composes feature routers:

- workflows
- credentials
- executions
- MCP key management

That is a clean feature-based modular structure because domain logic stays close to the owning feature instead of accumulating in one giant API file.

## Middleware hierarchy

`src/trpc/init.ts` defines:

- `baseProcedure`
- `protectedProcedure`
- `premiumProcedure`

This is a strong design because authorization is expressed as composition instead of repeated if-statements in every handler.

What this gives you:

- unauthenticated access is impossible by default once you opt into protected procedures
- premium feature gating is explicit and reusable
- procedure code stays focused on business logic

## Transformers and cache hydration

The tRPC docs for data transformers and TanStack Query setup are relevant here. This project uses:

- `superjson` in `initTRPC.create`
- `superjson` in the client `httpBatchLink`
- custom `QueryClient` dehydration and hydration behavior

Why this is good:

- dates and richer values survive the server-client boundary
- SSR prefetch and hydration remain consistent
- React Query becomes the caching and invalidation engine while tRPC provides typed query options

## Server Components pattern

`src/trpc/server.tsx` uses `createTRPCOptionsProxy` and a cached query client getter. That matches the official tRPC Server Components pattern:

- create a stable query client per request
- prefetch on the server
- dehydrate into the response boundary
- hydrate on the client

This is one of the more senior parts of the stack because it shows awareness of request-scoped caching, SSR hydration, and React rendering boundaries.

## Workflow execution architecture

## Why execution is event-driven

The important decision is that `workflows.execute` does not perform the whole workflow inline. It sends an execution event and returns control. Inngest then owns the execution lifecycle.

This is the correct boundary because workflow execution can involve:

- network I/O
- third-party APIs
- retries
- variable duration
- failure handling

Putting that work inside a request-response handler would be brittle.

## Execution pipeline

In `src/inngest/functions.ts`, the pipeline is:

1. create execution record
2. load workflow graph
3. topologically sort nodes
4. resolve user context
5. execute each node in order
6. update execution status and output

That is a clean orchestration pipeline because every stage maps to a domain responsibility.

## Why topological sort matters

The workflow graph is a DAG, so the order of execution cannot be assumed from storage order. Topological sorting guarantees that a node only runs after its dependencies are satisfied.

Senior answer:

"The graph editor lets users express dependency structure visually. The runtime has to convert that structure into a valid execution order. Topological sort is the bridge between graph modeling and deterministic execution."

## Executor registry pattern

`src/features/executions/lib/executor-registry.ts` maps `NodeType` to an executor function. That makes the system extensible because adding a new node is mostly registration work plus one executor implementation.

Benefits:

- no giant switch statement scattered everywhere
- new behavior is isolated by node type
- execution logic stays aligned with feature ownership

## Context propagation

Each executor receives and returns a context object. That means workflow state is passed forward as the graph executes.

Why this is good:

- downstream nodes can consume upstream outputs
- the final execution record can store the terminal context
- the runtime stays generic rather than hardcoding pairwise integrations

## Data model and persistence choices

The main entities are:

- `User`
- `Session`
- `Account`
- `Verification`
- `Credential`
- `Workflow`
- `Node`
- `Connection`
- `Execution`
- `ApiKey`

Why this model is strong:

- workflows own nodes and connections
- executions are separate runtime records
- credentials are separate secured assets
- API keys are first-class entities instead of hidden config

## Security model

There are multiple security layers, which is exactly what interviewers want to hear.

### Web app security

- Better Auth handles sessions
- protected and premium procedures enforce access
- user scoping is pushed into database queries

### Credential security

- secrets are encrypted before storage via `src/lib/encryption.ts`
- only metadata should be broadly readable

### MCP security

- bearer token auth
- two auth modes: API key or session token
- scoped API keys
- scope guard middleware
- rate limiting
- audit context

Senior framing:

"I did not treat authentication as enough. I also enforced authorization, scope reduction, and tenant filtering at the data access layer."

## Reliability model

The project is more reliable than a normal student CRUD app because it captures operational state:

- execution records are persisted
- failures are stored with error details
- retries are handled by the execution engine
- status updates can be streamed in real time

That means failures become inspectable product events instead of disappearing into logs.

## Key tradeoffs and honest critique

## Strong choices

- event-driven execution instead of inline execution
- tRPC for first-party full-stack DX
- MCP for agent interoperability
- registry pattern for extensibility
- scoped API keys instead of one global secret

## Current limitations

- in-memory rate limiting is not distributed
- workflow updates are full replacement writes
- MCP and tRPC create parallel maintenance surfaces
- some documentation and code comments may drift as the system grows

## Best improvement path

If asked how to mature this further, say:

1. move rate limiting to Redis
2. add structured logging and tracing around executions and MCP calls
3. evolve workflow persistence to patch/diff semantics
4. strengthen policy checks for enterprise-grade MCP access
5. add deeper automated tests around graph validation, auth boundaries, and executor failures

## Good one-paragraph summary answer

"The architecture is intentionally split by concern: Next.js delivers the product, tRPC powers the internal TypeScript-native API, Inngest owns durable orchestration, Prisma models the data, and MCP exposes the platform to AI clients in a standard way. The design is strong because each layer does one job well, but the real maturity is in the tradeoffs: I accepted a dual-API maintenance cost to get better agent interoperability, and I chose stateless remote MCP plus event-driven execution because those decisions simplify operations and improve resilience."
