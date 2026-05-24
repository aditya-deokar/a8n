# a8n — 3 Resume Versions

---

## Version 1: Full-Stack Engineer Target

> Emphasizes: system design, API architecture, security, real-time infra, frontend engineering.

```latex
\textbf{a8n — AI-Native Workflow Automation Platform}
\hfill
\href{https://github.com/aditya-deokar/a8n}{\faGithub} \quad
\href{https://a8n.aditya-deokar.me}{Live} \\
\textit{Next.js 16, React 19, tRPC v11, Inngest v4, Prisma 7, React Flow, MCP SDK}\\
\textit{Full-Stack Platform with Durable Execution Engine \& Model Context Protocol Server}

\begin{itemize}
    \item Architected a \textbf{dual-interface platform} serving both a web UI (tRPC v11, 15 procedures, 3-tier middleware) and an AI-client API (\textbf{MCP server} with 22 tools across 6 domains) — both backed by a shared Prisma 7 data layer with the Neon serverless adapter, eliminating TCP connection overhead in a Vercel-deployed serverless environment.
    \item Engineered a \textbf{durable execution engine} on Inngest step functions that topologically sorts workflow DAGs and executes nodes with per-step retry isolation — streaming real-time node status (loading → success → error) across 9 typed channels to the browser via \texttt{useInngestSubscription}, with an \texttt{onFailure} handler persisting error stacks for post-mortem debugging.
    \item Built a visual \textbf{React Flow DAG editor} with 10 custom node types, an executor-registry pattern mapping each \texttt{NodeType} to a typed \texttt{NodeExecutor} interface, and Handlebars context propagation — backed by Jotai atomic state, \texttt{nuqs} URL-persisted pagination, and TanStack Query prefetching via Server Components for zero-spinner page loads.
    \item Implemented \textbf{5-layer defense-in-depth security}: Better Auth sessions (GitHub/Google OAuth), tRPC middleware authorization (\texttt{protected → premium} with Polar.sh subscription gating), row-level data isolation via \texttt{userId} filtering on every query, AES-256 credential encryption with runtime-only decryption, and Zod v4 schema validation across all 15 tRPC procedures and 22 MCP tools.
\end{itemize}
```

---

## Version 2: AI Engineer Target

> Emphasizes: MCP protocol, AI provider integration, agent-accessible infrastructure, prompt engineering patterns.

```latex
\textbf{a8n — AI-Native Workflow Automation Platform}
\hfill
\href{https://github.com/aditya-deokar/a8n}{\faGithub} \quad
\href{https://a8n.aditya-deokar.me}{Live} \\
\textit{Next.js 16, MCP SDK, Vercel AI SDK, Inngest v4, tRPC v11, Prisma 7}\\
\textit{AI-Agent-Accessible Platform with MCP Server \& Multi-Provider Inference Pipelines}

\begin{itemize}
    \item Designed and shipped a production-grade \textbf{Model Context Protocol (MCP) server} exposing 22 tools across 6 domains (workflows, credentials, executions, nodes, system, API keys), 4 resources, and 3 prompts via Streamable HTTP — with scoped bearer-token auth (SHA-256 hashed, 8-permission bitfield), tiered rate limiting, and structured audit logging — enabling Cursor, Claude Desktop, and Antigravity to orchestrate the entire platform programmatically.
    \item Engineered a \textbf{multi-provider AI execution layer} using the Vercel AI SDK with 3 provider nodes (GPT-4, Claude, Gemini), each following a typed \texttt{NodeExecutor} interface — credentials decrypted at runtime via AES-256, prompts interpolated through Handlebars templates with upstream context access (\texttt{\{\{variable.path\}\}}), and AI calls wrapped in \texttt{step.ai.wrap()} for Inngest telemetry and step-level durability.
    \item Built a \textbf{durable DAG execution engine} on Inngest step functions that topologically sorts workflow graphs and chains node outputs into an immutable context — enabling multi-step AI inference pipelines where each model's output feeds the next node's prompt, with per-step retry isolation and 9 realtime channels streaming node status to the browser.
    \item Implemented a \textbf{scope-guard middleware layer} for the MCP server with API key permission scoping (read/write/execute per domain), request-level audit context injection, and JSON-RPC 2.0 error boundary wrapping — ensuring AI agents operate within least-privilege boundaries while maintaining full observability through structured audit logs.
\end{itemize}
```

---

## Version 3: Compact (Both Roles — 3 Bullets)

> Tight, high-density version for space-constrained resumes. Works for Full-Stack + AI hybrid roles.

```latex
\textbf{a8n — AI-Native Workflow Automation Platform}
\hfill
\href{https://github.com/aditya-deokar/a8n}{\faGithub} \quad
\href{https://a8n.aditya-deokar.me}{Live} \\
\textit{Next.js 16, React 19, tRPC v11, Inngest v4, MCP SDK, Vercel AI SDK, Prisma 7}\\
\textit{Full-Stack Workflow Platform with Durable Execution \& AI-Agent Protocol Server}

\begin{itemize}
    \item Engineered a \textbf{durable workflow execution engine} on Inngest step functions with topological DAG sorting, per-step retry isolation, and 9 typed realtime channels streaming node-level status to the browser — executing multi-step AI inference pipelines (GPT-4, Claude, Gemini via Vercel AI SDK) with AES-256 credential encryption and Handlebars-based prompt context chaining.
    \item Designed a production-grade \textbf{MCP server} exposing 22 tools across 6 domains via Streamable HTTP transport, with scoped API key auth (SHA-256, 8-permission bitfield), tiered rate limiting (30/120 req/min), and structured audit logging — enabling 7+ AI clients (Cursor, Claude Desktop, Antigravity) to programmatically manage workflows, trigger executions, and query results through JSON-RPC 2.0.
    \item Built a \textbf{dual-interface architecture}: a React Flow DAG editor (10 custom nodes, executor-registry pattern) served by tRPC v11 (15 procedures, 3-tier auth middleware with Polar.sh subscription gating) and the MCP server — both backed by Prisma 7 with Neon serverless PostgreSQL, row-level data isolation, and 5-layer defense-in-depth security.
\end{itemize}
```

---

## Quick Selection Guide

| You're applying for... | Use Version | Why |
|---|---|---|
| **Full-Stack / SDE** | Version 1 | Leads with system architecture, tRPC, React Flow, security layers |
| **AI / ML Engineer** | Version 2 | Leads with MCP protocol, AI provider integration, agent infrastructure |
| **Hybrid / Startup** | Version 3 | Compact 3-bullet version covering both sides in tight space |
| **Resume is tight on space** | Version 3 | 3 bullets vs 4, every word earns its place |

> [!TIP]
> **Pairing with Verto AI:** If using Version 3 (compact) for a8n, keep Verto AI at 4 bullets — or vice versa. The stronger project for the target role should get 4 bullets, the supporting project gets 3.
