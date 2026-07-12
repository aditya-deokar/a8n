# I Chose tRPC Over REST and GraphQL for a Full-Stack SaaS — Here's What Happened

*Part 4 of the a8n deep-dive series.*

---

When I started building a8n — a workflow automation platform with a drag-and-drop editor, a durable execution engine, and an MCP server for AI clients — I had to make a decision that every full-stack developer faces:

**How should my frontend talk to my backend?**

The options were:

1. **REST** — the default. Everyone knows it. Industry standard.
2. **GraphQL** — the "modern" choice. Facebook uses it. Must be good.
3. **tRPC** — the new kid. Type-safe RPC for TypeScript monorepos.

I went with tRPC. Not because it was trendy. Because it was the right fit for **this specific architecture** — and because I wanted to learn something that would change how I think about API design.

Six months later, here's my honest take. What worked. What didn't. And the one thing nobody warns you about.

---

## The Decision Framework

Before comparing technologies, I mapped what I actually needed:

```
┌──────────────────────────────────────────────────────────────────┐
│                    WHAT a8n NEEDED                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Full-stack TypeScript (Next.js + React + Prisma)             │
│  ✅ Monorepo — frontend and backend in the same codebase        │
│  ✅ 4 feature domains: Workflows, Credentials, Executions, MCP  │
│  ✅ Auth + billing middleware on every procedure                 │
│  ✅ Server-side prefetch for Next.js App Router (RSC)           │
│  ✅ Input validation with runtime error messages                │
│  ✅ Type-safe mutations + queries from React components         │
│  ✅ Batch requests for performance                               │
│  ❌ No mobile app                                                │
│  ❌ No public API (MCP handles that separately)                  │
│  ❌ No third-party consumers (all clients are my own React UI)   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

That last line — **"all clients are my own React UI"** — is the key.

---

## REST: The Default Choice (And Why I Didn't Pick It)

REST is the gravitational pull of web development. If you don't actively choose something else, you'll end up writing REST routes.

Here's what the workflows API would look like with REST in Next.js:

```typescript
// ❌ REST: /api/workflows/route.ts
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
  // ☝️ manual parsing. no type safety. "page" could be "banana".

  const workflows = await prisma.workflow.findMany({
    where: { userId: session.user.id },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return Response.json({ items: workflows });
}

// ❌ REST: client side
const res = await fetch("/api/workflows?page=1&pageSize=10");
const data = await res.json();
// ☝️ data is `any`. No types. No autocomplete. No refactoring safety.
```

**The problems with REST for a full-stack monorepo:**

| Problem | Impact |
|---|---|
| **No type sharing** | Client and server types drift. You refactor the response shape, nothing warns you the frontend broke. |
| **Manual validation** | You parse `searchParams` by hand. Every route has the same boilerplate: parse → validate → 400 if bad → proceed. |
| **No autocomplete** | `fetch("/api/workflows")` is a string. Rename the route, nothing tells you. |
| **Manual error handling** | Every route needs `try/catch`, status codes, error shapes. |
| **No middleware composition** | Auth, logging, billing — you write the same checks in every route handler. |
| **Serialization gaps** | `Date` comes back as a string. You handle it manually. |

REST makes sense when your API has external consumers. When you control both the client and server, all that HTTP ceremony is overhead.

---

## GraphQL: The "Modern" Choice (And Why It Was Overkill)

GraphQL solves the "fetch exactly what you need" problem. For mobile apps with limited bandwidth hitting a shared API, it's excellent.

Here's what a8n would look like with GraphQL:

```typescript
// ❌ GraphQL: type definitions
const typeDefs = `
  type Workflow {
    id: ID!
    name: String!
    nodes: [Node!]!
    edges: [Edge!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  type Query {
    workflows(page: Int, pageSize: Int, search: String): WorkflowPage!
    workflow(id: ID!): Workflow!
  }
  
  type Mutation {
    createWorkflow: Workflow!
    updateWorkflow(id: ID!, nodes: [NodeInput!]!, edges: [EdgeInput!]!): Workflow!
    deleteWorkflow(id: ID!): Workflow!
  }
`;

// ❌ GraphQL: resolvers (separate file)
const resolvers = {
  Query: {
    workflows: async (_, args, ctx) => {
      // auth check, validation, pagination...same code as REST, different shape
    },
  },
};

// ❌ GraphQL: client side
const GET_WORKFLOWS = gql`
  query GetWorkflows($page: Int, $pageSize: Int) {
    workflows(page: $page, pageSize: $pageSize) {
      items { id name updatedAt }
      totalCount
      hasNextPage
    }
  }
`;
// ☝️ schema + resolvers + client queries + codegen = 4 files for 1 operation
```

**The problems with GraphQL for a single-client monorepo:**

| Problem | Impact |
|---|---|
| **Schema duplication** | You define types in `.graphql`, then again in TypeScript, then run codegen to bridge them. Three sources of truth for one type. |
| **Codegen dependency** | Every schema change needs `graphql-codegen` to regenerate types. One more build step. One more thing that breaks. |
| **Resolver boilerplate** | Every resolver has the same auth/validation/error pattern as REST, just in a different shape. |
| **Client query strings** | `gql` template literals are strings. Typo in a field name? Runtime error, not compile error. (Codegen helps, but adds complexity.) |
| **N+1 queries** | Without DataLoader, nested resolvers hit the DB per-item. Solving this properly requires architectural effort. |
| **Overkill for single client** | GraphQL's superpower is letting different clients request different fields. If I only have one React frontend, I always need the same fields. |

GraphQL is the right choice when you have 3 different clients (web, iOS, Android) each needing different data shapes from the same API. a8n has one client.

---

## tRPC: The Right Fit (And Why)

tRPC takes a fundamentally different approach: **if the client and server are in the same TypeScript codebase, why translate types through HTTP?**

Here's what a8n actually looks like with tRPC:

### Server: Router Definition

```typescript
// ✅ tRPC: src/features/workflows/server/routers.ts
export const workflowsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().min(1).max(50).default(10),
        search: z.string().default(""),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;
      // ☝️ input is fully typed. page is number, not string.
      // Zod validates at runtime. TypeScript validates at compile time.
      
      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          where: { userId: ctx.auth.user.id, name: { contains: search } },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.workflow.count({
          where: { userId: ctx.auth.user.id, name: { contains: search } },
        }),
      ]);

      return { items, page, pageSize, totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page < Math.ceil(totalCount / pageSize),
      };
    }),
});
```

### Client: Calling the Procedure

```typescript
// ✅ tRPC: src/features/workflows/hooks/use-workflows.ts
export const useSuspenseWorkflows = () => {
  const trpc = useTRPC();
  const [params] = useWorkflowsParams();
  
  return useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
  // ☝️ params is type-checked against the Zod schema.
  //    Return type is inferred from the server function.
  //    Rename a field on the server? Every client call shows a type error.
};
```

**That's it.** No REST routes. No GraphQL schema. No codegen. The server function's return type IS the client's data type. One source of truth.

---

## The Architecture: How tRPC Fits Into a8n

```
┌──────────────────────────────────────────────────────────────────────────┐
│               a8n tRPC ARCHITECTURE                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  REACT COMPONENTS (Client)                                               │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │  useCreateWorkflow()    →  trpc.workflows.create.mutation   │        │
│  │  useSuspenseWorkflows() →  trpc.workflows.getMany.query     │        │
│  │  useExecuteWorkflow()   →  trpc.workflows.execute.mutation  │        │
│  │  useMcpKeys()           →  trpc.mcp.listKeys.query          │        │
│  │                                                              │        │
│  │  Every call is type-safe. Autocomplete works.                │        │
│  │  Rename a field? TypeScript catches it immediately.          │        │
│  └──────────────────┬───────────────────────────────────────────┘        │
│                     │ httpBatchLink (superjson transformer)               │
│                     ▼                                                    │
│  NEXT.JS API ROUTE                                                       │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │  /api/trpc/[trpc]                                            │        │
│  │  Single route handles ALL tRPC calls.                        │        │
│  │  Batch-able: multiple queries in one HTTP request.           │        │
│  └──────────────────┬───────────────────────────────────────────┘        │
│                     ▼                                                    │
│  tRPC MIDDLEWARE STACK                                                    │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                                                              │        │
│  │  baseProcedure                                               │        │
│  │  └─ trpcLoggingMiddleware                                    │        │
│  │     • Logs: procedure start, success, failure                │        │
│  │     • Tracks: duration, error codes, request IDs             │        │
│  │     • Structured JSON (pino)                                 │        │
│  │                                                              │        │
│  │  protectedProcedure = baseProcedure                          │        │
│  │  └─ authMiddleware                                           │        │
│  │     • Calls auth.api.getSession()                            │        │
│  │     • Throws UNAUTHORIZED if no session                      │        │
│  │     • Injects ctx.auth (session + user)                      │        │
│  │                                                              │        │
│  │  premiumProcedure = protectedProcedure                       │        │
│  │  └─ billingMiddleware                                        │        │
│  │     • Calls Polar API for subscription status                │        │
│  │     • Throws FORBIDDEN if no active subscription             │        │
│  │     • Injects ctx.customer                                   │        │
│  │                                                              │        │
│  └──────────────────┬───────────────────────────────────────────┘        │
│                     ▼                                                    │
│  ROUTERS (Feature-based)                                                 │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │  appRouter                                                    │        │
│  │  ├── workflows  (create, getOne, getMany, update, execute)   │        │
│  │  ├── credentials (create, getOne, getMany, update, remove)   │        │
│  │  ├── executions  (getOne, getMany)                           │        │
│  │  └── mcp         (createKey, listKeys, revokeKey,            │        │
│  │                   securitySummary, oauthConnections)          │        │
│  └──────────────────┬───────────────────────────────────────────┘        │
│                     ▼                                                    │
│  DATABASE (Prisma + PostgreSQL)                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### What Makes This Clean

