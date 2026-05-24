# ADR-002: tRPC for End-to-End Type-Safe API

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

a8n needs an API layer that:
- Provides type safety from server to client without code generation
- Supports authentication and authorization middleware
- Handles input validation
- Works with TanStack Query for data caching
- Supports batch requests for performance
- Integrates with Next.js App Router

## Decision

**We chose tRPC v11 as the API layer.**

### Key Reasons

1. **Zero code generation** — Change a Prisma model or router return type, and TypeScript catches all client-side incompatibilities immediately. No `codegen` step, no schema files to maintain.

2. **Middleware-based auth** — Three-tier authorization (`baseProcedure` → `protectedProcedure` → `premiumProcedure`) defined once and reused across all procedures.

3. **Zod input validation** — Procedure inputs are validated at runtime with Zod schemas, with types automatically inferred on the client.

4. **TanStack Query integration** — `@trpc/tanstack-react-query` provides `queryOptions()` and `mutationOptions()` patterns that enable SSR prefetching and cache invalidation.

5. **Batch transport** — `httpBatchLink` combines multiple procedure calls into a single HTTP request, reducing waterfall requests.

6. **SuperJSON transformer** — Serializes `Date`, `Map`, `Set`, and `BigInt` transparently between server and client.

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **REST (manual)** | No automatic type safety. Would require maintaining separate type definitions for request/response shapes. |
| **GraphQL** | Requires schema definition language, code generation (`graphql-codegen`), and resolvers. Over-engineered for a single-client application. |
| **Server Actions only** | Lack of middleware support, no batch transport, no structured query/mutation distinction. |
| **Hono RPC** | Newer alternative, but tRPC has a more mature TanStack Query integration. |

## Consequences

### Positive
- Type errors caught at compile time across the full stack
- Procedure middleware chain enables clean auth separation
- Automatic input validation via Zod
- Works seamlessly with SSR prefetching pattern
- Batch requests reduce HTTP overhead

### Negative
- Not RESTful — cannot be consumed by non-TypeScript clients without adaptation
- tRPC-specific patterns (routers, procedures) have a learning curve
- Debugging network requests is less intuitive than REST (batched, encoded paths)

### Risks
- If the project needs a public API for external consumers, a REST or GraphQL layer would need to be added alongside tRPC

---

*Related: [API_REFERENCE.md](../API_REFERENCE.md) · [TECH_STACK.md](../TECH_STACK.md)*
