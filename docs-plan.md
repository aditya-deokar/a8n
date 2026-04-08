# 📚 Nodebase — Documentation Implementation Plan

> **Project:** Nodebase — AI-Powered Workflow Automation Platform  
> **Goal:** Create industry-grade, maintainable documentation that a senior engineer would be proud to hand off  
> **Inspired by:** Stripe Docs, Vercel Engineering Blog, HashiCorp Architecture Guides, Turborepo Docs

---

## 🔍 Project Analysis Summary

After a deep-dive analysis of the entire codebase, here is what we're documenting:

| Dimension | Details |
|---|---|
| **Platform** | Next.js 16 (App Router) full-stack workflow automation platform |
| **Frontend** | React 19, React Flow (XYFlow), Jotai, TanStack Query, shadcn/ui (53 components), Tailwind CSS v4 |
| **Backend** | tRPC v11, Inngest (event-driven functions + realtime), Prisma v7 (Neon PostgreSQL adapter) |
| **Auth** | Better Auth (email/password + GitHub + Google OAuth) with Prisma adapter |
| **Payments** | Polar.sh (subscription billing, checkout, customer portal) |
| **Key Patterns** | Feature-based architecture, topological DAG execution, node executor registry, encrypted credentials |
| **Infra** | Neon PostgreSQL (serverless), Vercel-ready deployment, Inngest Cloud |

---

## 📂 Documentation Structure

```
docs/
├── README.md                          # Project overview & quick-start
├── ARCHITECTURE.md                    # System architecture & design
├── TECH_STACK.md                      # Technology decisions & rationale
├── GETTING_STARTED.md                 # Developer onboarding guide
├── DATABASE.md                        # Schema, ERD, migrations
├── API_REFERENCE.md                   # tRPC routers & procedures
├── AUTHENTICATION.md                  # Auth system & authorization
├── WORKFLOW_ENGINE.md                 # Execution engine deep-dive
├── FEATURE_MODULES.md                 # Feature-based architecture guide
├── FRONTEND_ARCHITECTURE.md           # Component hierarchy & patterns
├── STATE_AND_DATA_FLOW.md             # State management & data flow
├── CONFIGURATION.md                   # Environment variables & config
├── DEPLOYMENT.md                      # Deployment & infrastructure
├── CONTRIBUTING.md                    # Contributing guidelines
└── adr/                               # Architecture Decision Records
    ├── 001-nextjs-app-router.md
    ├── 002-trpc-over-rest.md
    ├── 003-inngest-workflow-engine.md
    ├── 004-feature-based-architecture.md
    ├── 005-better-auth-selection.md
    ├── 006-neon-serverless-postgres.md
    └── 007-polar-billing.md
```

---

## 🚀 Phased Execution Plan

### Phase 1 — Foundation (4 documents)
> Ground truth. Anyone landing on the repo should understand what this is, how it works, and how to run it in < 10 minutes.

### Phase 2 — Core Systems (4 documents)
> Deep technical documentation of the backend pillars: data layer, API surface, auth, and execution engine.

### Phase 3 — Developer Experience (4 documents)
> Frontend patterns, module conventions, state management, and configuration — everything a new dev needs to ship features.

### Phase 4 — Operations & Maintenance (2 documents + ADRs)
> Deployment, contribution guidelines, and architecture decision records for long-term project health.

---

## 📋 Document-by-Document Breakdown

---

### Phase 1: Foundation

---

#### 1. `README.md` — Project Overview
**Priority:** 🔴 Critical | **Effort:** Medium | **Status:** ⬜ Not Started

Replace the boilerplate `create-next-app` README with a proper project README.

**Sections:**
1. **Hero Banner** — Project name, one-line tagline, badges (build status, license, tech stack)
2. **What is Nodebase?** — 2-3 paragraph project description with key capabilities
3. **Screenshots / Demo** — Key UI screenshots (editor, workflows list, execution view)
4. **Key Features** — Bullet list of capabilities:
   - Visual DAG workflow editor (React Flow)
   - 10 node types: triggers (Manual, Google Forms, Stripe) + executors (HTTP, OpenAI, Anthropic, Gemini, Discord, Slack)
   - Real-time execution status via Inngest Realtime channels
   - Encrypted credential vault (AES-256 via Cryptr)
   - Subscription billing (Polar.sh with free/pro tiers)
   - OAuth login (GitHub, Google) + email/password
