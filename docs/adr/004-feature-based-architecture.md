# ADR-004: Feature-Based Modular Architecture

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

As the application grew, we needed a consistent way to organize code that:
- Makes it easy to find all related code for a feature
- Reduces cognitive load when working on a specific area
- Prevents tight coupling between unrelated features
- Scales as new features are added

The traditional "layer-based" organization (separating all components into `components/`, all hooks into `hooks/`, etc.) scatters related code across multiple directories.

## Decision

**We adopted a feature-based modular architecture under `src/features/`.**

Each feature module is a self-contained vertical slice:

```
features/<module>/
├── components/       # UI components
├── hooks/            # Data hooks
├── server/           # tRPC router + prefetch
├── params.ts         # URL state schema
└── types.ts          # TypeScript types
```

### Key Rules

1. **Feature modules own their domain** — All code for "workflows" lives in `features/workflows/`
2. **Shared code lives outside features** — `components/ui/`, `hooks/`, `lib/`, `config/` for cross-cutting concerns
3. **Modules communicate through hooks** — Never import another module's internal files directly
4. **Server logic stays private** — `server/` directory is never imported from client code

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **Layer-based** (`components/`, `services/`, `hooks/`, `models/`) | Modifying a single feature requires touching files in 4+ directories. No locality of reference. |
| **Domain-Driven Design (full)** | Too formal for a project of this size. DDD's bounded contexts, aggregates, and repositories add unnecessary abstraction. |
| **Flat structure** (everything in `src/`) | Doesn't scale — gets chaotic quickly as files accumulate. |

## Consequences

### Positive
- **Developer experience** — "Where is the workflow code?" → `features/workflows/`
- **Reduced coupling** — Features can be modified without affecting others
- **Onboarding** — New developers understand the module structure quickly
- **Scalability** — Adding a new feature = adding a new directory

### Negative
- Some duplication of structure across modules (boilerplate)
- Shared utilities need careful placement to avoid circular dependencies
- Not all modules use every directory (e.g., `subscriptions/` has only `hooks/`)

---

*Related: [FEATURE_MODULES.md](../FEATURE_MODULES.md) · [ARCHITECTURE.md](../ARCHITECTURE.md)*
