# MCP Design Decisions

> **Audience:** Architects and reviewers evaluating trade-offs  
> **Prerequisites:** [04 — Architecture](./04-architecture.md), [08 — Platform Integration](./08-platform-integration.md)  
> **Last Updated:** May 2026

---

## What you'll learn

- Key architectural decisions and their consequences
- Alternatives considered
- Risk register for production deployments

---

## Decision format

Each decision follows: **Context → Decision → Consequences**.

---

## AD-1: Stateless Streamable HTTP

### Context

MCP supports stdio, SSE, and Streamable HTTP transports. a8n is a deployed Next.js SaaS application.

### Decision

Use `WebStandardStreamableHTTPServerTransport` with `sessionIdGenerator: undefined` (stateless mode). New `McpServer` + transport per HTTP request.

### Consequences

| Positive | Negative |
|---|---|
| No session store; horizontal scaling friendly | Per-request server initialization overhead |
| Standard Bearer auth on every request | Auth must be re-established each request |
| Works with Cursor native HTTP support | Cannot maintain server-side conversation state |

### Alternatives considered

- **stdio subprocess:** Rejected — not suitable for multi-tenant remote access
- **Sessionful SSE:** Rejected — connection stickiness complexity behind load balancers

---

## AD-2: Direct Prisma in tools (not tRPC)

### Context

The dashboard uses tRPC routers for workflows, credentials, and executions. MCP could call tRPC or access Prisma directly.

### Decision

MCP tool handlers call **Prisma and shared utilities directly**, mirroring tRPC logic without invoking routers.

### Consequences

| Positive | Negative |
|---|---|
| No tRPC session/context coupling | Logic duplication risk |
| Clear, explicit queries per tool | Drift from tRPC (e.g. premium gating) |
| Faster to implement domain-specific MCP schemas | Two places to update for behavior changes |

### Mitigation

Document parity differences in [08 — Platform Integration](./08-platform-integration.md). Consider shared service layer if drift grows.

---

## AD-3: Text JSON tool responses

### Context

MCP supports structured content types. Tools could return typed content blocks.

### Decision

All tools return `mcpJsonResponse()` — a single text content block with stringified JSON.

### Consequences

| Positive | Negative |
|---|---|
| Universal client compatibility | Large payloads not structured at protocol level |
| Simple debugging (readable JSON strings) | No native schema validation on responses |
| Consistent pattern across 22 tools | LLM must parse JSON from text |

---

## AD-4: Static embedded resources

### Context

Resources could be loaded from database or generated dynamically.

### Decision

Four markdown resources embedded as TypeScript strings at build time.

### Consequences

| Positive | Negative |
|---|---|
| Always available; no DB dependency | Can drift from runtime behavior |
| Fast reads; no query latency | Requires deploy to update docs |
| Predictable LLM context size | `list_node_types` may differ from resource content |

### Mitigation

Use `list_node_types` and `server_info` for runtime truth; keep resources updated when node types change.

---

## AD-5: In-memory rate limiting and metrics

### Context

Production systems often use Redis or edge rate limiters.

### Decision

Sliding window rate limiter and request metrics stored in **process memory**.

### Consequences

| Positive | Negative |
|---|---|
| Zero external infrastructure | Incorrect limits across multiple instances |
| Simple implementation | Metrics lost on restart |
| No additional env config | Pro tier (120/min) defined but not selected in route |

### Alternatives considered

- **Redis rate limit:** Deferred — adds deployment complexity
- **Vercel edge middleware:** Could be future enhancement

---

## AD-6: Scoped API keys with wildcard

### Context

AI clients need programmatic access with varying permission levels.

### Decision

API keys with fine-grained scopes; wildcard `*` for full access. Session auth grants `ALL_SCOPES`.

### Consequences

| Positive | Negative |
|---|---|
| Least privilege for automation | Session tokens as powerful as wildcard keys |
| Self-serve key management via MCP + dashboard | Scope misconfiguration can block clients |
| Industry pattern (Cloudflare-style) | `*` keys dangerous if leaked |

---

## AD-7: SHA-256 key hashing without salt

### Context

API keys must be stored hashed. Options include bcrypt, HMAC with server secret, or SHA-256.

### Decision

`SHA-256(rawKey)` stored as hex digest. Lookup by hash equality.

### Consequences

| Positive | Negative |
|---|---|
| Simple, fast lookup | Weaker than salted/HMAC approach if DB leaks |
| Deterministic hash for lookup | `MCP_API_KEY_SECRET` planned but not implemented |

### Planned improvement

HMAC-SHA256 with server secret (`MCP_API_KEY_SECRET`) for defense in depth.

---

## Risk register

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Auth context not passed to tools | High | Current | Wire `auth` into `createMcpServer(auth)` |
| Multi-instance rate limit bypass | Medium | Production | Redis or edge rate limiter |
| tRPC/MCP behavior drift | Medium | Ongoing | Parity table; shared services |
| Resource schema drift | Low | On node changes | Update resources with code changes |
| Leaked wildcard API key | High | User error | Docs: never `*` in production |
| CORS not configured | Low | Browser clients | Implement `MCP_CORS_ORIGINS` in route |
| DB leak exposes key hashes | Medium | Low | Upgrade to HMAC hashing |

---

## Related ADR

See [adr/008-mcp-streamable-http-server.md](../adr/008-mcp-streamable-http-server.md) for the formal architecture decision record.

---

## Next steps

- [11 — Extending the Server](./11-extending-the-server.md)
- [05 — Security & Auth](./05-security-and-auth.md)

---

<div align="center">
  <sub>Part of the a8n MCP documentation series</sub>
</div>