5. **Tech Stack Overview** — Compact table linking to `TECH_STACK.md`
6. **Quick Start** — 5-step setup linking to `GETTING_STARTED.md`
7. **Project Structure** — Abbreviated tree with annotations
8. **Documentation Index** — Links to all docs
9. **License** — License info

---

#### 2. `ARCHITECTURE.md` — System Architecture
**Priority:** 🔴 Critical | **Effort:** High | **Status:** ⬜ Not Started

The keystone document. How senior engineers at Stripe/Vercel would describe system design.

**Sections:**
1. **Architecture Overview** — High-level Mermaid diagram showing:
   - Client (React 19 / Next.js App Router)
   - API Layer (tRPC + Next.js API routes)
   - Background Jobs (Inngest)
   - Database (PostgreSQL via Neon)
   - External Services (Polar, OAuth providers, AI APIs)
2. **System Components** — Each major subsystem:
   - **Web Application Layer** — Next.js App Router with route groups `(auth)`, `(dashboard)/(rest)`, `(dashboard)/(editor)`
   - **API Layer** — tRPC routers (`workflows`, `credentials`, `executions`) + raw API routes (`/api/auth`, `/api/inngest`, `/api/trpc`, `/api/webhooks`)
   - **Workflow Execution Engine** — Inngest functions, topological sort, executor registry pattern
   - **Data Layer** — Prisma + Neon adapter, connection pooling pattern
   - **Authentication Layer** — Better Auth server/client split, session management
   - **Billing Layer** — Polar.sh integration via Better Auth plugin
3. **Request Lifecycle** — Full trace of a request from browser → tRPC → DB → response
4. **Workflow Execution Lifecycle** — Step-by-step:
   ```
   User clicks "Execute" → tRPC mutation → Inngest event → 
   Create Execution record → Topological sort → 
   Sequential node execution (with realtime publish) → 
   Update Execution status
   ```
5. **Security Architecture** — Auth layers (session → tRPC middleware → row-level filtering), credential encryption, CSRF protection
6. **Data Flow Diagram** — Mermaid sequence diagram for key flows
7. **Design Principles** — Patterns the codebase follows:
   - Feature-based modular architecture
   - Server/client component boundary separation
   - Type safety end-to-end (Prisma → tRPC → React)
   - Event-driven execution (not synchronous API calls)

---

#### 3. `TECH_STACK.md` — Technology Decisions & Rationale
**Priority:** 🟡 High | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Stack Overview Table** — Category, technology, version, purpose
2. **Framework & Runtime:**
   - Next.js 16 (App Router, React Compiler, Turbopack) — why App Router over Pages
   - React 19 — concurrent features, Server Components
   - TypeScript 6 — strict mode, enhanced DX
3. **Backend & API:**
   - tRPC v11 — end-to-end type safety, why not REST/GraphQL
   - Inngest v4 — event-driven functions, durability, retries, realtime middleware
   - Prisma v7 — type-safe ORM, Neon serverless adapter
4. **Database:**
   - Neon PostgreSQL — serverless scaling, branching, connection pooling via `@neondatabase/serverless`
   - Prisma adapter pattern — `PrismaNeon` adapter for HTTP-based connections
5. **Authentication:**
   - Better Auth v1.6 — lightweight, plugin-based, Prisma adapter
   - OAuth providers (GitHub, Google)
   - Session strategy and cookie management
6. **Payments & Billing:**
   - Polar.sh SDK — open-source friendly billing
   - Better Auth Polar plugin — checkout, portal, customer sync
7. **Frontend Libraries:**
   - React Flow (`@xyflow/react` v12) — DAG editor canvas
   - shadcn/ui (New York style, 53 components) — UI primitives
   - Jotai v2 — atomic state management for editor
   - TanStack Query v5 — server state via tRPC integration
   - nuqs v2 — URL-based search params state
   - Recharts v3 — data visualization
8. **Styling:**
   - Tailwind CSS v4 — utility-first CSS
   - `tw-animate-css` — animation utilities
   - `class-variance-authority` — variant-based component styling
