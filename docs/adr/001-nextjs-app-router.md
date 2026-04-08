# ADR-001: Next.js App Router as Full-Stack Framework

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

Nodebase needs a framework that supports:
- Server-Side Rendering (SSR) for fast page loads and SEO
- API routes for tRPC, auth, and webhook endpoints
- React Server Components for efficient data fetching
- File-system routing with layouts and route groups
- TypeScript-first development
- Easy deployment to Vercel and other platforms

We evaluated several options for the core framework.

## Decision

**We chose Next.js 16 with the App Router.**

### Key Reasons

1. **Full-stack in one framework** — SSR pages, API routes, static assets, and serverless functions in a single deployment unit. No separate backend server needed.

2. **React Server Components** — Server-rendered by default, reducing client JavaScript bundle size. Data fetching happens on the server (direct Prisma calls in layouts) without client-side loading spinners.

3. **App Router layout system** — Route groups (`(auth)`, `(dashboard)`, `(editor)`) enable different layouts without URL changes. Shared sidebar across dashboard pages without re-mounting.

4. **React Compiler** — Next.js 16 includes the React Compiler (`reactCompiler: true`), eliminating the need for manual `useMemo`/`useCallback` optimization.

5. **Turbopack** — Faster development iteration with incremental compilation.

6. **Ecosystem** — Largest React framework ecosystem: shadcn/ui, tRPC, Better Auth, Inngest all have first-class Next.js integrations.

## Alternatives Considered

| Framework | Reason for Rejection |
|---|---|
| **Pages Router** | No React Server Components, no layouts, no route groups. Legacy architecture. |
| **Remix** | Strong conventions but smaller ecosystem. Fewer third-party integrations. |
| **Vite + React Router** | No SSR out of the box. Would need separate backend for API routes, auth, and webhooks. |
| **SvelteKit** | Different component model — team familiarity with React was a priority. |

## Consequences

### Positive
- Single deployment artifact (no microservices to manage)
- Instant page loads via Server Component prefetching
- Built-in API routes eliminate the need for Express/Fastify
- React Compiler removes performance footguns
- Excellent Vercel deployment experience

### Negative
- Tight coupling to React ecosystem
- App Router is relatively new — some patterns are still evolving
- Turbopack is still maturing (occasional cold start delays in dev)
- Vendor affinity toward Vercel (though self-hosting is supported)

### Risks
- Major Next.js version upgrades can introduce breaking changes
- App Router best practices are still emerging in the community

---

*Related: [ARCHITECTURE.md](../ARCHITECTURE.md) · [TECH_STACK.md](../TECH_STACK.md)*
