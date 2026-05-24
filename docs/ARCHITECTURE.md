# 🏗️ Architecture

> **Last Updated:** April 2026  
> **Status:** Living document — updated as the architecture evolves

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Components](#system-components)
- [Layer Diagram](#layer-diagram)
- [Request Lifecycle](#request-lifecycle)
- [Workflow Execution Lifecycle](#workflow-execution-lifecycle)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [Design Principles](#design-principles)

---

## Architecture Overview

a8n is a **full-stack monolithic application** built on Next.js 16 (App Router). It follows a layered architecture with clear separation between the presentation layer, API layer, execution engine, and data layer.

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        Browser["Browser"]
        ReactFlow["React Flow Editor"]
        ShadcnUI["shadcn/ui Components"]
    end

    subgraph NextJS["⚡ Next.js App Router"]
        RSC["Server Components"]
        RCC["Client Components"]
        API["API Routes"]
    end

    subgraph APILayer["🔌 API Layer"]
        tRPC["tRPC Routers"]
        MCP["MCP Server /api/mcp"]
        AuthAPI["Better Auth Handler"]
        WebhookAPI["Webhook Handlers"]
    end

    subgraph Engine["⚙️ Execution Engine"]
        Inngest["Inngest Functions"]
        Channels["Realtime Channels"]
        Executor["Executor Registry"]
    end

    subgraph Data["💾 Data Layer"]
        Prisma["Prisma ORM"]
        Neon["Neon PostgreSQL"]
    end

    subgraph External["🌐 External Services"]
        OAuth["GitHub / Google OAuth"]
        Polar["Polar.sh Billing"]
        AIAPIs["OpenAI / Anthropic / Gemini"]
        Integrations["Discord / Slack"]
    end

    Browser --> RSC
    Browser --> RCC
    RCC --> tRPC
    RSC --> Prisma
    API --> AuthAPI
    API --> tRPC
    API --> MCP
    API --> WebhookAPI
    MCP --> Prisma
    MCP --> Inngest
    tRPC --> Prisma
    tRPC --> Inngest
    WebhookAPI --> Inngest
    Inngest --> Executor
    Executor --> Prisma
    Executor --> AIAPIs
    Executor --> Integrations
    Inngest --> Channels
    Channels --> Browser
    Prisma --> Neon
    AuthAPI --> OAuth
    AuthAPI --> Polar
    AuthAPI --> Prisma
```

---

## System Components

### 1. Web Application Layer (Next.js App Router)

The frontend is a Next.js 16 application using the **App Router** with React Server Components (RSC) for data fetching and Client Components for interactivity.

**Route Group Architecture:**

```mermaid
graph TD
    Root["/ (Root Layout)"]
    Root --> Auth["(auth) — Auth Layout"]
    Root --> Dashboard["(dashboard) — Sidebar Layout"]
    
    Auth --> Login["/login"]
    Auth --> Signup["/signup"]
    
    Dashboard --> Rest["(rest) — Header + Content Layout"]
    Dashboard --> Editor["(editor) — Full-Screen Editor"]
    
    Rest --> Workflows["/workflows"]
    Rest --> Credentials["/credentials"]
    Rest --> Executions["/executions"]
    
    Editor --> WorkflowEditor["/workflows/:id — React Flow Canvas"]
```

| Route Group | Purpose | Layout Components |
|---|---|---|
| `(auth)` | Login and signup pages | `AuthLayout` — centered card |
| `(dashboard)/(rest)` | CRUD listing pages | `SidebarProvider` + `AppSidebar` + `AppHeader` |
| `(dashboard)/(editor)` | Visual workflow editor | `SidebarProvider` + `AppSidebar` + full-screen canvas |

**Root Layout Provider Stack:**
```
<html>
  <body>
    <TRPCReactProvider>       ← tRPC client + TanStack Query
      <NuqsAdapter>           ← URL search params state
        <JotaiProvider>        ← Atomic client state
          {children}
          <Toaster />          ← Toast notifications (Sonner)
        </JotaiProvider>
      </NuqsAdapter>
    </TRPCReactProvider>
  </body>
</html>
```

### 2. API Layer

The API layer consists of three distinct systems, each serving a different purpose:

```mermaid
graph LR
    subgraph Routes["API Routes (/api)"]
        tRPC["/api/trpc/[trpc]<br/>tRPC Handler"]
        Auth["/api/auth/[...all]<br/>Better Auth"]
        InngestRoute["/api/inngest<br/>Inngest Serve"]
        Webhooks["/api/webhooks/*<br/>External Webhooks"]
    end
```

| Route | Handler | Purpose |
|---|---|---|
| `/api/trpc/[trpc]` | `fetchRequestHandler` | tRPC procedure calls (queries + mutations) |
| `/api/auth/[...all]` | `toNextJsHandler(auth)` | Better Auth — login, signup, session, OAuth callbacks |
| `/api/inngest` | `serve({ client, functions })` | Inngest function registration and invocation endpoint |
| `/api/webhooks/stripe` | Custom `POST` handler | Stripe webhook events → workflow execution |
| `/api/webhooks/google-form` | Custom `POST` handler | Google Forms submissions → workflow execution |

**tRPC Router Composition:**

```mermaid
graph TD
    AppRouter["appRouter"]
    AppRouter --> WR["workflows<br/>(workflowsRouter)"]
    AppRouter --> CR["credentials<br/>(credentialsRouter)"]
    AppRouter --> ER["executions<br/>(executionsRouter)"]
    
    WR --> |"7 procedures"| WRProcs["create, remove, update,<br/>updateName, getOne, getMany, execute"]
    CR --> |"6 procedures"| CRProcs["create, remove, update,<br/>getOne, getMany, getByType"]
    ER --> |"2 procedures"| ERProcs["getOne, getMany"]
```

**Procedure Authorization Tiers:**

```
baseProcedure          → No auth required (unused currently)
    │
    ▼
protectedProcedure     → Session required (Better Auth)
    │                     Injects: ctx.auth (session + user)
    ▼
premiumProcedure       → Active Polar subscription required
                          Injects: ctx.customer (Polar state)
```

### 3. Workflow Execution Engine (Inngest)

The execution engine is the heart of a8n. It uses **Inngest** for durable, event-driven workflow execution with automatic retries and realtime status streaming.

→ See [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md) for the complete deep-dive.

**Engine Architecture:**

```mermaid
graph TD
    Trigger["Trigger Event<br/>(tRPC mutation / webhook)"]
    
    Trigger --> Event["inngest.send()<br/>workflows/execute.workflow"]
    
    Event --> CreateExec["Step 1: create-execution<br/>Persist execution record"]
    CreateExec --> PrepareWF["Step 2: prepare-workflow<br/>Fetch nodes + topological sort"]
    PrepareWF --> FindUser["Step 3: find-user-id<br/>Resolve workflow owner"]
    
    FindUser --> Loop["Step 4: Node Execution Loop"]
    
    Loop --> Registry["Executor Registry<br/>NodeType → NodeExecutor"]
    Registry --> ExecNode["Execute Node<br/>(with Inngest step durability)"]
    ExecNode --> |"context chain"| Loop
    ExecNode --> Publish["Realtime Publish<br/>(per-node channel)"]
    
    Loop --> |"all nodes done"| UpdateExec["Step 5: update-execution<br/>Mark SUCCESS + persist output"]
    
    Loop --> |"error"| OnFailure["onFailure Handler<br/>Mark FAILED + persist error"]
```

**Key Design Decisions:**
- **Durability**: Each step is individually retryable — if step 3 fails, steps 1-2 don't re-execute
- **Topological Sort**: Nodes execute in dependency order (upstream → downstream)
- **Context Chain**: Each node's output becomes the next node's input context
- **Realtime**: 9 dedicated channels publish node-level execution progress to the browser

### 4. Data Layer

The data layer uses **Prisma v7** with the **Neon serverless adapter** for HTTP-based PostgreSQL connections.

**Connection Architecture:**

```
Application Code
    │
    ▼
Prisma Client (singleton)
    │
    ▼
PrismaNeon Adapter
    │ (HTTP-based, no persistent TCP connection)
    ▼
Neon PostgreSQL (Serverless)
    │ (connection pooling, auto-scaling)
    ▼
PostgreSQL Database
```

**Singleton Pattern (Hot Reload Safe):**
```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

This prevents creating multiple Prisma Client instances during Next.js hot module replacement in development.

→ See [DATABASE.md](./DATABASE.md) for complete schema documentation and ERD.

### 5. Authentication Layer

**Better Auth** provides a unified authentication system with a server/client architecture:

```mermaid
graph LR
    subgraph Server
        AuthServer["auth (Better Auth)"]
        PrismaAdapter["Prisma Adapter"]
        PolarPlugin["Polar Plugin"]
    end
    
    subgraph Client
        AuthClient["authClient (React)"]
        PolarClientPlugin["Polar Client Plugin"]
    end
    
    subgraph Middleware
        Protected["protectedProcedure"]
        Premium["premiumProcedure"]
    end
    
    AuthClient --> |"HTTP"| AuthServer
    AuthServer --> PrismaAdapter
    AuthServer --> PolarPlugin
    PolarPlugin --> |"API"| PolarService["Polar.sh"]
    
    Protected --> |"getSession()"| AuthServer
    Premium --> |"getStateExternal()"| PolarService
```

→ See [AUTHENTICATION.md](./AUTHENTICATION.md) for the complete auth documentation.

### 6. Billing Layer

Subscription billing is deeply integrated through the **Polar.sh Better Auth plugin**:

- **Automatic Customer Sync**: Users are created as Polar customers on signup (`createCustomerOnSignUp: true`)
- **Checkout Flow**: `authClient.checkout({ slug: "pro" })` → Polar hosted checkout → redirect to success URL
- **Portal Access**: `authClient.customer.portal()` → Polar billing portal for subscription management
- **Premium Gating**: `premiumProcedure` checks `polarClient.customers.getStateExternal()` for active subscriptions

---

## Request Lifecycle

### Standard Page Load (Server-Side Rendering)

```mermaid
sequenceDiagram
    participant B as Browser
    participant RSC as Server Component
    participant tRPC as tRPC Server Caller
    participant Prisma as Prisma Client
    participant DB as Neon PostgreSQL

    B->>RSC: GET /workflows
    RSC->>RSC: requireAuth() — validate session
    RSC->>tRPC: prefetch(trpc.workflows.getMany.queryOptions())
    tRPC->>tRPC: protectedProcedure middleware
    tRPC->>Prisma: workflow.findMany()
    Prisma->>DB: SQL Query
    DB-->>Prisma: Result rows
    Prisma-->>tRPC: Typed workflow objects
    tRPC-->>RSC: Hydration data
    RSC->>RSC: HydrateClient wraps children
    RSC-->>B: SSR HTML + serialized query cache
    B->>B: React hydration + TanStack Query reuse
```

### Client-Side tRPC Mutation

```mermaid
sequenceDiagram
    participant B as Browser
    participant Client as tRPC Client
    participant API as /api/trpc
    participant Router as tRPC Router
    participant Prisma as Prisma Client
    participant DB as Neon PostgreSQL

    B->>Client: trpc.workflows.create.mutate()
    Client->>API: HTTP POST (batched, SuperJSON)
    API->>Router: premiumProcedure check
    Router->>Router: Validate session + subscription
    Router->>Prisma: workflow.create()
    Prisma->>DB: INSERT
    DB-->>Prisma: New workflow
    Prisma-->>Router: Typed result
    Router-->>API: SuperJSON response
    API-->>Client: HTTP response
    Client-->>B: TanStack Query cache update
```

---

## Workflow Execution Lifecycle

The complete lifecycle from user click to execution completion:

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant tRPC as tRPC Router
    participant Inngest as Inngest
    participant Engine as Execute Function
    participant Exec as Executor
    participant DB as Database
    participant RT as Realtime Channel
    participant AI as AI API

    U->>tRPC: workflows.execute({ id })
    tRPC->>Inngest: inngest.send("workflows/execute.workflow")
    Inngest->>Engine: Trigger executeWorkflow function
    
    Engine->>DB: Step 1 — Create Execution record
    Engine->>DB: Step 2 — Fetch workflow + nodes + connections
    Engine->>Engine: Topological sort (DAG ordering)
    Engine->>DB: Step 3 — Resolve user ID
    
    loop For each node in sorted order
        Engine->>Exec: getExecutor(node.type)
        Exec->>AI: Call external API (if AI node)
        AI-->>Exec: API response
        Exec->>RT: publish() status to channel
        RT-->>U: Realtime event (SSE)
        Exec-->>Engine: Updated context
    end
    
    Engine->>DB: Step 5 — Update execution (SUCCESS + output)
```

---

## MCP Server (AI Client API)

a8n exposes a **Model Context Protocol** server at `/api/mcp` for AI-powered clients (Cursor, Claude Desktop, MCP Inspector). It provides 22 tools, 4 resources, and 3 prompts for workflow automation.

| Property | Value |
|---|---|
| Transport | Streamable HTTP (stateless) |
| Auth | Bearer token (scoped API keys or session) |
| Module | `src/mcp/` |
| Route | `src/app/api/mcp/route.ts` |

The MCP layer runs parallel to tRPC — tools call Prisma and Inngest directly rather than through tRPC routers. See [mcp/README.md](./mcp/README.md) for full documentation.

---

## Security Architecture

### Defense Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Authentication (Better Auth)                  │
│  ├── Session token validation                           │
│  ├── OAuth flow (PKCE for GitHub/Google)                │
│  └── CSRF protection (built-in)                         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Authorization (tRPC Middleware)                │
│  ├── protectedProcedure — session required              │
│  └── premiumProcedure — active subscription required    │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Data Isolation (Row-Level Filtering)          │
│  ├── All queries include: userId: ctx.auth.user.id      │
│  └── Users can only access their own resources          │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Credential Encryption (AES-256)               │
│  ├── API keys encrypted at rest via Cryptr              │
│  └── Decrypted only at execution time                   │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Input Validation (Zod)                        │
│  ├── tRPC input schemas validated on every request       │
│  └── Prisma enums enforce valid node/credential types   │
└─────────────────────────────────────────────────────────┘
```

### Key Security Patterns

| Pattern | Implementation |
|---|---|
| **Session Management** | Better Auth sessions stored in DB with token, IP, user agent |
| **Data Isolation** | Every Prisma query filtered by `userId` — no cross-tenant access |
| **Credential Security** | API keys encrypted with AES-256 (Cryptr) before DB storage |
| **Input Validation** | Zod schemas on every tRPC procedure input |
| **Webhook Verification** | Webhook endpoints validate `workflowId` parameter presence |
| **Auth Guard** | `requireAuth()` utility redirects unauthenticated users server-side |

---

## Design Principles

### 1. Feature-Based Modular Architecture

Code is organized by **business domain**, not technical layer. Each feature module is self-contained with its own components, hooks, server logic, and types.

```
features/workflows/
├── components/     # UI
├── hooks/          # Data hooks
├── server/         # tRPC router + prefetch
├── params.ts       # URL state
└── types.ts        # TypeScript types
```

> **Rationale**: When a developer needs to modify "workflows", they find everything in one directory — not scattered across `components/`, `services/`, `models/`, etc.

### 2. Server/Client Component Boundary

The architecture strictly separates server and client concerns:

- **Server Components**: Data fetching, access control, SEO, layout
- **Client Components**: Interactivity, real-time updates, forms, editor canvas

The `"use client"` directive is applied at the leaf level — components are server-rendered by default and only opt into client mode when interactivity is required.

### 3. End-to-End Type Safety

Types flow from the database schema through the API to the UI without manual type definitions:

```
Prisma Schema → Generated Types → tRPC Router → tRPC Client → React Component
     ↑                                                              ↓
     └── Single source of truth                 AutoComplete + type errors
```

### 4. Event-Driven Execution

Workflow execution is **asynchronous and event-driven**, not synchronous request-response:

```
Request: "Execute this workflow" → Response: "OK, queued" (fast)
Background: Inngest processes steps with durability, retries, and realtime updates
```

> **Rationale**: Workflows can take seconds to minutes (AI API calls, HTTP requests). Synchronous execution would block the user and risk timeouts.

### 5. Progressive Enhancement

The application uses Next.js App Router patterns for optimal user experience:

- **Server-side prefetching** → instant page loads (no loading spinners on navigation)
- **Suspense boundaries** → streaming SSR for slow data
- **URL state (nuqs)** → shareable, bookmarkable page state
- **Optimistic updates** → responsive UI during mutations

---

## Related Documentation

- [TECH_STACK.md](./TECH_STACK.md) — Detailed technology choices and rationale
- [DATABASE.md](./DATABASE.md) — Schema reference and entity relationships
- [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md) — Execution engine deep-dive
- [API_REFERENCE.md](./API_REFERENCE.md) — tRPC procedures and schemas
- [AUTHENTICATION.md](./AUTHENTICATION.md) — Auth system and authorization
- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — Component patterns
- [STATE_AND_DATA_FLOW.md](./STATE_AND_DATA_FLOW.md) — State management
