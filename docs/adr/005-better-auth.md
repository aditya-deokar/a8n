# ADR-005: Better Auth for Authentication

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

Nodebase requires:
- Email/password authentication
- Social login (GitHub, Google)
- Session management (database-backed)
- Prisma adapter for database storage
- Plugin ecosystem for billing integration (Polar.sh)
- Full control over the auth system (self-hosted, no external redirects)

## Decision

**We chose Better Auth v1.6 as the authentication library.**

### Key Reasons

1. **Self-hosted** — Auth runs entirely within our application. No external service dependency, no redirect to third-party login pages.

2. **Prisma adapter** — Stores users, sessions, and accounts in our existing PostgreSQL database. No separate auth database.

3. **Plugin ecosystem** — The `@polar-sh/better-auth` plugin integrates subscription billing directly into the auth flow (customer creation on signup, checkout, portal).

4. **Simple API** — Both server (`auth.api.getSession()`) and client (`authClient.useSession()`) APIs are clean and minimal.

5. **Lightweight** — Minimal dependencies compared to NextAuth. No complex adapter configuration or callback handling.

6. **Auto sign-in** — `autoSignIn: true` logs users in immediately after registration — no separate login step.

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **NextAuth (Auth.js)** | Complex configuration, frequent breaking changes between versions, adapter issues with Prisma. Plugin ecosystem is less mature. |
| **Clerk** | External service dependency. Pricing at scale. Auth UI hosted externally (redirects). Vendor lock-in. |
| **Auth0** | Enterprise-oriented pricing. External redirect flow. Complex configuration for simple use cases. |
| **Lucia Auth** | Was deprecated during our evaluation. Community recommended Better Auth as successor. |
| **Custom auth** | Significant engineering effort. Security risks with DIY session management, password hashing, CSRF protection. |

## Consequences

### Positive
- Full control — self-hosted, no external dependencies
- Clean integration with Prisma and Polar.sh
- Simple, predictable API surface
- Database-backed sessions with audit trail (IP, user agent)
- Plugin architecture enables billing integration without custom code

### Negative
- Smaller community compared to NextAuth/Clerk
- Fewer built-in providers (but GitHub and Google cover our needs)
- Less documentation and fewer community examples
- Manual configuration for advanced features (2FA, email verification)

### Risks
- Better Auth is a newer library — API stability is less proven over time
- Polar.sh plugin ties auth and billing together — difficult to replace one without the other

---

*Related: [AUTHENTICATION.md](../AUTHENTICATION.md) · [TECH_STACK.md](../TECH_STACK.md)*
