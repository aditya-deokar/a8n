# 🧰 Technology Stack

> **Last Updated:** April 2026  
> **Status:** Living document — updated when dependencies change

---

## Table of Contents

- [Stack at a Glance](#stack-at-a-glance)
- [Framework & Runtime](#framework--runtime)
- [Backend & API](#backend--api)
- [Database](#database)
- [Authentication](#authentication)
- [Payments & Billing](#payments--billing)
- [Frontend Libraries](#frontend-libraries)
- [Styling](#styling)
- [Utilities](#utilities)
- [Development Tooling](#development-tooling)

---

## Stack at a Glance

| Category | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js | 16.2.2 | Full-stack React framework (App Router) |
| **UI Library** | React | 19.2.4 | Component-based UI with Server Components |
| **Language** | TypeScript | 6.x | Static typing with strict mode |
| **API Layer** | tRPC | 11.16.0 | End-to-end type-safe RPC |
| **Database** | Neon PostgreSQL | — | Serverless PostgreSQL |
| **ORM** | Prisma | 7.7.0 | Type-safe database client |
| **Auth** | Better Auth | 1.6.0 | Lightweight authentication |
| **Billing** | Polar.sh | 0.47.0 | Subscription management |
| **Execution Engine** | Inngest | 4.2.0 | Durable event-driven functions |
| **Workflow Editor** | React Flow (XYFlow) | 12.10.2 | Interactive DAG graph editor |
| **UI Components** | shadcn/ui (Radix) | — | 53 accessible UI primitives |
| **State (Server)** | TanStack Query | 5.96.2 | Server state + caching |
| **State (Client)** | Jotai | 2.19.1 | Atomic client state |
| **State (URL)** | nuqs | 2.8.9 | Type-safe URL parameters |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Validation** | Zod | 4.3.6 | Runtime schema validation |
| **Package Manager** | pnpm | — | Fast, disk-efficient packages |

---

## Framework & Runtime

### Next.js 16 (App Router)

```
Package: next@16.2.2
```

Next.js serves as the full-stack framework, providing both the frontend rendering pipeline and the serverless API layer.

**Why Next.js 16 specifically:**

| Feature | Benefit |
|---|---|
| **App Router** | File-system routing with layouts, nested routes, route groups, and parallel routes |
| **React Server Components** | Server-rendered by default — smaller client bundles, direct database access |
| **React Compiler** | Automatic memoization — enabled via `reactCompiler: true` in config |
| **Turbopack** | Fast dev server with incremental compilation |
| **Streaming SSR** | Progressive page rendering with Suspense boundaries |
| **API Routes** | Serverless function endpoints for auth, tRPC, Inngest, and webhooks |

**Configuration Highlights** (`next.config.ts`):
```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,       // Automatic memoization (React Compiler)
  turbopack: { root: "." },  // Turbopack dev server
  async redirects() {
    return [{ source: "/", destination: "/workflows", permanent: false }];
  }
};
```

**Alternatives Considered:**
- **Pages Router** — Lacks layouts, route groups, and Server Components. The App Router is the future of Next.js.
- **Remix** — Strong patterns but smaller ecosystem. Next.js has better Vercel integration and community.
- **Vite + React Router** — No SSR out of the box; would require separate backend.

---

### React 19

```
Packages: react@19.2.4, react-dom@19.2.4
```

React 19 enables Server Components and concurrent features used throughout the application.

**Key Features Used:**
- **Server Components** — Default for layouts and data-fetching pages
- **`use` hook** — For reading promises and context in Server Components
- **Suspense** — Streaming boundaries for async data loading
- **React Compiler compatibility** — Automatic memoization without `useMemo`/`useCallback`

---

### TypeScript 6

```
Package: typescript@^6
Target: ES2017 | Module: ESNext | Strict: true
```

TypeScript is configured in strict mode with path aliases for clean imports:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

This strict configuration catches null-safety issues and ensures type correctness across the entire codebase — from Prisma types through tRPC to React components.

---

## Backend & API

### tRPC v11

```
Packages: @trpc/server@^11.16.0, @trpc/client@^11.16.0, @trpc/tanstack-react-query@^11.16.0
```

tRPC provides end-to-end type safety without code generation. Change a server procedure's return type and TypeScript immediately catches all client-side incompatibilities.

**Why tRPC over alternatives:**

| Approach | Trade-off |
|---|---|
| **REST** | No automatic type safety — requires manual type definitions or codegen (e.g., OpenAPI) |
| **GraphQL** | Powerful but heavy — requires schema definition, codegen, resolvers. Over-engineered for a single-client app |
| **tRPC** | ✅ Zero codegen, instant type inference, middleware support, batch requests |

**Architecture Pattern:**

```
Procedure Middleware Stack:
  baseProcedure → protectedProcedure → premiumProcedure
                       ↓                      ↓
                  session check          subscription check

Data Transformer: SuperJSON (supports Date, BigInt, Map, Set serialization)
Transport: httpBatchLink (multiple procedures batched into single HTTP request)
```

**Three-Tier Procedure System:**
1. `baseProcedure` — Public (currently unused)
2. `protectedProcedure` — Requires valid Better Auth session → injects `ctx.auth`
3. `premiumProcedure` — Extends protected + requires active Polar subscription → injects `ctx.customer`

→ See [API_REFERENCE.md](./API_REFERENCE.md) for complete procedure documentation.

---

### Inngest v4

```
Packages: inngest@^4.2.0, @inngest/realtime@^0.4.7, inngest-cli@^1.17.9 (dev)
```

Inngest is the **workflow execution engine** — providing durable, event-driven function execution with automatic retries, step-level recovery, and realtime progress streaming.

**Why Inngest over alternatives:**

| Approach | Trade-off |
|---|---|
| **Synchronous API calls** | Workflows can take minutes (AI calls) — would block requests and risk timeouts |
| **Bull/BullMQ** | Requires self-hosted Redis, manual retry logic, no built-in step functions |
| **Temporal** | Powerful but complex — heavy infrastructure, steep learning curve |
| **AWS Step Functions** | Vendor lock-in, JSON-based workflow definition |
| **Inngest** | ✅ Serverless, durable steps, automatic retries, realtime channels, no infra to manage |

**Key Capabilities Used:**

| Feature | Usage in Nodebase |
|---|---|
| **Step Functions** | Each workflow step (create-execution, prepare, execute nodes) is individually retryable |
| **Event Triggers** | `workflows/execute.workflow` event triggers the main function |
| **Realtime Channels** | 9 channels (one per node type) stream execution progress to the browser |
| **Failure Handlers** | `onFailure` callback marks executions as `FAILED` with error details |
| **Conditional Retries** | 3 retries in production, 0 in development |

→ See [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md) for the complete execution engine documentation.

---

### Prisma v7

```
Packages: prisma@^7.7.0, @prisma/client@^7.7.0, @prisma/adapter-neon@^7.7.0
```

Prisma provides a type-safe database client with auto-generated TypeScript types from the schema.

**Why Prisma:**
- **Generated types** flow directly into tRPC routers — no manual type definitions
- **Relation queries** with `include` and `select` are fully typed
- **Migration system** for schema evolution
- **Neon adapter** for serverless PostgreSQL (HTTP-based, no persistent connections)

**Configuration:**
```typescript
// prisma.config.ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
});

// Generated client output to src/generated/prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

→ See [DATABASE.md](./DATABASE.md) for the complete schema reference.

---

## Database

### Neon PostgreSQL (Serverless)

```
Package: @neondatabase/serverless@^1.0.2
Adapter: @prisma/adapter-neon@^7.7.0
```

Neon provides **serverless PostgreSQL** with automatic connection pooling and scaling — ideal for Vercel serverless functions.

**Why Neon over alternatives:**

| Approach | Trade-off |
|---|---|
| **Self-hosted PostgreSQL** | Requires ops, no auto-scaling, persistent connections exhaust limits in serverless |
| **Supabase** | Good but bundles auth/storage/realtime — we only need the database |
| **PlanetScale (MySQL)** | No foreign keys (vitess), no PostgreSQL features |
| **Neon** | ✅ Serverless PostgreSQL, HTTP driver, connection pooling, branching for preview deployments |

**Connection Pattern:**
```typescript
import { PrismaNeon } from "@prisma/adapter-neon";
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });
```

The `PrismaNeon` adapter uses **HTTP-based connections** (not TCP), which is critical for serverless environments where persistent connections aren't viable.

---

## Authentication

### Better Auth v1.6

```
Packages: better-auth@^1.6.0, @polar-sh/better-auth@^1.8.3
```

Better Auth is a lightweight, plugin-based authentication library that integrates directly with Prisma.

**Why Better Auth over alternatives:**

| Approach | Trade-off |
|---|---|
| **NextAuth (Auth.js)** | Complex configuration, frequent breaking changes, adapter issues |
| **Clerk** | External service dependency, pricing at scale, vendor lock-in |
| **Auth0** | Enterprise pricing, external redirect flow |
| **Better Auth** | ✅ Self-hosted, plugin ecosystem, Prisma adapter, lightweight, full control |

**Configured Providers:**
1. **Email/Password** — With auto sign-in on registration
2. **GitHub OAuth** — Social login
3. **Google OAuth** — Social login

**Plugin Integration:**
- `polar()` plugin — Syncs users as Polar customers on signup
- `checkout()` — Handles subscription checkout flow
- `portal()` — Provides billing portal access

→ See [AUTHENTICATION.md](./AUTHENTICATION.md) for the complete auth documentation.

---

## Payments & Billing

### Polar.sh SDK

```
Packages: @polar-sh/sdk@^0.47.0, @polar-sh/better-auth@^1.8.3
```

Polar.sh handles subscription billing with a developer-friendly, open-source-oriented approach.

**Why Polar over alternatives:**

| Approach | Trade-off |
|---|---|
| **Stripe Billing** | Complex webhook handling, overkill for a single product |
| **Lemon Squeezy** | Limited API, MoR model adds complexity |
| **Polar.sh** | ✅ Better Auth plugin, simple checkout flow, billing portal, open-source friendly |

**Integration Pattern:**
- **Server**: Polar SDK configured with access token, sandbox mode
- **Auth Plugin**: `@polar-sh/better-auth` creates customers on signup
- **Client**: `authClient.checkout()` and `authClient.customer.portal()` for billing UI
- **tRPC**: `premiumProcedure` checks `polarClient.customers.getStateExternal()` for active subscriptions

---

## Frontend Libraries

### React Flow (XYFlow v12)

```
Package: @xyflow/react@^12.10.2
```

React Flow powers the **visual workflow editor** — the core UI of the platform. Users drag and drop nodes, connect them with edges, and create DAG workflows.

**Features Used:**
- Custom node types (10 registered node components)
- Custom handles (input/output connection points)
- Snap-to-grid (10px grid)
- MiniMap for overview navigation
- Controls for zoom/fit
- Panel components for toolbar buttons
- `applyNodeChanges` / `applyEdgeChanges` for state management

**Node Component Registry:**
```typescript
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTrigger,
  [NodeType.STRIPE_TRIGGER]: StripeTriggerNode,
  [NodeType.GEMINI]: GeminiNode,
  [NodeType.OPENAI]: OpenAiNode,
  [NodeType.ANTHROPIC]: AnthropicNode,
  [NodeType.DISCORD]: DiscordNode,
  [NodeType.SLACK]: SlackNode,
} as const satisfies NodeTypes;
```

---

### shadcn/ui (53 Components)

```
Configuration: components.json — Style: "new-york", RSC: true, Base: "gray"
Dependencies: Radix UI primitives, Lucide React icons
```

shadcn/ui provides **53 accessible, customizable UI components** — copy-pasted into the project (not installed as a package) for full control.

**Component Categories:**

| Category | Components |
|---|---|
| **Data Display** | Table, Card, Badge, Avatar, Carousel, Chart (Recharts) |
| **Input** | Input, Textarea, Select, Checkbox, Switch, Slider, RadioGroup, Calendar |
| **Navigation** | Sidebar, NavigationMenu, Breadcrumb, Tabs, Menubar, Pagination |
| **Overlay** | Dialog, Sheet, Drawer, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu |
| **Feedback** | Alert, AlertDialog, Sonner (toast), Progress, Skeleton, Spinner |
| **Layout** | Separator, Accordion, Collapsible, ResizablePanel, ScrollArea, AspectRatio |
| **Forms** | Form, Field, Label, InputOTP, InputGroup, ButtonGroup, Command |

---

### Jotai v2

```
Package: jotai@^2.19.1
```

Jotai is used for **atomic client-side state** — specifically for the React Flow editor instance.

```typescript
// Single atom for the editor instance
export const editorAtom = atom<ReactFlowInstance | null>(null);
```

**Why Jotai over alternatives:**
- **Zustand** — More boilerplate for simple atoms; Jotai's atom-based model fits the minimal state needs
- **Redux** — Way too heavy for a single editor atom
- **Context** — Causes unnecessary re-renders; Jotai provides fine-grained subscriptions

---

### TanStack Query v5 (via tRPC)

```
Packages: @tanstack/react-query@^5.96.2, @trpc/tanstack-react-query@^11.16.0
```

TanStack Query manages **server state** — all remote data fetching, caching, and synchronization is handled through tRPC's TanStack Query integration.

**Key Patterns:**
- `useTRPC` — Type-safe hook for calling tRPC procedures
- `useSuspenseQuery` — Used with Suspense boundaries for loading states
- `prefetch()` + `HydrateClient` — Server-side prefetching for instant page loads
- `makeQueryClient()` — Custom query client with `staleTime: 30s`

---

### nuqs v2

```
Package: nuqs@^2.8.9
```

nuqs manages **URL search parameter state** — pagination, search, and filters are persisted in the URL for shareability and browser history support.

```typescript
// Example: features/workflows/params.ts
const searchParams = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(5),
  search: parseAsString.withDefault(""),
};
```

---

## Styling

### Tailwind CSS v4

```
Packages: tailwindcss@^4, @tailwindcss/postcss@^4, tw-animate-css@^1.4.0
```

Tailwind CSS v4 provides utility-first styling with CSS variables for theming.

**Key Configuration:**
- PostCSS plugin: `@tailwindcss/postcss`
- CSS variables for shadcn/ui theme tokens in `globals.css`
- `tw-animate-css` for animation utilities

**Styling Utilities:**
- `class-variance-authority` (CVA) — Variant-based component styling
- `clsx` + `tailwind-merge` — Combined via `cn()` utility for conditional class merging

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Utilities

| Package | Version | Purpose |
|---|---|---|
| `zod` | ^4.3.6 | Runtime schema validation for tRPC inputs |
| `superjson` | ^2.2.6 | tRPC data transformer (Date, BigInt, Map, Set) |
| `cryptr` | ^6.4.0 | AES-256 encryption for API key credentials |
| `date-fns` | ^4.1.0 | Date formatting and manipulation |
| `toposort` | ^2.0.2 | Topological sort for DAG node ordering |
| `random-word-slugs` | ^0.1.7 | Human-friendly auto-generated workflow names |
| `handlebars` | ^4.7.9 | Template string rendering |
| `html-entities` | ^2.6.0 | HTML entity encoding/decoding |
| `@paralleldrive/cuid2` | ^3.3.0 | Collision-resistant unique ID generation |
| `ky` | ^2.0.0 | HTTP client for external API calls |
| `embla-carousel-react` | ^8.6.0 | Carousel scrolling (shadcn carousel component) |
| `recharts` | ^3.8.1 | Data visualization charts |
| `react-hook-form` | ^7.72.1 | Form state management |
| `@hookform/resolvers` | ^5.2.2 | Zod resolver for react-hook-form |
| `react-error-boundary` | ^6.1.1 | Error boundary component |
| `react-resizable-panels` | ^4.9.0 | Resizable panel layouts |
| `react-day-picker` | ^9.14.0 | Date picker component |
| `sonner` | ^2.0.7 | Toast notification library |
| `vaul` | ^1.1.2 | Drawer component primitive |
| `cmdk` | ^1.1.1 | Command palette component |
| `input-otp` | ^1.4.2 | OTP input component |
| `next-themes` | ^0.4.6 | Theme management (light/dark) |
| `client-only` | ^0.0.1 | Enforce client-only imports |
| `server-only` | ^0.0.1 | Enforce server-only imports |

---

## Development Tooling

| Tool | Version | Purpose |
|---|---|---|
| **pnpm** | — | Package manager — fast, disk-efficient, strict dependency resolution |
| **ESLint** | ^10 | Code quality with flat config (`eslint.config.mjs`) |
| **eslint-config-next** | 16.2.2 | Next.js specific rules: Core Web Vitals + TypeScript |
| **inngest-cli** | ^1.17.9 | Local Inngest development server for testing functions |
| **mprocs** | ^0.9.2 | Run multiple processes in parallel (dev server + Inngest) |
| **ngrok** | ^5.0.0-beta.2 | Expose local server for webhook testing |
| **tsx** | ^4.21.0 | TypeScript execution for scripts |
| **dotenv-cli** | ^11.0.0 | Load .env files for CLI commands |

**ESLint Configuration:**
```javascript
// eslint.config.mjs — Flat config format
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
```

---

## AI SDK Integration

```
Packages: ai@^6.0.153, @ai-sdk/openai@^3.0.52, @ai-sdk/anthropic@^3.0.68, @ai-sdk/google@^3.0.60
```

The Vercel AI SDK provides a unified interface for calling multiple AI providers. Each AI node executor uses the corresponding provider SDK:

| Provider | Package | Node Type |
|---|---|---|
| OpenAI | `@ai-sdk/openai` | `OPENAI` |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC` |
| Google (Gemini) | `@ai-sdk/google` | `GEMINI` |

This abstraction allows switching between AI providers without changing the execution logic — each executor function follows the same `NodeExecutor` interface.

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — How these technologies fit together
- [DATABASE.md](./DATABASE.md) — Prisma schema and Neon configuration
- [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md) — Inngest execution details
- [CONFIGURATION.md](./CONFIGURATION.md) — Environment variables for all services
- [adr/](./adr/) — Architecture Decision Records documenting why each technology was chosen
