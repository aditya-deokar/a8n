# ADR-006: Neon Serverless PostgreSQL

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

a8n needs a relational database that:
- Supports complex queries with joins and foreign keys (workflow → nodes → connections)
- Works in serverless environments (Vercel's ephemeral functions)
- Handles connection pooling without manual configuration
- Provides a generous free tier for development
- Offers a Prisma adapter for type-safe queries

Traditional PostgreSQL with persistent TCP connections is problematic in serverless environments because:
- Each function invocation may create a new connection
- Connections are not reused across invocations
- Connection limits are quickly exhausted under load

## Decision

**We chose Neon PostgreSQL with the `@prisma/adapter-neon` HTTP adapter.**

### Key Reasons

1. **HTTP-based connections** — The `PrismaNeon` adapter uses HTTP requests instead of persistent TCP connections. No connection pooling issues in serverless.

2. **Serverless-native** — Neon's architecture is designed for serverless: auto-scaling compute, connection pooling at the proxy level, and instant cold starts.

3. **Prisma integration** — First-class adapter (`@prisma/adapter-neon`) that works transparently with the Prisma Client API.

4. **Free tier** — Generous free tier for development and small projects (0.5 GiB storage, 190+ hours of compute per month).

5. **Database branching** — Neon supports database branches, enabling preview deployment databases in CI/CD (each PR gets its own database).

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **Self-hosted PostgreSQL** | Requires infrastructure management. Persistent connections exhaust limits in serverless. No auto-scaling. |
| **Supabase** | Good PostgreSQL offering, but bundles auth, storage, and realtime — we only need the database. Adding Supabase would create overlap with Better Auth and Inngest. |
| **PlanetScale (MySQL)** | Uses Vitess which doesn't support foreign keys. Our schema relies heavily on foreign key constraints for cascade deletes. |
| **MongoDB (Atlas)** | Document model doesn't fit the relational nature of workflows → nodes → connections → executions. Prisma's MongoDB support is also less mature. |
| **SQLite (Turso)** | Limited concurrent write support. Embedded nature complicates multi-region deployment. |

## Consequences

### Positive
- Zero connection pool management in serverless
- Auto-scaling compute (no capacity planning)
- Database branching for preview deployments
- Standard PostgreSQL — no proprietary extensions required
- Transparent integration via Prisma adapter

### Negative
- HTTP-based connections have higher latency per query than TCP
- Neon's proxy adds a small overhead compared to direct PostgreSQL connections
- Free tier has compute hour limits (cold starts after inactivity)
- Dependent on Neon's infrastructure availability

### Risks
- Neon is a venture-backed startup — long-term pricing and availability risk
- HTTP adapter may not support all Prisma features identically to native driver

---

*Related: [DATABASE.md](../DATABASE.md) · [TECH_STACK.md](../TECH_STACK.md)*
