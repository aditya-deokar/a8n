import type { DetailedProject } from "./project.type";

export const a8nClone: DetailedProject = {
  name: "a8n",
  tagline: "An AI-native workflow automation platform with a visual DAG editor, durable execution engine, and a production-grade MCP server for AI-client orchestration.",
  year: "2025–2026",
  role: "Full-Stack Engineer & System Architect",
  duration: "6 months",
  team: "Solo Project",
  category: "AI Workflow Automation Platform",
  liveUrl: "https://a8n.aditya-deokar.me",
  repoUrl: "https://github.com/aditya-deokar/a8n",
  docsUrl: "https://github.com/aditya-deokar/a8n/tree/master/docs",
  navigation: ["Work", "Features", "Technology", "Architecture", "Contact"],
  overviewDescription: "a8n is a full-stack, self-hosted workflow automation platform built on Next.js 16 (App Router). It combines a drag-and-drop React Flow editor with a durable Inngest execution engine, multi-provider AI nodes (OpenAI, Anthropic, Gemini), AES-256 credential encryption, and a production-grade MCP server that exposes 22 tools, 4 resources, and 3 prompts — enabling AI clients like Cursor, Claude Desktop, and Antigravity to programmatically manage workflows, trigger executions, and query results through the Model Context Protocol.",
  overviewKeyPoints: [
    {
      number: "01",
      title: "Challenge",
      description: "Building a workflow platform that's both visually intuitive for drag-and-drop users and programmatically accessible for AI agents — requiring durable execution with real-time observability across multi-step AI pipelines."
    },
    {
      number: "02",
      title: "Solution",
      description: "A layered architecture with tRPC for type-safe APIs, Inngest for durable step-function execution with 9 real-time channels, and a stateless MCP server with scoped API keys and Streamable HTTP transport for AI-client integration."
    },
    {
      number: "03",
      title: "Impact",
      description: "Enables both human operators and AI agents to build, execute, and monitor multi-step automation pipelines — from webhook triggers through AI inference to integration delivery — with full auditability and zero data loss."
    },
    {
      number: "04",
      title: "Innovation",
      description: "One of the first workflow platforms to implement a full MCP server with 22 tools across 6 domains, scoped bearer-token auth, rate limiting, and structured audit logging — making the entire platform AI-agent-accessible."
    }
  ],
  overviewQuote: {
    text: "Bridging visual workflow design with AI-agent orchestration — where every node, credential, and execution is accessible through both a premium drag-and-drop editor and a production-grade Model Context Protocol server.",
    label: "Architecture Vision"
  },
  architectureHighlights: [
    {
      title: "Layered Monolith",
      description: "Next.js 16 App Router with Server Components for data fetching, Client Components for interactivity, tRPC for type-safe APIs, and Inngest for durable execution — all in a single deployable unit.",
      icon: "layers"
    },
    {
      title: "Dual API Surface",
      description: "tRPC v11 serves the web UI with end-to-end type safety, while the MCP server at /api/mcp serves AI clients with Streamable HTTP transport — both backed by the same Prisma data layer.",
      icon: "api"
    },
    {
      title: "Durable Execution",
      description: "Inngest step functions provide per-step retry, automatic failure recovery, and real-time progress streaming via 9 dedicated channels — each node execution is individually durable.",
      icon: "shield"
    },
    {
      title: "Security in Depth",
      description: "5-layer security: Better Auth sessions, tRPC middleware authorization, row-level data isolation, AES-256 credential encryption (Cryptr), and Zod schema validation on every input.",
      icon: "lock"
    }
  ],
  technologies: {
    frontend: [
      {
        name: "Next.js 16",
        category: "React Framework",
        version: "16.2.2",
        description: "App Router with React Server Components, React Compiler (automatic memoization), Turbopack dev server, and streaming SSR with Suspense boundaries."
      },
      {
        name: "React 19",
        category: "UI Library",
        version: "19.2.4",
        description: "Server Components for zero-JS data fetching, concurrent features, and React Compiler compatibility for automatic memoization."
      },
      {
        name: "TypeScript 6",
        category: "Language",
        version: "^6",
        description: "Strict mode across the entire codebase — types flow from Prisma schema through tRPC routers to React components with zero manual definitions."
      },
      {
        name: "React Flow (XYFlow)",
        category: "DAG Editor",
        version: "12.10.2",
        description: "Powers the visual workflow editor with 10 custom node types, snap-to-grid, MiniMap navigation, and real-time execution status indicators."
      },
      {
        name: "shadcn/ui (Radix)",
        category: "UI Components",
        description: "53 accessible, customizable UI primitives — copy-pasted into the project for full control. Built on Radix UI, styled with Tailwind CSS v4."
      },
      {
        name: "Jotai",
        category: "Atomic State",
        version: "2.19.1",
        description: "Fine-grained atomic state for the React Flow editor instance — avoids unnecessary re-renders compared to Context."
      },
      {
        name: "TanStack Query",
        category: "Server State",
        version: "5.96.2",
        description: "Server state management via tRPC integration — prefetching, caching (30s stale time), and automatic cache invalidation on mutations."
      },
      {
        name: "nuqs",
        category: "URL State",
        version: "2.8.9",
        description: "Type-safe URL search parameter state — pagination, search, and filters persisted in the URL for shareability and browser history."
      },
      {
        name: "Framer Motion",
        category: "Animation",
        description: "Smooth node animations, canvas transitions, and premium landing page interactions with physics-based spring animations."
      },
      {
        name: "Tailwind CSS v4",
        category: "CSS Framework",
        version: "^4",
        description: "Utility-first styling with CSS custom properties for theme tokens, class-variance-authority (CVA) for variant-based component styling."
      }
    ],
    backend: [
      {
        name: "tRPC v11",
        category: "Type-Safe API",
        version: "11.16.0",
        description: "End-to-end type safety with zero codegen. 3 routers (workflows, credentials, executions), 15 procedures, SuperJSON transformer, and a 3-tier middleware stack (base → protected → premium)."
      },
      {
        name: "Inngest v4",
        category: "Durable Execution Engine",
        version: "4.2.0",
        description: "Event-driven durable step functions for workflow execution — per-step retry, automatic failure recovery, 9 real-time channels, and onFailure handlers."
      },
      {
        name: "Prisma v7",
        category: "ORM & Data Layer",
        version: "7.7.0",
        description: "Type-safe database client with auto-generated types, the Neon serverless adapter (HTTP-based, no persistent TCP connections), and migration management."
      },
      {
        name: "Better Auth",
        category: "Authentication",
        version: "1.6.0",
        description: "Self-hosted auth with email/password + GitHub/Google OAuth. Plugin ecosystem integrates Polar.sh billing — auto-creates customers on signup."
      },
      {
        name: "MCP Server",
        category: "AI Client Protocol",
        version: "1.0.0",
        description: "Production-grade Model Context Protocol server at /api/mcp — 22 tools across 6 domains, 4 resources, 3 prompts, scoped API keys, rate limiting, and structured audit logging."
      },
      {
        name: "Polar.sh",
        category: "Subscription Billing",
        version: "0.47.0",
        description: "Subscription management with Better Auth plugin integration — checkout flows, billing portal, and tRPC premiumProcedure gating for paid features."
      },
      {
        name: "Cryptr (AES-256)",
        category: "Encryption",
        description: "AES-256 encryption for credential values at rest — API keys decrypted only at execution time, scoped to the workflow owner's userId."
      },
      {
        name: "Zod v4",
        category: "Validation",
        version: "4.3.6",
        description: "Runtime schema validation on every tRPC procedure and MCP tool input. Zod schemas auto-convert to JSON Schema for MCP tool definitions."
      }
    ],
    ai: [
      {
        name: "Vercel AI SDK",
        category: "Unified AI Interface",
        version: "6.0.153",
        description: "Provider-agnostic abstraction for calling OpenAI, Anthropic, and Google models — each executor follows the same NodeExecutor interface with step.ai.wrap() for Inngest telemetry."
      },
      {
        name: "OpenAI (GPT-4)",
        category: "AI Provider",
        version: "@ai-sdk/openai 3.0.52",
        description: "Text generation node with Handlebars template interpolation for system/user prompts. Credentials decrypted at runtime, scoped to workflow owner."
      },
      {
        name: "Anthropic (Claude)",
        category: "AI Provider",
        version: "@ai-sdk/anthropic 3.0.68",
        description: "Claude model integration with the same executor pattern — supports context-aware prompt chaining across workflow nodes."
      },
      {
        name: "Google (Gemini)",
        category: "AI Provider",
        version: "@ai-sdk/google 3.0.60",
        description: "Gemini model integration — configurable system/user prompts with upstream context access via Handlebars {{variable.path}} syntax."
      }
    ],
    infrastructure: [
      {
        name: "Neon PostgreSQL",
        category: "Serverless Database",
        description: "Serverless PostgreSQL with HTTP-based connections (PrismaNeon adapter), automatic connection pooling, auto-scaling, and branch-based preview deployments."
      },
      {
        name: "Vercel",
        category: "Deployment Platform",
        description: "Serverless deployment with automatic preview URLs, edge functions, and Inngest integration for background job processing."
      },
      {
        name: "pnpm",
        category: "Package Manager",
        description: "Fast, disk-efficient package management with strict dependency resolution and workspace support."
      },
      {
        name: "mprocs",
        category: "Process Manager",
        description: "Parallel process runner for local development — runs Next.js dev server and Inngest dev server simultaneously."
      }
    ]
  },
  techStats: {
    totalTechnologies: "28+",
    typescriptCoverage: "100%",
    aiModels: "3 (GPT-4 · Claude · Gemini)",
    mcpTools: "22 tools · 4 resources · 3 prompts",
    nodeTypes: "10 registered"
  },
  overview:
    "a8n is a production-grade workflow automation platform that combines a visual DAG editor (React Flow) with a durable execution engine (Inngest) and a full MCP server for AI-client orchestration. Users design multi-step workflows by connecting trigger nodes (manual, webhook, Stripe), processing nodes (HTTP requests, AI inference), and integration nodes (Discord, Slack) — then execute them with real-time per-node status streaming, automatic retries, and full execution history. The MCP server enables AI agents to manage the entire platform programmatically — creating workflows, triggering executions, querying results, and managing credentials — all through the Model Context Protocol.",
  features: [
    {
      number: "01",
      title: "Visual DAG Workflow Editor",
      description: "A full-featured React Flow editor with 10 custom node types, snap-to-grid canvas, MiniMap navigation, and real-time execution status indicators. Nodes are connected into directed acyclic graphs, topologically sorted, and executed in dependency order by the Inngest engine.",
      tags: ["React Flow", "DAG Editor", "Custom Nodes", "Topological Sort"],
      impact: [
        { metric: "10", label: "Custom Node Types" },
        { metric: "Real-time", label: "Execution Status" },
        { metric: "DAG", label: "Topological Execution" }
      ]
    },
    {
      number: "02",
      title: "Durable Inngest Execution Engine",
      description: "Event-driven step functions that execute workflows with per-step durability — if step 3 fails and retries, steps 1–2 don't re-execute. 9 dedicated real-time channels stream node-level progress (loading → success → error) to the browser via Server-Sent Events.",
      tags: ["Inngest", "Durable Steps", "Real-time Channels", "Auto-Retry"],
      impact: [
        { metric: "9", label: "Realtime Channels" },
        { metric: "Per-Step", label: "Durability & Retry" },
        { metric: "5-Step", label: "Execution Pipeline" }
      ]
    },
    {
      number: "03",
      title: "Model Context Protocol (MCP) Server",
      description: "A production-grade MCP server at /api/mcp exposing 22 tools across 6 domains (workflows, credentials, executions, nodes, system, API keys). Features scoped bearer-token authentication, tiered rate limiting (30/120 req/min), structured audit logging, and Streamable HTTP transport — compatible with Cursor, Claude Desktop, and Antigravity.",
      tags: ["MCP", "22 Tools", "Scoped API Keys", "Streamable HTTP"],
      impact: [
        { metric: "22", label: "MCP Tools" },
        { metric: "6", label: "Tool Domains" },
        { metric: "8", label: "Permission Scopes" }
      ]
    },
    {
      number: "04",
      title: "Multi-Provider AI Nodes",
      description: "Three AI provider nodes (OpenAI, Anthropic, Gemini) powered by the Vercel AI SDK. Each executor decrypts credentials at runtime, interpolates Handlebars template prompts with upstream context, and wraps AI calls in Inngest step.ai.wrap() for telemetry and durability.",
      tags: ["Vercel AI SDK", "GPT-4", "Claude", "Gemini"],
      impact: [
        { metric: "3", label: "AI Providers" },
        { metric: "AES-256", label: "Credential Encryption" },
        { metric: "Handlebars", label: "Prompt Templates" }
      ]
    },
    {
      number: "05",
      title: "End-to-End Type-Safe Architecture",
      description: "Types flow from the Prisma schema through tRPC routers to React components without manual type definitions. A 3-tier tRPC middleware stack (baseProcedure → protectedProcedure → premiumProcedure) enforces authentication and subscription gating at the API layer.",
      tags: ["tRPC v11", "Prisma Types", "Zod Validation", "Type Inference"],
      impact: [
        { metric: "15", label: "tRPC Procedures" },
        { metric: "Zero", label: "Manual Type Definitions" },
        { metric: "3-Tier", label: "Auth Middleware" }
      ]
    },
    {
      number: "06",
      title: "5-Layer Security Architecture",
      description: "Defense-in-depth: Better Auth session validation, tRPC middleware authorization, row-level data isolation (userId filtering on every query), AES-256 credential encryption at rest (Cryptr), and Zod schema validation on every API input. MCP adds scoped API keys with SHA-256 hashing.",
      tags: ["Better Auth", "Row-Level Isolation", "AES-256", "Scoped Keys"],
      impact: [
        { metric: "5", label: "Security Layers" },
        { metric: "SHA-256", label: "API Key Hashing" },
        { metric: "Row-Level", label: "Data Isolation" }
      ]
    }
  ],
  process: [
    {
      phase: "01",
      title: "Architecture Design",
      subtitle: "Designing a Dual-Interface Platform",
      description: "Researched workflow automation platforms (a8n, Temporal, Inngest) and AI-agent protocols (MCP, LangChain). Designed a layered monolith architecture with clear separation: web UI via tRPC, AI clients via MCP, and durable execution via Inngest — all sharing the same Prisma data layer.",
      keywords: ["System Design", "Architecture Decision Records", "Protocol Research"]
    },
    {
      phase: "02",
      title: "Core Engine & Editor",
      subtitle: "Building the Execution Pipeline & Visual Editor",
      description: "Implemented the React Flow DAG editor with 10 custom node types, the topological sort algorithm for dependency-ordered execution, and the Inngest durable step function with real-time progress streaming via 9 dedicated channels.",
      keywords: ["React Flow", "Topological Sort", "Inngest Step Functions", "Realtime Channels"]
    },
    {
      phase: "03",
      title: "AI Nodes & Integrations",
      subtitle: "Multi-Provider AI & External Service Nodes",
      description: "Built executor implementations for 3 AI providers (OpenAI, Anthropic, Gemini) using the Vercel AI SDK, plus HTTP request, Discord, and Slack integration nodes — each following the NodeExecutor interface pattern with Handlebars template context propagation.",
      keywords: ["Vercel AI SDK", "Executor Pattern", "Credential Encryption", "Context Chaining"]
    },
    {
      phase: "04",
      title: "MCP Server & Security",
      subtitle: "AI-Agent Access & Production Hardening",
      description: "Designed and implemented the full MCP server with 22 tools, 4 resources, 3 prompts, scoped API key authentication (SHA-256 hashed), tiered rate limiting, structured audit logging, and scope-guard middleware. Built the dashboard UI for API key management with client configuration helpers.",
      keywords: ["Model Context Protocol", "Scoped API Keys", "Rate Limiting", "Audit Logging"]
    },
    {
      phase: "05",
      title: "Premium UI & Deployment",
      subtitle: "Glassmorphic Design System & Vercel Deployment",
      description: "Applied a premium glassmorphic design system across the entire dashboard and landing page with Framer Motion animations. Deployed to Vercel with Neon PostgreSQL, Inngest cloud integration, and Polar.sh subscription billing.",
      keywords: ["Glassmorphism", "Framer Motion", "Vercel Deployment", "Polar.sh Billing"]
    }
  ],
  processStats: {
    phases: "5",
    technologies: "28+",
    designIterations: "15+",
    nodeTypes: "10",
    mcpTools: "22",
    realtimeChannels: "9"
  },
  outcomes: [
    { metric: "22", label: "MCP Tools (6 domains)" },
    { metric: "10", label: "Custom Node Types" },
    { metric: "9", label: "Realtime Channels" },
    { metric: "15", label: "tRPC Procedures" },
    { metric: "100%", label: "TypeScript Strict Mode" },
    { metric: "5-Layer", label: "Security Architecture" },
    { metric: "3", label: "AI Providers (GPT-4 · Claude · Gemini)" },
    { metric: "53", label: "shadcn/ui Components" }
  ],
  footerCta: {
    heading: {
      text: "Ready to automate",
      highlight: "with AI agents",
      suffix: "and visual workflows?"
    },
    primaryButton: {
      text: "Launch Platform",
      url: "https://a8n.aditya-deokar.me"
    },
    secondaryButton: {
      text: "Read Documentation",
      url: "https://github.com/aditya-deokar/a8n/tree/master/docs"
    },
    contactInfo: [
      {
        label: "Email",
        value: "adityaofficialid@gmail.com",
        url: "mailto:adityaofficialid@gmail.com"
      },
      {
        label: "Stack",
        value: "Next.js 16 · tRPC · Inngest · MCP",
        url: null
      },
      {
        label: "Status",
        value: "Production Deployed",
        url: null,
        hasIndicator: true
      }
    ]
  },
  footer: {
    description: "a8n: AI-native workflow automation with visual editing and Model Context Protocol integration.",
    social: [
      { name: "GitHub", url: "https://github.com/aditya-deokar/a8n" },
      { name: "LinkedIn", url: "#" },
      { name: "X", url: "#" }
    ],
    quickLinks: ["Home", "Features", "Architecture", "Documentation"],
    projects: ["a8n", "MCP Server", "Workflow Engine", "AI Nodes"],
    resources: ["Architecture Docs", "API Reference", "MCP Guide", "Documentation"],
    legal: ["Privacy Policy", "Terms of Service"],
    copyright: "© 2026 Aditya Deokar",
    rightsReserved: "All Rights Reserved"
  }
};