**1. Feature-based routing, not route-based routing.**

Every feature owns its router. The app router is just composition:

```typescript
// src/trpc/routers/_app.ts
export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,     // src/features/workflows/server/routers.ts
  credentials: credentialsRouter,  // src/features/credentials/server/routers.ts
  executions: executionsRouter,    // src/features/executions/server/routers.ts
  mcp: mcpRouter,                 // src/features/mcp/server/routers.ts
});

export type AppRouter = typeof appRouter;
// ☝️ This single line is the entire API contract.
//    Every client in the app imports this type.
```

**2. The middleware stack is composable and type-safe.**

You don't write auth checks in every handler. You pick the right procedure level:

```
┌──────────────────────────────────────────────────────────────────┐
│  PROCEDURE LEVELS                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  baseProcedure                                                   │
│  → Logging only. No auth required.                               │
│  → Use for: public health checks, landing page data              │
│                                                                  │
│  protectedProcedure                                              │
│  → Logging + auth. Session required.                             │
│  → Use for: reading workflows, viewing executions, MCP keys      │
│  → ctx.auth.user.id available                                    │
│                                                                  │
│  premiumProcedure                                                │
│  → Logging + auth + billing. Active subscription required.       │
│  → Use for: creating workflows, creating credentials             │
│  → ctx.auth.user.id + ctx.customer available                     │
│                                                                  │
│  Adding a new procedure that needs auth?                         │
│  Just use protectedProcedure. Auth + logging included.           │
│  No boilerplate. No forgotten auth checks.                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**3. Server Component prefetching just works.**

Next.js App Router with RSC (React Server Components) needs server-side data fetching. tRPC integrates cleanly:

```typescript
// Server Component: prefetch on the server
import { prefetch, trpc, HydrateClient } from "@/trpc/server";

