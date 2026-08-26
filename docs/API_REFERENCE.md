# ðŸ”Œ API Reference

> **Last Updated:** April 2026  
> **Framework:** tRPC v11.16.0  
> **Transport:** HTTP batch link with SuperJSON transformer  
> **Endpoint:** `/api/trpc/[trpc]`

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Procedure Types](#procedure-types)
- [Router: workflows](#router-workflows)
- [Router: credentials](#router-credentials)
- [Router: executions](#router-executions)
- [Client Setup](#client-setup)
- [Server-Side Usage](#server-side-usage)
- [Error Handling](#error-handling)

---

## Architecture Overview

```mermaid
graph TD
    subgraph Client["Client Side"]
        useTRPC["useTRPC() hook"]
        TRPCProvider["TRPCReactProvider"]
        QueryClient["TanStack QueryClient"]
    end

    subgraph Transport["Transport"]
        BatchLink["httpBatchLink"]
        SuperJSON["SuperJSON transformer"]
    end

    subgraph Server["Server Side"]
        Handler["/api/trpc/[trpc]"]
        AppRouter["appRouter"]
        WR["workflowsRouter"]
        CR["credentialsRouter"]
        ER["executionsRouter"]
    end

    subgraph Middleware["Procedure Middleware"]
        Base["baseProcedure"]
        Protected["protectedProcedure<br/>â†’ ctx.auth"]
        Premium["premiumProcedure<br/>â†’ ctx.customer"]
    end

    useTRPC --> BatchLink
    TRPCProvider --> QueryClient
    BatchLink --> SuperJSON
    SuperJSON --> Handler
    Handler --> AppRouter
    AppRouter --> WR
    AppRouter --> CR
    AppRouter --> ER
    WR --> Protected
    WR --> Premium
    CR --> Protected
    CR --> Premium
    ER --> Protected
```

### Router Composition

```typescript
// src/trpc/routers/_app.ts
export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,    // 7 procedures
  credentials: credentialsRouter, // 6 procedures
  executions: executionsRouter,   // 2 procedures
});

export type AppRouter = typeof appRouter;
```

---

## Procedure Types

The tRPC layer defines three authorization tiers via middleware:

### `baseProcedure`

No authentication required. Currently unused â€” all endpoints require at least a session.

```typescript
export const baseProcedure = t.procedure;
```

### `protectedProcedure`

Requires a valid Better Auth session. Injects the session into context.

```typescript
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  return next({ ctx: { ...ctx, auth: session } });
});
```

**Context injected:** `ctx.auth` â€” `{ user: { id, name, email, ... }, session: { ... } }`

### `premiumProcedure`

Extends `protectedProcedure`. Requires an active Polar.sh subscription.

```typescript
export const premiumProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const customer = await polarClient.customers.getStateExternal({
    externalId: ctx.auth.user.id,
  });

  if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
  }

  return next({ ctx: { ...ctx, customer } });
});
```

**Context injected:** `ctx.customer` â€” Polar customer state with subscription details

---

## Router: `workflows`

**Source:** `src/features/workflows/server/routers.ts`  
**Procedures:** 7

### `workflows.create`

Creates a new workflow with a random slug name and an initial placeholder node.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `premiumProcedure` (Pro subscription required) |
| **Input** | None |
| **Returns** | `Workflow` object |

**Behavior:**
- Generates random name via `generateSlug(3)` (e.g., "happy-blue-dolphin")
- Creates an `INITIAL` type node at position `{ x: 0, y: 0 }`
- Scoped to `ctx.auth.user.id`

---

### `workflows.remove`

Deletes a workflow and all associated nodes, connections, and executions (cascade).

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | Deleted `Workflow` object |

**Validation:** User can only delete their own workflows (`userId` filter).

---

### `workflows.update`

Replaces the entire DAG (nodes + edges) for a workflow using a database transaction.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | See schema below |
| **Returns** | `Workflow` object |

**Input Schema:**
```typescript
z.object({
  id: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string().nullish(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.any()).optional(),
  })),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().nullish(),
    targetHandle: z.string().nullish(),
  })),
})
```

**Transaction Steps:**
1. **Server-side graph validation** — unique node IDs, edges reference existing nodes, no duplicate/self connections, no cycles, at least one trigger node, INITIAL placeholder exclusivity. Violations return `BAD_REQUEST`/`CONFLICT` with user-friendly messages.
2. Delete all existing nodes (cascades to connections)
3. Create new nodes (including relational `credentialId` when present in node data)
4. Create new connections
5. **Create a version snapshot** (`WorkflowVersion`, "Manual save") with 20-version retention
6. Update workflow timestamp

---

### `workflows.updateName`

Renames a workflow.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string, name: string }` â€” name must be non-empty |
| **Returns** | Updated `Workflow` object |

---

### `workflows.getOne`

Fetches a single workflow with its nodes and connections transformed into React Flow format.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | `{ id, name, nodes: Node[], edges: Edge[] }` |

**Response Transformation:**
```typescript
// Prisma Node â†’ React Flow Node
{ id, type: node.type, position: node.position, data: node.data }

// Prisma Connection â†’ React Flow Edge
{ id, source: fromNodeId, target: toNodeId, sourceHandle: fromOutput, targetHandle: toInput }
```

---

### `workflows.getMany`

Lists workflows with search and pagination.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ page?: number, pageSize?: number, search?: string }` |
| **Returns** | Paginated response (see below) |

**Input Defaults:**
| Param | Default | Range |
|---|---|---|
| `page` | `1` | â€” |
| `pageSize` | `5` | `1..100` |
| `search` | `""` | Case-insensitive name search |

**Response Shape:**
```typescript
{
  items: Workflow[],
  page: number,
  pageSize: number,
  totalCount: number,
  totalPages: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
}
```

---

### `workflows.execute`

Triggers workflow execution via Inngest.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | `Workflow` object |

**Behavior:**
1. Validates workflow exists and belongs to user
2. Calls `sendWorkflowExecution({ workflowId })` to dispatch Inngest event
3. Returns the workflow object (execution happens asynchronously)

---


### `workflows.setActive`

Activates or deactivates a workflow. Inactive workflows reject webhook dispatches with `409 Conflict` (manual execution remains allowed).

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string, active: boolean }` |
| **Returns** | `Workflow` object |

---

### `workflows.setWebhookSecret`

Stores an encrypted webhook secret on a trigger node (Stripe / Google Form). The plaintext secret is encrypted server-side and never returned; the encrypted value comes back so the canvas can persist it across saves. Webhook verification accepts this secret in addition to environment secrets.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ workflowId: string, nodeId: string, secret: string (max 512) }` |
| **Returns** | `{ ok: true, nodeId, webhookSecret /* ciphertext */ }` |

---

### `workflows.testNode`

Executes a single action node in isolation with mocked Inngest step tools (everything runs synchronously inside the request). Powers the "Test step" button in node configuration dialogs. Trigger nodes cannot be tested directly.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ type: NodeType, data: Record<string, unknown> }` |
| **Returns** | `{ ok: true, output: WorkflowContext }` or `{ ok: false, error: string }` |

---

### `workflows.getVersions`

Lists version-history snapshots for a workflow (newest first, max 20). Every manual save creates a snapshot.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ workflowId: string }` |
| **Returns** | `{ items: [{ id, name, summary, createdByTool, createdAt, nodeCount, edgeCount }], totalCount }` |

---

### `workflows.restoreVersion`

Restores a previous version's graph. The current state is auto-saved as a new version ("Auto-save before restore") first, so restores are reversible.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ workflowId: string, versionId: string }` |
| **Returns** | `Workflow` object |

**Errors:** `NOT_FOUND` (version missing), `BAD_REQUEST` (corrupt snapshot / invalid graph)

---

### `workflows.duplicate`

Deep-copies a workflow with fresh node IDs and remapped connections. The copy is named `"<name> (Copy)"`, starts inactive, and preserves credential links.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | new `Workflow` object |

## Router: `credentials`

**Source:** `src/features/credentials/server/routers.ts`  
**Procedures:** 6

### `credentials.create`

Creates a new encrypted credential.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `premiumProcedure` (Pro subscription required) |
| **Input** | `{ name: string, type: CredentialType, value: string }` |
| **Returns** | `Credential` object (with encrypted value) |

**Input Validation:**
- `name` â€” non-empty string
- `type` â€” must be one of `CredentialType` enum: `OPENAI`, `ANTHROPIC`, `GEMINI`
- `value` â€” non-empty string (the raw API key)

**Security:** The `value` is encrypted via `encrypt(value)` (AES-256) before storage. The raw key is never persisted.

---

### `credentials.remove`

Deletes a credential.

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | Deleted `Credential` object |

---

### `credentials.update`

Updates a credential (re-encrypts the value).

| Property | Value |
|---|---|
| **Type** | `mutation` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string, name: string, type: CredentialType, value: string }` |
| **Returns** | Updated `Credential` object |

**Security:** Value is re-encrypted on update via `encrypt(value)`.

---

### `credentials.getOne`

Fetches a single credential by ID.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | `Credential` object |

> **Note:** The returned `value` is still encrypted. Decryption only happens in executor functions at runtime.

---

### `credentials.getMany`

Lists credentials with search and pagination.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ page?: number, pageSize?: number, search?: string }` |
| **Returns** | Paginated response (same shape as `workflows.getMany`) |

---

### `credentials.getByType`

Fetches all credentials of a specific type (used in node configuration dropdowns).

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ type: CredentialType }` |
| **Returns** | `Credential[]` â€” ordered by `updatedAt` descending |

---

## Router: `executions`

**Source:** `src/features/executions/server/routers.ts`  
**Procedures:** 2

### `executions.getOne`

Fetches a single execution with its workflow name.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ id: string }` |
| **Returns** | `Execution` with `workflow: { id, name }` |

**Data Isolation:** Filters by `workflow.userId` to ensure users only see their own executions.

---

### `executions.getMany`

Lists executions with pagination.

| Property | Value |
|---|---|
| **Type** | `query` |
| **Auth** | `protectedProcedure` |
| **Input** | `{ page?: number, pageSize?: number }` |
| **Returns** | Paginated response with included `workflow: { id, name }` |

**Ordering:** Sorted by `startedAt` descending (most recent first).

---

## Client Setup

### Provider Configuration

```typescript
// src/trpc/client.tsx
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function TRPCReactProvider({ children }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(), // "/api/trpc" or auto-detected Vercel URL
        }),
      ],
    }),
  );
  
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

### Query Client Configuration

```typescript
// src/trpc/query-client.ts
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },              // 30s stale time
      dehydrate: { serializeData: superjson.serialize },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}
