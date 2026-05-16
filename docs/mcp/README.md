# Nodebase MCP Server — Documentation Hub

> **Last Updated:** May 2026  
> **Status:** Living documentation for the Nodebase Model Context Protocol server

---

## What is this?

The **Nodebase MCP Server** exposes workflow automation operations to AI-powered clients (Cursor, Claude Desktop, MCP Inspector, and others) through the [Model Context Protocol](https://modelcontextprotocol.io/). It runs as a Streamable HTTP endpoint at `/api/mcp` and provides **22 tools**, **4 resources**, and **3 prompts** for managing workflows, credentials, executions, and API keys.

**Endpoint:** `POST /api/mcp` (Streamable HTTP)  
**Source:** [`src/mcp/`](../../src/mcp/)  
**Dashboard:** `/mcp` (API key management UI)

---

## Capability matrix

| Primitive | Count | Purpose |
|---|---|---|
| **Tools** | 22 | Actions: CRUD workflows, credentials, executions, API keys |
| **Resources** | 4 | Read-only context: schemas and API reference |
| **Prompts** | 3 | Guided templates for workflow creation and debugging |
| **Total capabilities** | 29 | 22 + 4 + 3 (matches dashboard count) |

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

### Understand this implementation

1. [04 — Architecture](./04-architecture.md) — module layout, request lifecycle
2. [08 — Platform Integration](./08-platform-integration.md) — MCP ↔ Prisma ↔ Inngest
3. [09 — Design Decisions](./09-design-decisions.md) — trade-offs and risks

### Build or extend tools

1. [06 — Tools Reference](./06-tools-reference.md) — all 22 tools with examples
2. [07 — Resources & Prompts](./07-resources-and-prompts.md) — URIs and guided prompts
3. [11 — Extending the Server](./11-extending-the-server.md) — add new capabilities

### Operate in production

1. [10 — Operations](./10-operations.md) — env vars, deployment, monitoring
2. [05 — Security & Auth](./05-security-and-auth.md) — least privilege, key rotation

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

---

## Quick links

| Resource | Location |
|---|---|
| MCP server factory | [`src/mcp/index.ts`](../../src/mcp/index.ts) |
| HTTP route | [`src/app/api/mcp/route.ts`](../../src/app/api/mcp/route.ts) |
| Dev API key seeder | [`scripts/mcp-seed-key.ts`](../../scripts/mcp-seed-key.ts) |
| Dashboard UI | [`src/features/mcp/`](../../src/features/mcp/) |
| ADR (architecture decision) | [adr/008-mcp-streamable-http-server.md](../adr/008-mcp-streamable-http-server.md) |
| Legacy client guide (redirect) | [MCP_CLIENT_SETUP.md](../MCP_CLIENT_SETUP.md) |
| Historical build checklist | [n8n_mcp_server_implementation_plan.md](../n8n_mcp_server_implementation_plan.md) |

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
  <sub>Nodebase MCP Server v1.0.0 — Built with @modelcontextprotocol/sdk</sub>
</div>
