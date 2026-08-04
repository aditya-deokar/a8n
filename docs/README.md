<div align="center">

# ⚡ a8n

### AI-Powered Workflow Automation Platform

Build, connect, and execute intelligent automation workflows with a visual drag-and-drop editor.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?logo=trpc)](https://trpc.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 What is a8n?

**a8n** is a full-stack workflow automation platform that empowers users to design, build, and execute complex automation pipelines through an intuitive visual editor. Think of it as an AI-native alternative to a8n or Zapier — built from the ground up with modern web technologies.

Users create **workflows** as directed acyclic graphs (DAGs) by connecting **nodes** — triggers that start workflows (manual, Google Forms, Stripe webhooks) and executors that perform actions (HTTP requests, AI model calls via OpenAI/Anthropic/Gemini, Discord/Slack messaging). The platform executes these workflows reliably using **Inngest** as a durable, event-driven execution engine with real-time status streaming.

The platform includes a complete SaaS stack: user authentication (email/password + GitHub/Google OAuth), encrypted credential management, subscription billing with free and pro tiers, and a polished dashboard UI.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🎨 **Visual Workflow Editor** | Drag-and-drop DAG editor built on React Flow with snap-to-grid, minimap, and auto-layout |
| 🔀 **10 Node Types** | Triggers (Manual, Google Forms, Stripe) + Executors (HTTP, OpenAI, Anthropic, Gemini, Discord, Slack) |
| ⚡ **Durable Execution** | Workflows execute reliably via Inngest with automatic retries, step functions, and failure recovery |
| 📡 **Real-Time Status** | Live execution progress streaming via Inngest Realtime channels |
| 🔐 **Encrypted Credentials** | API keys stored with AES-256 encryption (Cryptr) — never exposed in plaintext |
| 🔑 **Multi-Provider Auth** | Email/password + GitHub + Google OAuth via Better Auth |
| 💳 **Subscription Billing** | Free and Pro tiers with Polar.sh — checkout, billing portal, and customer management |
| 🧩 **Extensible Architecture** | Add new node types with a single executor function + component registration |
| 🛡️ **Type-Safe API** | End-to-end type safety from database to UI via Prisma → tRPC → React |
| 📊 **Execution History** | Full audit trail of every workflow run with status, timing, output, and error details |

---

## 🛠 Tech Stack & Key Libraries

| Category | Technology / Library | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (`next` App Router) | `16.2.6` | Full-stack React framework with RSC, Turbopack, and API routes |
| **Frontend Core** | React / React DOM | `19.2.4` | UI library with Server Components |
| **Language & Engine** | TypeScript / Node.js | `6.0.2` / `^24` | Static typing with strict mode across full stack |
| **API Layer** | tRPC (`@trpc/server`, `@trpc/client`) | `11.16.0` | End-to-end type-safe API layer |
| **Database & ORM** | Prisma / Neon Database | `7.7.0` / `1.0.2` | Type-safe database ORM with Neon serverless driver & `pgvector` |
| **AI Agent Engine** | LangGraph / LangChain Core | `1.4.8` / `1.2.3` | State-graph autonomous AI agent orchestration |
| **Multi-Provider AI** | Vercel AI SDK (`ai`, OpenAI, Anthropic, Gemini) | `6.0.153` / `3.0.x` | Unified LLM providers |
| **MCP Apps** | `@modelcontextprotocol/ext-apps` | `1.7.5` | Standardized MCP Apps tools, resources & PostMessage bridge |
| **Execution Engine** | Inngest (`inngest`) | `4.2.0` | Durable event-driven workflow execution & retries |
| **Auth & Billing** | Better Auth / Polar.sh | `1.6.11` / `0.47.0` | Authentication & subscription billing management |
| **Workflow Editor** | React Flow (`@xyflow/react`) | `12.10.2` | Visual DAG workflow editor |
| **State Management** | TanStack Query / Jotai / nuqs | `5.96` / `2.19` / `2.8` | Cache, atom, and URL state management |
| **Styling & UI** | Tailwind CSS / Radix UI | `4.0` / `1.6.7` | Utility-first CSS & 53 Radix-based accessible UI components |

> 📘 For detailed rationale behind each technology choice, see [TECH_STACK.md](./TECH_STACK.md)

---

## 📁 Project Structure

```
a8n/
├── prisma/
│   └── schema.prisma              # Database schema (8 models, 3 enums)
├── public/                        # Static assets and logos
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Auth routes (login, signup)
│   │   ├── (dashboard)/
│   │   │   ├── (editor)/          # Full-screen workflow editor
│   │   │   └── (rest)/            # Dashboard pages (workflows, credentials, executions)
│   │   ├── api/
│   │   │   ├── auth/[...all]/     # Better Auth handler
│   │   │   ├── inngest/           # Inngest function serving
│   │   │   ├── trpc/[trpc]/       # tRPC request handler
│   │   │   └── webhooks/          # Stripe & Google Forms webhooks
│   │   └── layout.tsx             # Root layout with providers
│   ├── components/
│   │   ├── ui/                    # 53 shadcn/ui components
│   │   ├── react-flow/            # Base node & handle components
│   │   └── *.tsx                  # Shared app components
│   ├── config/                    # Constants, node component registry
│   ├── features/                  # Feature-based modules
│   │   ├── auth/                  # Authentication UI
│   │   ├── credentials/           # Credential vault CRUD
│   │   ├── editor/                # Workflow editor (React Flow)
│   │   ├── executions/            # Execution history + node executors
│   │   ├── subscriptions/         # Billing status hooks
│   │   ├── triggers/              # Trigger node components + executors
│   │   └── workflows/             # Workflow listing & management
│   ├── generated/prisma/          # Auto-generated Prisma client
│   ├── hooks/                     # Shared custom hooks
│   ├── inngest/                   # Inngest client, functions, channels
│   ├── lib/                       # Core utilities (auth, db, encryption)
│   └── trpc/                      # tRPC init, client, server, routers
├── next.config.ts                 # Next.js configuration
├── prisma.config.ts               # Prisma configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd a8n

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database URL, auth secrets, and API keys

# 4. Set up the database
pnpm prisma db push
pnpm prisma generate

# 5. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/workflows`.

> 📘 For detailed setup instructions including OAuth app configuration, Inngest setup, and troubleshooting, see [GETTING_STARTED.md](./GETTING_STARTED.md)

---

## 📚 Documentation

| Document | Description |
|---|---|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System architecture, component diagram, request lifecycle, design principles |
| **[TECH_STACK.md](./TECH_STACK.md)** | Technology choices with rationale and version details |
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Developer onboarding, environment setup, troubleshooting |
| **[DATABASE.md](./DATABASE.md)** | Schema reference, ERD, migrations, data access patterns |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | tRPC routers, procedures, input/output schemas |
| **[AUTHENTICATION.md](./AUTHENTICATION.md)** | Auth system, OAuth setup, authorization matrix |
| **[WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md)** | Execution engine deep-dive, DAG processing, executor pattern |
| **[FEATURE_MODULES.md](./FEATURE_MODULES.md)** | Feature-based architecture conventions |
| **[FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)** | Component hierarchy, routing, styling patterns |
| **[STATE_AND_DATA_FLOW.md](./STATE_AND_DATA_FLOW.md)** | State management layers and data flow |
| **[CONFIGURATION.md](./CONFIGURATION.md)** | Environment variables, config files reference |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Deployment guide and production checklist |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Contributing guidelines and development workflow |
| **[mcp/](./mcp/README.md)** | MCP server — protocol, architecture, tools, security, operations |
| **[mcp-client-agent/](./mcp-client-agent/README.md)** | Autonomous Agent, External Clients & Standardized MCP Apps Architecture |
| **[adr/](./adr/)** | Architecture Decision Records |

---

## 📜 Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js development server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm inngest:dev` | Start local Inngest dev server |

---

## 📄 License

This project is part of a final-year academic project.

---

<div align="center">
  <sub>Built with ❤️ using Next.js, React Flow, Inngest, and tRPC</sub>
</div>