```

### Client Usage (React Hooks)

```typescript
// Query
const trpc = useTRPC();
const { data } = useSuspenseQuery(trpc.workflows.getMany.queryOptions({ page: 1 }));

// Mutation
const mutation = useMutation(trpc.workflows.create.mutationOptions({
  onSuccess: (data) => toast.success(`Created: ${data.name}`),
}));
mutation.mutate();
```

### Custom Data Hooks

The codebase wraps tRPC calls in custom hooks for reusability:

```typescript
// src/features/workflows/hooks/use-workflows.ts
export const useSuspenseWorkflows = () => {
  const trpc = useTRPC();
  const [params] = useWorkflowsParams();
  return useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(trpc.workflows.create.mutationOptions({
    onSuccess: (data) => {
      toast.success(`Workflow "${data.name}" created`);
      queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
    },
  }));
};
```

---

## Server-Side Usage

### SSR Prefetching

Server Components pre-fetch data so pages load instantly:

```typescript
// src/trpc/server.tsx
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = appRouter.createCaller(createTRPCContext);

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(queryOptions);
}

export function HydrateClient({ children }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
```

### Prefetching Pattern

```typescript
// Server Component (page.tsx)
import { prefetch, HydrateClient, trpc } from "@/trpc/server";

export default async function WorkflowsPage() {
  prefetch(trpc.workflows.getMany.queryOptions({ page: 1 }));
  
  return (
    <HydrateClient>
      <WorkflowsList />  {/* Client component uses useSuspenseQuery */}
    </HydrateClient>
  );
}
```

### Direct Server Caller

For cases where you need to call tRPC directly (not through React):

```typescript
const workflows = await caller.workflows.getMany({ page: 1 });
```

---

## Error Handling

### tRPC Error Codes

| Code | HTTP Status | Used When |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid session (`protectedProcedure`) |
| `FORBIDDEN` | 403 | No active subscription (`premiumProcedure`) |
| `NOT_FOUND` | 404 | `findUniqueOrThrow` fails (Prisma) |
| `BAD_REQUEST` | 400 | Zod validation fails (auto) |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server errors |

### Client-Side Error Handling

```typescript
const mutation = useMutation(trpc.workflows.create.mutationOptions({
  onError: (error) => {
    if (error.data?.code === "FORBIDDEN") {
      // Show upgrade modal
    } else {
      toast.error(error.message);
    }
  },
}));
```

---

## Quick Reference

### All Procedures

| Router | Procedure | Type | Auth | Input |
|---|---|---|---|---|
| `workflows` | `create` | mutation | premium | â€” |
| `workflows` | `remove` | mutation | protected | `{ id }` |
| `workflows` | `update` | mutation | protected | `{ id, nodes[], edges[] }` |
| `workflows` | `updateName` | mutation | protected | `{ id, name }` |
| `workflows` | `getOne` | query | protected | `{ id }` |
| `workflows` | `getMany` | query | protected | `{ page?, pageSize?, search? }` |
| `workflows` | `execute` | mutation | protected | `{ id }` — quota consumed once at dispatch |
| `workflows` | `setActive` | mutation | protected | `{ id, active }` |
| `workflows` | `setWebhookSecret` | mutation | protected | `{ workflowId, nodeId, secret }` |
| `workflows` | `testNode` | mutation | protected | `{ type, data }` |
| `workflows` | `getVersions` | query | protected | `{ workflowId }` |
| `workflows` | `restoreVersion` | mutation | protected | `{ workflowId, versionId }` |
| `workflows` | `duplicate` | mutation | protected | `{ id }` |
| `credentials` | `create` | mutation | premium | `{ name, type, value }` |
| `credentials` | `remove` | mutation | protected | `{ id }` |
| `credentials` | `update` | mutation | protected | `{ id, name, type, value? }` — re-encrypts only when `value` provided |
| `credentials` | `getOne` | query | protected | `{ id }` — ciphertext never returned |
| `credentials` | `getMany` | query | protected | `{ page?, pageSize?, search? }` |
| `credentials` | `getByType` | query | protected | `{ type }` |
| `executions` | `getOne` | query | protected | `{ id }` — includes `nodeRuns[]` timeline |
| `executions` | `getMany` | query | protected | `{ page?, pageSize? }` |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) â€” API layer in the system architecture
- [DATABASE.md](./DATABASE.md) â€” Underlying data models
- [AUTHENTICATION.md](./AUTHENTICATION.md) â€” Session and authorization details
- [STATE_AND_DATA_FLOW.md](./STATE_AND_DATA_FLOW.md) â€” Client-side data fetching patterns
