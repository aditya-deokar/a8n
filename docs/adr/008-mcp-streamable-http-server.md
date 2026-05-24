# ADR-008: MCP Server via Streamable HTTP

> **Status:** Accepted  
> **Date:** May 2026  
> **Deciders:** a8n team

---

## Context

a8n needs to expose workflow automation capabilities to AI-powered clients (Cursor, Claude Desktop, MCP Inspector). The [Model Context Protocol](https://modelcontextprotocol.io/) provides a standard for tools, resources, and prompts.

We needed to choose:

1. Whether to implement MCP at all vs custom OpenAPI function calling
2. Which transport to use (stdio, SSE, Streamable HTTP)
3. How to integrate with the existing Next.js App Router stack

---

## Decision

Implement an MCP server at `/api/mcp` using:

- `@modelcontextprotocol/sdk` v1.29+
- `WebStandardStreamableHTTPServerTransport` in **stateless** mode
- Bearer authentication (scoped API keys + session fallback)
- Registry pattern for 22 tools, 4 resources, 3 prompts in `src/mcp/`

---

## Consequences

### Positive

- Standard protocol supported by major AI IDEs
- Stateless HTTP fits Vercel/serverless deployment model
- Scoped API keys enable least-privilege automation
- Resources reduce LLM hallucination on workflow schemas

### Negative

- Parallel code path to tRPC (maintenance burden)
- In-memory rate limits do not work across instances
- Auth context injection into tool handlers incomplete (known gap)

### Neutral

- Text JSON responses (simple but not structured at protocol level)
- Static resources require deploy to update

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| stdio MCP server | Cannot serve remote multi-tenant users |
| Custom REST for agents | No standard discovery; per-client integration |
| Call tRPC from MCP tools | Session/context coupling; awkward for API keys |
| Sessionful SSE transport | Connection stickiness; more complex ops |

---

## References

- [MCP documentation hub](../mcp/README.md)
- [09 — Design Decisions](../mcp/09-design-decisions.md)
- [src/mcp/index.ts](../../src/mcp/index.ts)
- [src/app/api/mcp/route.ts](../../src/app/api/mcp/route.ts)

---

<div align="center">
  <sub>ADR-008 — a8n Architecture Decision Records</sub>
</div>