export default async function WorkflowsPage() {
  await prefetch(trpc.workflows.getMany.queryOptions({ page: 1 }));
  // ☝️ Data is fetched on the server. Same type safety.
  //    Same procedure. Same middleware. Same validation.
  
  return (
    <HydrateClient>
      <WorkflowsList />  {/* Client component uses useSuspenseQuery */}
    </HydrateClient>
  );
}
```

The data flows: **Server prefetch → dehydrate → hydrate on client → no loading spinner on first render.** And the procedure that runs on the server is the exact same procedure the client would call. Same auth. Same validation. Same types.

---

## The Comparison Table (Honest Version)

| Dimension | REST | GraphQL | tRPC |
|---|---|---|---|
| **Type safety** | ❌ Manual (you maintain types separately) | ⚠️ With codegen (one more build step) | ✅ Automatic (inferred from server functions) |
| **Schema definition** | Implicit (your route IS the schema) | Explicit (`.graphql` files or code-first) | Implicit (Zod schemas on procedures) |
| **Client autocomplete** | ❌ None (`fetch` returns `any`) | ⚠️ After codegen | ✅ Immediate (auto-inferred from router type) |
| **Validation** | Manual (`parseInt`, `if (!x)`, etc.) | Built-in (schema-level) | Built-in (Zod — runtime + compile time) |
| **Middleware** | Manual per-route | Resolver-level plugins | Composable procedure chain |
| **Batching** | Manual (or custom) | Built-in | Built-in (`httpBatchLink`) |
| **Serialization** | JSON only (`Date` → string) | JSON only | superjson (`Date`, `Map`, `BigInt` survive) |
| **Server Components** | ⚠️ Works but no type sharing | ⚠️ Works but complex hydration | ✅ `createTRPCOptionsProxy` + `HydrationBoundary` |
| **Learning curve** | Low | High (schema + resolvers + codegen) | Medium (if you know TypeScript + Zod) |
| **External consumers** | ✅ Universal | ✅ Universal | ❌ TypeScript monorepo only |
| **OpenAPI / docs** | ✅ Swagger/OpenAPI | ✅ GraphQL Playground | ⚠️ Possible with plugins, not native |
| **Mobile clients** | ✅ Any language | ✅ Any language | ❌ TypeScript only |
| **Maturity** | Decades | ~10 years | ~4 years |

The bottom line: **tRPC is the best choice when you own both the client and server in a TypeScript monorepo. It's the wrong choice when you need external consumers or non-TypeScript clients.**

---

## What I Gained (The Real Benefits)

### 1. Refactoring Fearlessness

This is the #1 benefit, and it's hard to appreciate until you experience it.

I renamed a field in the workflow router from `totalCount` to `total`. Immediately, every component that referenced `totalCount` showed a TypeScript error. I fixed them in 30 seconds. With REST, I would have found this in production.

### 2. Zero API Documentation

There is no API documentation for a8n's internal API. There doesn't need to be. The types ARE the documentation. Hover over `trpc.workflows.getMany.queryOptions()` in your editor — you see the exact input shape and return type. No Swagger. No Postman collection. No stale docs.

### 3. Middleware Composition Eliminates Boilerplate

Before tRPC, I was writing this in every route handler:

```typescript
// ❌ This was in EVERY route
const session = await auth.api.getSession({ headers: await headers() });
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
const customer = await polarClient.customers.getStateExternal({ ... });
if (!customer.activeSubscriptions.length) return Response.json({ ... }, { status: 403 });
```

With tRPC, I write `premiumProcedure` once and never think about it again:

```typescript
// ✅ Auth + billing checked automatically
create: premiumProcedure.mutation(({ ctx }) => {
  // ctx.auth.user.id — guaranteed to exist
  // ctx.customer — guaranteed to have active subscription
  return prisma.workflow.create({ ... });
});
```

### 4. Structured Logging for Free

The logging middleware wraps every procedure automatically:

```json
{
  "component": "trpc",
  "event": "trpc_procedure_completed",
  "procedurePath": "workflows.getMany",
  "procedureType": "query",
  "durationMs": 42,
  "requestId": "req_abc123",
  "userId": "user_456"
}
```

Every procedure. Every call. No manual logging. No forgotten log statements.

### 5. superjson Solves the Date Problem

REST returns `Date` fields as ISO strings. You parse them back. With superjson, `Date` objects survive the serialization round-trip:

```typescript
// Server returns a Date
createdAt: workflow.createdAt  // Date object

