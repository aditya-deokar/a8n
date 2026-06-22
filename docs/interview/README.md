# Interview Preparation Pack

This folder is a focused interview-prep layer for this project. It is not generic theory. The material is grounded in the actual codebase, especially:

- `src/app/api/mcp/route.ts`
- `src/mcp/*`
- `src/trpc/*`
- `src/inngest/functions.ts`
- `src/features/*`
- `prisma/schema.prisma`

## How to use this folder

Read the files in this order:

1. `01-project-story.md`
2. `02-architecture-deep-dive.md`
3. `03-senior-answer-bank.md`
4. `04-mock-interview.md`
5. `05-study-plan.md`
6. `06-reviewer-presentation-script.md`
7. `07-showcase-workflow.md`
8. `08-showcase-workflow-script.md`
9. `09-all-nodes-demo-workflow.md`
10. `10-exam-result-workflow.md`

## What you should be able to explain after studying this

- What product this project builds and why it matters
- Why the system uses both tRPC and MCP instead of forcing one interface to do everything
- How a workflow moves from visual graph to durable execution
- How authentication, authorization, encryption, and tenant isolation are handled
- Why Inngest is used for execution instead of doing long-running work inside a request
- Why MCP is exposed over Streamable HTTP and why it is stateless
- How React Query, Server Components, and tRPC work together in this project
- What the main tradeoffs are and what you would improve next

## Your core interview positioning

The strongest way to present this project is:

"This is not just a CRUD dashboard. It is a workflow automation platform with two API surfaces. Internally, the web app uses tRPC for type-safe product development. Externally, the platform exposes an MCP server so AI clients can discover and operate workflows, credentials, executions, and supporting resources in a standardized way. Workflow execution itself is decoupled into Inngest so long-running orchestration is durable and observable."

That framing sounds senior because it shows:

- product awareness
- interface design thinking
- operational thinking
- separation of concerns
- tradeoff awareness

## Facts worth memorizing

- Framework: Next.js 16 App Router
- Frontend: React 19
- Internal API: tRPC v11
- External AI API: MCP via `@modelcontextprotocol/sdk`
- Execution engine: Inngest
- Database: PostgreSQL with Prisma
- Auth: Better Auth
- Billing gate: Polar
- Workflow model: DAG of nodes and connections
- MCP endpoint: `/api/mcp`
- tRPC endpoint: `/api/trpc`
- MCP registration pattern: 22 tools, 4 resources, 3 prompts
- Security patterns: scoped API keys, bearer auth, encryption for credentials, per-user filtering

## Senior-level answer reminders

When you answer interview questions, do not stop at "what the code does." Always cover:

- Why that design was chosen
- What problem it avoids
- What tradeoff it introduces
- How it behaves under failure
- How you would scale or harden it

Good senior answers usually have this shape:

1. State the design
2. Explain the rationale
3. Call out the tradeoff
4. Suggest the next improvement

## Reference material used

Project-local references:

- `../ARCHITECTURE.md`
- `../WORKFLOW_ENGINE.md`
- `../DATABASE.md`
- `../API_REFERENCE.md`
- `../mcp/README.md`
- `../mcp/04-architecture.md`
- `../adr/002-trpc-api-layer.md`
- `../adr/008-mcp-streamable-http-server.md`

External references:

- MCP TypeScript SDK server guide: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md>
- MCP TypeScript SDK quickstart: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server-quickstart.md>
- tRPC context docs: <https://trpc.io/docs/server/context>
- tRPC data transformers: <https://trpc.io/docs/server/data-transformers>
- tRPC TanStack React Query setup: <https://trpc.io/docs/client/tanstack-react-query/setup>
- tRPC Server Components setup: <https://trpc.io/docs/client/tanstack-react-query/server-components>
