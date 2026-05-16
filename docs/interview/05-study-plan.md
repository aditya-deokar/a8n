# Study Plan

## 5-day focused preparation plan

## Day 1: Own the project story

Goals:

- explain the product in 30 seconds and 2 minutes
- memorize the main architectural layers
- be able to explain why both tRPC and MCP exist

Tasks:

1. Read `01-project-story.md`
2. Read `../ARCHITECTURE.md`
3. Practice the 30-second pitch ten times
4. Practice the 2-minute pitch five times

Output by end of day:

- you can explain the system without looking at notes

## Day 2: Internal API and data model

Goals:

- understand routers, procedures, auth middleware, and hydration
- understand the schema relationships

Tasks:

1. Read `02-architecture-deep-dive.md`
2. Read `../API_REFERENCE.md`
3. Read `../DATABASE.md`
4. Review:
   - `src/trpc/init.ts`
   - `src/trpc/client.tsx`
   - `src/trpc/server.tsx`
   - `prisma/schema.prisma`

Output by end of day:

- you can explain why tRPC was chosen
- you can explain how data isolation is enforced

## Day 3: Workflow engine mastery

Goals:

- explain execution lifecycle and runtime responsibilities
- explain DAG ordering and executor extensibility

Tasks:

1. Read `../WORKFLOW_ENGINE.md`
2. Review:
   - `src/inngest/functions.ts`
   - `src/features/executions/lib/executor-registry.ts`
3. Practice answers for:
   - why event-driven execution
   - how failures are handled
   - how to add a node type

Output by end of day:

- you can whiteboard the full execution flow

## Day 4: MCP and AI integration

Goals:

- explain why the project exposes MCP
- explain tools, resources, prompts, transport, auth, and scopes

Tasks:

1. Read `02-architecture-deep-dive.md` again
2. Read `../mcp/README.md`
3. Read `../mcp/04-architecture.md`
4. Review:
   - `src/app/api/mcp/route.ts`
   - `src/mcp/index.ts`
   - `src/mcp/auth/*`
5. Skim these official references:
   - <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md>
   - <https://trpc.io/docs/server/context>
   - <https://trpc.io/docs/client/tanstack-react-query/setup>

Output by end of day:

- you can explain why stateless Streamable HTTP was selected
- you can explain why MCP is not just "another API route"

## Day 5: Mock interview and polishing

Goals:

- sound calm, structured, and senior
- replace vague language with tradeoff-driven language

Tasks:

1. Run through `04-mock-interview.md`
2. Record yourself answering ten questions
3. Rewrite weak answers using `03-senior-answer-bank.md`
4. Prepare three personal reflection answers:
   - hardest technical decision
   - biggest mistake or limitation
   - what you would improve next

Output by end of day:

- you can answer both technical and judgment questions with confidence

## Night-before checklist

- review the 30-second and 2-minute project explanation
- review the three major flows: edit, execute, MCP call
- review security layers: auth, authorization, encryption, scoping
- review the top three tradeoffs
- review what you would improve in production

## 60-minute crash revision plan

### First 15 minutes

- read `README.md`
- read the 30-second and 2-minute project story

### Next 15 minutes

- review tRPC, Prisma, and workflow execution notes

### Next 15 minutes

- review MCP transport, auth, and scope model

### Last 15 minutes

- answer these out loud:
  - what did you build
  - why this architecture
  - how execution works
  - what tradeoffs you accepted
  - what you would improve next

## Final memory anchors

If your mind goes blank, return to these five anchors:

1. The product is a workflow automation platform.
2. The graph is persisted as workflows, nodes, and connections.
3. tRPC serves the first-party app; MCP serves AI clients.
4. Inngest executes workflows durably outside the request cycle.
5. Security is layered: sessions, middleware, encryption, scopes, and user-level query filtering.

## Best final interview mindset

Do not try to sound perfect. Try to sound like an engineer who understands:

- why the system is shaped this way
- where the risks are
- what is good enough for this stage
- what needs to evolve for real scale