// Client receives a Date
data.createdAt instanceof Date  // true ✅
// No manual parsing. No new Date(data.createdAt). Just works.
```

---

## Where tRPC Doesn't Work (And What I Used Instead)

tRPC isn't a universal API layer. Here's what I used for the things it can't do:

```
┌──────────────────────────────────────────────────────────────────┐
│  INTERFACE               PROTOCOL           WHY NOT tRPC?        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Dashboard UI            tRPC ✅             Perfect fit.        │
│  (React components)      4 routers,          Full type safety.   │
│                          20+ procedures                          │
│                                                                  │
│  MCP Server              MCP Protocol ✅     External AI clients │
│  (ChatGPT, Claude)       53 tools            (not TypeScript).   │
│                                              Needs: universal    │
│                                              standard, not       │
│                                              monorepo types.     │
│                                                                  │
│  OAuth Endpoints         REST ✅             OAuth 2.1 spec      │
│  (/authorize, /token)    Standard routes     requires specific   │
│                                              HTTP endpoints.     │
│                                                                  │
│  Webhook Receivers       REST ✅             Stripe, Google Form │
│  (/api/webhooks/*)       Standard routes     send raw HTTP POST. │
│                                              Can't use tRPC.     │
│                                                                  │
│  Inngest Functions       Inngest SDK ✅      Inngest has its own │
│  (durable execution)     Event-driven        transport and       │
│                                              function signing.   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**The rule:** tRPC for internal client-server communication. Standard protocols for everything external.

---

## The Trade-Offs (Honest Assessment)

### What I'd Warn You About

**1. You're locked into TypeScript on both sides.**

This isn't a problem for a8n (it's a Next.js monorepo). But if you ever need a Python service, a Go microservice, or a mobile app to call your API — tRPC can't help. You'll need a separate REST or GraphQL layer for external consumers.

**2. The ecosystem is smaller.**

REST has decades of tooling. GraphQL has Apollo, Relay, and a massive ecosystem. tRPC has a strong community but fewer battle-tested patterns for things like rate limiting, caching headers, and CDN integration.

**3. Testing requires the full TypeScript stack.**

You can't just `curl` a tRPC endpoint. You need a TypeScript test harness or the tRPC caller:

```typescript
// Server-side testing with createCaller
const caller = appRouter.createCaller(createTRPCContext);
const result = await caller.workflows.getMany({ page: 1 });
// ☝️ Works great. But you can't test with Postman or curl.
```

**4. Bundle size awareness.**

The tRPC client, React Query, and superjson add to your client bundle. For a SaaS dashboard like a8n, this is negligible. For a landing page, it's worth considering.

---

## The "I Wanted to Learn Something New" Factor

I'll be honest about one more motivation: **I wanted to try tRPC because it represents a genuinely new way of thinking about API design.**

REST is a protocol. GraphQL is a query language. tRPC is neither — it's a **type-level integration** between client and server. It doesn't add a protocol layer; it removes one.

That mental shift — from "I'm calling an API endpoint" to "I'm calling a function that happens to run on the server" — changed how I architect full-stack applications. The network boundary becomes invisible. And once it's invisible, you stop designing around it and start designing around the domain.

For a final year project, that learning was as valuable as the code I shipped.

---

## When to Choose What (Decision Guide)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  "Who calls your API?"                                           │
│       │                                                          │
│       ├── External consumers (mobile, partners, third-party)     │
│       │       │                                                  │
│       │       ├── Multiple clients needing different fields?      │
│       │       │       → GraphQL                                  │
│       │       │                                                  │
│       │       └── Standard CRUD? Simple contracts?               │
│       │               → REST + OpenAPI                           │
│       │                                                          │
│       └── Only my own TypeScript frontend?                       │
│               │                                                  │
│               ├── Monorepo (same codebase)?                      │
│               │       → tRPC ✅                                  │
│               │                                                  │
│               └── Separate repos?                                │
│                       → REST or GraphQL                          │
│                       (tRPC needs shared types, harder cross-repo)│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Final Thought

The best API layer is the one that disappears.

REST makes you think about endpoints, status codes, and serialization. GraphQL makes you think about schemas, resolvers, and query complexity. tRPC makes you think about... nothing. You just call the function.

For a full-stack TypeScript monorepo, that's exactly what you want.

For everything else — external consumers, non-TypeScript clients, protocol standards — REST and GraphQL still win. And that's fine. a8n uses all three: tRPC for the dashboard, MCP for AI clients, REST for webhooks and OAuth.

The right answer isn't "which technology is best." It's "which technology is best for this specific boundary."

---

*This is Part 4 of my a8n deep-dive series.*
*Part 1: "Building a workflow tool is harder than drawing nodes on a canvas."*
*Part 2: "The invisible engine that runs your workflow — Inngest and durable execution."*
*Part 3: "How MCP made a complex automation platform usable by everyone."*
*Next: How a8n handles encrypted credential management and multi-provider auth.*

*#trpc #typescript #nextjs #react #fullstack #systemdesign #graphql #rest #api #buildinpublic*
