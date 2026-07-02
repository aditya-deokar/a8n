# a8n MCP Server — Documentation Hub

> **Last Updated:** June 24, 2026  
> **Status:** Living documentation for the a8n Model Context Protocol server

---

## What is this?

The **a8n MCP Server** exposes workflow automation operations to AI-powered clients (Cursor, Claude Desktop, MCP Inspector, and others) through the [Model Context Protocol](https://modelcontextprotocol.io/). It runs as a Streamable HTTP endpoint at `/api/mcp` and provides **53 tools**, **17 resources**, **5 resource templates**, and **3 prompts** for managing workflows, drafts, safe edits, credentials, executions, app-style previews, integration setup, API keys, audit events, and capability discovery.

**Endpoint:** `POST /api/mcp` (Streamable HTTP)  
**Source:** [`src/mcp/`](../../src/mcp/)  
**Dashboard:** `/mcp` (API key management UI)

---

## Capability matrix

| Primitive | Count | Purpose |
|---|---|---|
| **Tools** | 53 | Actions: workflows, drafts, safe edits, versions, credentials, executions, integration setup, security/audit, API keys, capability search |
| **Resources** | 17 | Read-only context: schemas, catalogs, setup guides, app catalog, and API reference |
| **Resource templates** | 5 | Completable integration setup and app-style preview/checklist/timeline/approval URI templates |
| **Prompts** | 3 | Guided templates for workflow creation and debugging |
| **Total listed capabilities** | 78 | 53 + 17 + 5 + 3 |

---

## Reading paths

Choose the path that matches your goal:

### New to MCP

1. [01 — Introduction to MCP](./01-introduction-to-mcp.md) — concepts, primitives, ecosystem
2. [02 — Protocol Deep Dive](./02-protocol-deep-dive.md) — JSON-RPC, lifecycle, errors
3. [03 — Transports](./03-transports.md) — stdio, SSE, Streamable HTTP

### Integrate an AI client

1. [05 — Security & Auth](./05-security-and-auth.md) — API keys and scopes
2. [10 — Operations](./10-operations.md) — client configs, troubleshooting, deployment
3. [mcp-apps](./mcp-apps/) - phase-wise plan and implementation runbooks for turning the a8n MCP server into a ChatGPT App

### Understand this implementation

1. [04 — Architecture](./04-architecture.md) — module layout, request lifecycle
2. [08 — Platform Integration](./08-platform-integration.md) — MCP ↔ Prisma ↔ Inngest
3. [09 — Design Decisions](./09-design-decisions.md) — trade-offs and risks
4. [12 — Non-Technical Workflow Builder Plan](./12-non-technical-workflow-builder-plan.md) — roadmap for turning MCP into a beginner-friendly automation copilot
5. [13 — Evaluation And Rollout](./13-evaluation-and-rollout.md) — quality gate and rollout checklist

### Build or extend tools

1. [06 — Tools Reference](./06-tools-reference.md) — all 53 tools with examples
2. [07 — Resources & Prompts](./07-resources-and-prompts.md) — URIs and guided prompts
3. [11 — Extending the Server](./11-extending-the-server.md) — add new capabilities

### Operate in production

1. [10 — Operations](./10-operations.md) — env vars, deployment, monitoring
2. [05 — Security & Auth](./05-security-and-auth.md) — least privilege, key rotation
3. [13 — Evaluation And Rollout](./13-evaluation-and-rollout.md) — pre-release verification
4. [14 — Production Testing, Evals, and Security Hardening](./14-production-testing-evals-security-plan.md) — production-grade MCP assurance roadmap
5. [security/](./security/) — threat model, stop-ship checklist, and MCP security governance

---

## Documentation map

| Document | Description |
|---|---|
| [01-introduction-to-mcp.md](./01-introduction-to-mcp.md) | What MCP is, why it exists, core primitives |
| [02-protocol-deep-dive.md](./02-protocol-deep-dive.md) | JSON-RPC messages, capability negotiation |
| [03-transports.md](./03-transports.md) | Transport comparison; why Streamable HTTP |
| [04-architecture.md](./04-architecture.md) | Module layout, registries, stateless flow |
| [05-security-and-auth.md](./05-security-and-auth.md) | API keys, scopes, sanitization, rate limits |
| [06-tools-reference.md](./06-tools-reference.md) | Complete tool catalog with examples |
| [07-resources-and-prompts.md](./07-resources-and-prompts.md) | Resources and guided prompts |
| [08-platform-integration.md](./08-platform-integration.md) | MCP ↔ workflows, credentials, Inngest |
| [09-design-decisions.md](./09-design-decisions.md) | Trade-offs, alternatives, risk register |
| [10-operations.md](./10-operations.md) | Dev setup, deployment, troubleshooting |
| [11-extending-the-server.md](./11-extending-the-server.md) | Add tools, resources, prompts |
| [12-non-technical-workflow-builder-plan.md](./12-non-technical-workflow-builder-plan.md) | Phase-wise roadmap for beginner-safe workflow building |
| [13-evaluation-and-rollout.md](./13-evaluation-and-rollout.md) | Phase 8 eval suite, quality gates, and rollout checklist |
| [14-production-testing-evals-security-plan.md](./14-production-testing-evals-security-plan.md) | Production hardening plan for MCP testing, evals, prompt-injection defense, security, observability, and release gates |
| [security/](./security/) | MCP threat model, stop-ship checklist, and security governance |
| [mcp-apps/](./mcp-apps/) | ChatGPT Apps integration audit, implementation phases, UX, auth, security, and submission checklist |

---

## Quick links

| Resource | Location |
|---|---|
| MCP server factory | [`src/mcp/index.ts`](../../src/mcp/index.ts) |
| HTTP route | [`src/app/api/mcp/route.ts`](../../src/app/api/mcp/route.ts) |
| MCP evaluation script | [`scripts/mcp-eval.ts`](../../scripts/mcp-eval.ts) |
| MCP evaluation dataset | [`src/mcp/evals/non-technical-goals.ts`](../../src/mcp/evals/non-technical-goals.ts) |
| Dev API key seeder | [`scripts/mcp-seed-key.ts`](../../scripts/mcp-seed-key.ts) |
| Dashboard UI | [`src/features/mcp/`](../../src/features/mcp/) |
| ADR (architecture decision) | [adr/008-mcp-streamable-http-server.md](../adr/008-mcp-streamable-http-server.md) |
| Legacy client guide (redirect) | [MCP_CLIENT_SETUP.md](../MCP_CLIENT_SETUP.md) |
| Historical build checklist | [a8n_mcp_server_implementation_plan.md](../a8n_mcp_server_implementation_plan.md) |

---

## Related platform docs

| Document | Relevance |
|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Overall system architecture |
| [WORKFLOW_ENGINE.md](../WORKFLOW_ENGINE.md) | Inngest execution engine |
| [AUTHENTICATION.md](../AUTHENTICATION.md) | Better Auth (session tokens for MCP) |
| [CONFIGURATION.md](../CONFIGURATION.md) | Environment variables including MCP |

---

<div align="center">
  <sub>a8n MCP Server v1.0.0 — Built with @modelcontextprotocol/sdk</sub>
</div>