9. **Utilities:**
   - Zod v4 — runtime validation (tRPC input schemas)
   - Cryptr — AES-256 credential encryption
   - SuperJSON — tRPC data transformer (Date, BigInt serialization)
   - `date-fns` — date formatting
   - `toposort` — topological graph sorting for workflow DAGs
   - `random-word-slugs` — human-friendly workflow name generation
   - Handlebars — template rendering
10. **Dev Tooling:**
    - pnpm — package manager
    - ESLint (flat config) — code quality
    - inngest-cli — local Inngest dev server
    - mprocs — parallel process runner
    - ngrok — webhook tunnel

---

#### 4. `GETTING_STARTED.md` — Developer Onboarding
**Priority:** 🔴 Critical | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Prerequisites** — Node.js 18+, pnpm, PostgreSQL (or Neon account), GitHub/Google OAuth app setup
2. **Clone & Install** — Step-by-step with exact commands
3. **Environment Setup** — Full `.env` variable list with descriptions:
   - `DATABASE_URL` — Neon connection string
   - `BETTER_AUTH_SECRET` — Auth session secret
   - `ENCRYPTION_KEY` — Cryptr encryption key
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `POLAR_ACCESS_TOKEN` / `POLAR_SUCCESS_URL`
   - `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
4. **Database Setup** — Prisma migration commands, seed data (if any)
5. **Running the Dev Server** — `pnpm dev` + Inngest dev server (`pnpm inngest:dev`)
6. **Verifying the Setup** — Checklist: landing page, login, create workflow, execute
7. **Common Issues & Troubleshooting** — Known gotchas (Prisma client generation, Neon cold starts, `.env` issues)
8. **IDE Setup** — Recommended VS Code extensions, settings

---

### Phase 2: Core Systems

---

#### 5. `DATABASE.md` — Database Schema & Data Layer
**Priority:** 🔴 Critical | **Effort:** High | **Status:** ⬜ Not Started

**Sections:**
1. **Entity-Relationship Diagram** — Mermaid ERD of all 8 models
2. **Model Reference** — Each model with:
   - Field table (name, type, constraints, description)
   - Relations & foreign keys
   - Indexes & unique constraints
   - Business rules & validation
3. **Models Documented:**
   - `User` — Core identity, linked to sessions/accounts/workflows/credentials
   - `Session` — Auth session with token + IP + user agent
   - `Account` — OAuth provider accounts (GitHub, Google)
   - `Verification` — Email verification records
   - `Credential` — Encrypted API keys (OpenAI, Anthropic, Gemini types)
   - `Workflow` — DAG container, user-scoped
   - `Node` — Workflow node with type enum, position JSON, data JSON
   - `Connection` — Directed edge between nodes with I/O handles
   - `Execution` — Workflow run record with status, Inngest correlation, output
4. **Enums:**
   - `NodeType` — INITIAL, MANUAL_TRIGGER, HTTP_REQUEST, GOOGLE_FORM_TRIGGER, STRIPE_TRIGGER, ANTHROPIC, GEMINI, OPENAI, DISCORD, SLACK
   - `CredentialType` — OPENAI, ANTHROPIC, GEMINI
   - `ExecutionStatus` — RUNNING, SUCCESS, FAILED
5. **Prisma Configuration:**
   - Neon adapter setup (`PrismaNeon`)
   - Global singleton pattern for dev hot-reload
   - Generated client output path (`src/generated/prisma`)
   - `prisma.config.ts` and `dotenv` integration
6. **Migration Workflow** — How to run `prisma migrate dev`, `prisma db push`, `prisma generate`
7. **Data Access Patterns** — Common query patterns used in tRPC routers

---

#### 6. `API_REFERENCE.md` — tRPC API Surface
**Priority:** 🟡 High | **Effort:** High | **Status:** ⬜ Not Started

**Sections:**
1. **Architecture Overview** — tRPC init → router composition → client/server callers
2. **Procedure Types:**
   - `baseProcedure` — No auth, public
   - `protectedProcedure` — Requires valid session (Better Auth)
   - `premiumProcedure` — Requires active Polar subscription
3. **Router: `workflows`** — Each procedure documented:

   | Procedure | Type | Auth | Input Schema | Returns | Description |
   |---|---|---|---|---|---|
   | `create` | mutation | premium | — | Workflow | Create workflow with random slug name + initial node |
   | `remove` | mutation | protected | `{id}` | Workflow | Delete user-scoped workflow |
   | `update` | mutation | protected | `{id, nodes[], edges[]}` | Workflow | Full DAG replace (transaction) |
   | `updateName` | mutation | protected | `{id, name}` | Workflow | Rename workflow |
   | `getOne` | query | protected | `{id}` | `{id, name, nodes, edges}` | Get workflow with React Flow transforms |
   | `getMany` | query | protected | `{page, pageSize, search}` | Paginated list | List workflows with search |
   | `execute` | mutation | protected | `{id}` | Workflow | Trigger Inngest execution |

4. **Router: `credentials`** — CRUD + `getByType` procedure
5. **Router: `executions`** — `getOne` + paginated `getMany`
6. **Client Setup** — `TRPCReactProvider`, `useTRPC`, `httpBatchLink`, SuperJSON transformer
7. **Server Caller** — `createTRPCOptionsProxy`, `prefetch`, `HydrateClient` pattern

---

#### 7. `AUTHENTICATION.md` — Auth & Authorization
**Priority:** 🟡 High | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Auth Architecture Diagram** — Better Auth server ↔ Prisma ↔ Client
2. **Server Configuration** — `lib/auth.ts`:
   - Prisma adapter with PostgreSQL provider
   - Email/password (auto sign-in enabled)
   - Social providers: GitHub, Google
   - Polar plugin (checkout, portal, customer sync on signup)
3. **Client Configuration** — `lib/auth-client.ts`:
   - `createAuthClient` with Polar plugin
4. **Auth Utilities** — `lib/auth-utils.ts`:
   - `requireAuth()` — Server-side session guard (redirect to `/login`)
   - `requireUnauth()` — Inverse guard (redirect to `/`)
5. **Route Protection Strategy:**
   - Server Components: `requireAuth()` in page/layout
   - tRPC: `protectedProcedure` middleware → session in context
   - Premium gating: `premiumProcedure` → Polar subscription check
6. **Session Model** — Token-based, stored in DB, includes IP + user agent
7. **API Routes** — `/api/auth/[...all]` catch-all handler
8. **Authorization Matrix:**

   | Resource | Unauthenticated | Authenticated (Free) | Authenticated (Pro) |
   |---|---|---|---|
   | View workflows | ❌ | ✅ (own) | ✅ (own) |
   | Create workflow | ❌ | ❌ | ✅ |
   | Execute workflow | ❌ | ✅ (own) | ✅ (own) |
   | Create credential | ❌ | ❌ | ✅ |
   | Manage credential | ❌ | ✅ (own) | ✅ (own) |

---

#### 8. `WORKFLOW_ENGINE.md` — Execution Engine Deep-Dive
**Priority:** 🔴 Critical | **Effort:** Very High | **Status:** ⬜ Not Started

This is the most technically complex and important doc — the heart of the application.

**Sections:**
1. **Engine Overview** — Mermaid diagram of the full execution pipeline
2. **Inngest Integration:**
   - Client setup (`inngest/client.ts`) — `id: "nodebase"`, realtime middleware
   - Event schema: `workflows/execute.workflow` with `workflowId` payload
   - Retry policy: 3 retries in production, 0 in dev
   - Failure handler: update execution status to `FAILED`
3. **Execution Pipeline (Step-by-Step):**
   1. `create-execution` — Persist execution record with Inngest event correlation
   2. `prepare-workflow` — Fetch workflow with nodes + connections, run topological sort
   3. `find-user-id` — Resolve workflow owner for credential access
   4. **Node loop** — Iterate sorted nodes, resolve executor, pass context chain
   5. `update-execution` — Mark status `SUCCESS`, persist output
4. **Topological Sort Algorithm:**
   - DAG edge extraction from `Connection` model
   - Handling disconnected nodes (self-edges)
   - Cycle detection → `"Workflow contains a cycle"` error
   - Library: `toposort` package
5. **Node Executor Pattern:**
   ```typescript
   interface NodeExecutorParams<TData> {
     data: TData;         // Node-specific configuration
     nodeId: string;      // For step naming
     userId: string;      // For credential resolution
     context: Record<string, unknown>; // Upstream output
     step: StepTools;     // Inngest step tools (durability)
     publish: PublishFn;  // Inngest realtime publish
   }
   ```
6. **Executor Registry** — Map of `NodeType → NodeExecutor`:
   - Triggers: `MANUAL_TRIGGER`, `GOOGLE_FORM_TRIGGER`, `STRIPE_TRIGGER`
   - AI Nodes: `OPENAI`, `ANTHROPIC`, `GEMINI`
   - Integration Nodes: `HTTP_REQUEST`, `DISCORD`, `SLACK`
   - Placeholder: `INITIAL` (mapped to manual trigger executor)
7. **Inngest Realtime Channels:**
   - 9 dedicated channels (one per node type)
   - Used for streaming execution progress to the UI
8. **Context Propagation** — How output from node N becomes input to node N+1
9. **Error Handling** — `NonRetriableError` for invalid events, `onFailure` callback pattern
10. **Adding a New Node Type** — Step-by-step guide:
    - Add enum value to `NodeType` in Prisma schema
    - Create executor function
    - Register in executor registry
    - Create React Flow node component
    - Register in `nodeComponents` config
    - Add Inngest realtime channel
    - Run Prisma migration

---

### Phase 3: Developer Experience

---

#### 9. `FEATURE_MODULES.md` — Feature-Based Architecture
**Priority:** 🟡 High | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Module Convention** — Standard feature module anatomy:
   ```
   features/<feature>/
   ├── components/     # React components (client & server)
   ├── hooks/          # Custom React hooks (useTRPC wrappers)
   ├── server/
   │   ├── routers.ts      # tRPC router definition
   │   ├── prefetch.ts     # Server-side prefetching helpers
   │   └── params-loader.ts # Route param parsing
   ├── params.ts       # URL search params schema (nuqs)
   └── types.ts        # TypeScript type definitions
   ```
2. **Module Inventory:**
   - `features/auth` — Auth UI (login, signup, layout)
   - `features/workflows` — Workflow listing, CRUD, search, pagination
   - `features/credentials` — Credential vault management
   - `features/executions` — Execution history, detail view, node executors
   - `features/editor` — Visual DAG editor (React Flow), toolbar, state
   - `features/triggers` — Trigger node components + executors
   - `features/subscriptions` — Subscription status hooks
3. **Conventions & Rules:**
   - Feature modules are self-contained: components, hooks, server logic  
   - Cross-feature imports go through `@/` alias, not relative paths  
   - tRPC routers are composed in `trpc/routers/_app.ts`  
   - Each feature owns its URL search params schema  
4. **Creating a New Feature Module** — Step-by-step template

---

#### 10. `FRONTEND_ARCHITECTURE.md` — UI & Component Patterns
**Priority:** 🟡 High | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Component Hierarchy:**
   - `RootLayout` → Providers (tRPC, Jotai, NuQS, Toaster)
   - `(auth)/layout` → `AuthLayout` wrapper
   - `(dashboard)/layout` → `SidebarProvider` + `AppSidebar` + `SidebarInset`
   - `(dashboard)/(rest)/layout` → `AppHeader` + content area
   - `(dashboard)/(editor)/workflows/[id]` → Full-screen editor
2. **Route Groups:**

   | Group | Purpose | Layout |
   |---|---|---|
   | `(auth)` | Login, signup | Centered auth layout |
   | `(dashboard)/(rest)` | Workflows, credentials, executions lists | Sidebar + header |
   | `(dashboard)/(editor)` | Workflow visual editor | Sidebar + full canvas |

3. **Component Categories:**
   - **UI Primitives** — 53 shadcn/ui components (`components/ui/`)
   - **Layout Components** — `AppSidebar`, `AppHeader`
   - **React Flow Components** — `BaseNode`, `BaseHandle`, `PlaceholderNode`, `NodeStatusIndicator`
   - **Feature Components** — Scoped to `features/*/components/`
   - **Shared Components** — `EntityComponents` (loading, error, empty states)
4. **Server vs Client Components:**
   - Server: layouts, data-fetching pages, prefetch wrappers
   - Client: interactive UI (`"use client"`), editor, sidebar, forms
5. **Styling Approach:**
   - Tailwind CSS v4 with CSS variables for theming
   - `cn()` utility (clsx + tailwind-merge)
   - CVA for component variants

---

#### 11. `STATE_AND_DATA_FLOW.md` — State Management & Data Flow
**Priority:** 🟢 Medium | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **State Layer Architecture:**
   ```
   URL State (nuqs) ←→ Server State (tRPC + TanStack Query) ←→ 
   Client State (Jotai atoms) ←→ Component Local State (useState)
   ```
2. **Server State (tRPC + TanStack Query):**
   - `TRPCReactProvider` → shared query client
   - `useTRPC` hook for procedure calls
   - Server-side prefetching: `trpc.*.queryOptions()` → `prefetch()` → `HydrateClient`
   - `httpBatchLink` for request batching
   - SuperJSON transformer for Date/BigInt
3. **URL State (nuqs):**
   - `NuqsAdapter` for Next.js App Router
   - Per-feature `params.ts` — search, pagination params
   - Shareable URL state
4. **Client State (Jotai):**
   - `editorAtom` — React Flow editor instance
   - Atomic state colocation with `Provider` in root layout
5. **Local Component State:**
   - React Flow nodes/edges in `Editor` component
   - Form state via `react-hook-form` + Zod resolvers
6. **Data Prefetching Pattern:**
   ```
   Server Component → prefetch(trpc.*.queryOptions()) → 
   HydrateClient → Client Component → useSuspenseQuery
   ```

---

#### 12. `CONFIGURATION.md` — Configuration Reference
**Priority:** 🟢 Medium | **Effort:** Low | **Status:** ⬜ Not Started

**Sections:**
1. **Environment Variables** — Complete table:

   | Variable | Required | Description | Example |
   |---|---|---|---|
   | `DATABASE_URL` | ✅ | Neon PostgreSQL connection string | `postgresql://...` |
   | `BETTER_AUTH_SECRET` | ✅ | Session encryption secret | Random 32+ chars |
   | `ENCRYPTION_KEY` | ✅ | Cryptr AES key for credentials | Random 32+ chars |
   | `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth app client ID | `Iv1.abc123` |
   | `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth app secret | — |
   | `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID | — |
   | `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth secret | — |
   | `POLAR_ACCESS_TOKEN` | ✅ | Polar.sh API access token | — |
   | `POLAR_SUCCESS_URL` | ✅ | Post-checkout redirect URL | `http://localhost:3000/success` |
   | `INNGEST_EVENT_KEY` | ⚡ Prod | Inngest event key | — |
   | `INNGEST_SIGNING_KEY` | ⚡ Prod | Inngest signing key | — |
   | `VERCEL_URL` | Auto | Vercel deployment URL | Auto-set |

2. **Next.js Configuration** — `next.config.ts`:
   - React Compiler enabled
   - Turbopack configuration
   - Root redirect (`/` → `/workflows`)
3. **TypeScript Configuration** — `tsconfig.json` highlights:
   - Target: ES2017, Module: ESNext
   - Strict mode, path aliases (`@/*`)
   - React `react-jsx` transform
4. **Prisma Configuration** — `prisma.config.ts`, schema location, output path
5. **ESLint Configuration** — Flat config with `next/core-web-vitals` + TypeScript
6. **PostCSS Configuration** — Tailwind CSS v4 PostCSS plugin
7. **shadcn/ui Configuration** — `components.json`: New York style, RSC, gray base

---

### Phase 4: Operations & Maintenance

---

#### 13. `DEPLOYMENT.md` — Deployment & Infrastructure
**Priority:** 🟢 Medium | **Effort:** Medium | **Status:** ⬜ Not Started

**Sections:**
1. **Infrastructure Overview** — Mermaid diagram:
   - Vercel (Next.js hosting + serverless functions)
   - Neon (PostgreSQL)
   - Inngest Cloud (background job orchestration)
   - Polar.sh (billing)
2. **Vercel Deployment:**
   - Build command: `next build`
   - Environment variable configuration
   - Serverless function configuration
3. **Database Deployment:**
   - Neon project setup
   - Production migration workflow
   - Branching strategy for preview deployments
4. **Inngest Production Setup:**
   - Inngest Cloud configuration
   - Event key + signing key setup
   - `api/inngest` route handler
5. **Webhook Configuration:**
   - Google Forms webhook setup
   - Stripe webhook setup
   - Verification and security
6. **Production Checklist:**
   - [ ] Environment variables set
   - [ ] Database migrated
   - [ ] Inngest functions synced
   - [ ] OAuth redirect URIs updated
   - [ ] Polar success URL configured
   - [ ] Encryption key backed up securely

---

#### 14. `CONTRIBUTING.md` — Contributing Guidelines
**Priority:** 🟢 Medium | **Effort:** Low | **Status:** ⬜ Not Started

**Sections:**
1. **Development Workflow** — Branch strategy, PR process
2. **Code Style** — ESLint rules, TypeScript conventions
3. **Commit Conventions** — Conventional commits
4. **Testing Strategy** — Current testing approach and recommendations
5. **Adding a New Node Type** — End-to-end checklist (cross-ref `WORKFLOW_ENGINE.md`)
6. **Adding a New Feature Module** — Template (cross-ref `FEATURE_MODULES.md`)
7. **Review Checklist** — What to check before merging

---

#### 15. `adr/` — Architecture Decision Records
**Priority:** 🟢 Medium | **Effort:** Low (per ADR) | **Status:** ⬜ Not Started

Each ADR follows the standard format:
```markdown
# ADR-NNN: Title

## Status: Accepted
## Date: YYYY-MM-DD

## Context
[What problem are we solving?]

## Decision
[What did we decide?]

## Consequences
[What are the trade-offs?]

## Alternatives Considered
[What else did we evaluate?]
```

**Planned ADRs:**

| # | Title | Key Decision |
|---|---|---|
| 001 | Next.js App Router | App Router over Pages Router for RSC, layouts, streaming |
| 002 | tRPC over REST | End-to-end type safety, no codegen, procedure middleware |
| 003 | Inngest as Workflow Engine | Durability, step functions, retries, realtime over custom queue |
| 004 | Feature-Based Architecture | Colocation over layer-based (`components/`, `services/`, `models/`) |
| 005 | Better Auth | Lightweight, plugin-based over NextAuth/Clerk/Auth0 |
| 006 | Neon Serverless PostgreSQL | Connection pooling, branching, HTTP driver for edge |
| 007 | Polar.sh Billing | Open-source friendly, Better Auth plugin, vs Stripe Billing |

---

## 📐 Quality Standards

Every document must meet these standards:

| Standard | Requirement |
|---|---|
| **Diagrams** | Mermaid diagrams for all architecture/flow docs |
| **Code Examples** | Real code snippets from the actual codebase, not pseudo-code |
| **Cross-References** | Link to related docs (`→ See [AUTHENTICATION.md](./AUTHENTICATION.md)`) |
| **Tables** | Use tables for reference data, comparison matrices, configuration |
| **Versioning** | Keep a "Last Updated" date at the top of each document |
| **Accuracy** | Every code reference must match the actual current codebase |
| **Audience** | Written for mid-to-senior developers joining the project |
| **Actionable** | Every guide must have step-by-step instructions that actually work |

---

## 📅 Execution Order

| Order | Document | Depends On | Est. Time |
|---|---|---|---|
| 1 | `README.md` | — | ~30 min |
| 2 | `ARCHITECTURE.md` | — | ~60 min |
| 3 | `TECH_STACK.md` | — | ~30 min |
| 4 | `GETTING_STARTED.md` | — | ~30 min |
| 5 | `DATABASE.md` | Architecture | ~45 min |
| 6 | `WORKFLOW_ENGINE.md` | Architecture, Database | ~60 min |
| 7 | `API_REFERENCE.md` | Database | ~45 min |
| 8 | `AUTHENTICATION.md` | Architecture | ~30 min |
| 9 | `FEATURE_MODULES.md` | Architecture | ~30 min |
| 10 | `FRONTEND_ARCHITECTURE.md` | Feature Modules | ~30 min |
| 11 | `STATE_AND_DATA_FLOW.md` | Frontend Architecture | ~30 min |
| 12 | `CONFIGURATION.md` | Getting Started | ~20 min |
| 13 | `DEPLOYMENT.md` | All core docs | ~30 min |
| 14 | `CONTRIBUTING.md` | All core docs | ~20 min |
| 15 | `adr/*.md` (7 ADRs) | Architecture, Tech Stack | ~45 min |

**Total Estimated Effort: ~8-9 hours**

---

## ✅ Ready to Execute

Once you approve this plan, we'll proceed document by document in the order above. Each document will:
1. Be written with real code references from the analyzed codebase
2. Include Mermaid diagrams where applicable
3. Cross-reference related documents
4. Follow the quality standards defined above

> **Next step:** Confirm which document to start with (recommended: `README.md` → `ARCHITECTURE.md`)
