# 🤝 Contributing Guide

> **Last Updated:** April 2026

Thank you for your interest in contributing to a8n! This guide covers the development workflow, coding conventions, and standards to maintain a consistent and high-quality codebase.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style & Conventions](#code-style--conventions)
- [Architecture Conventions](#architecture-conventions)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Adding Features](#adding-features)

---

## Getting Started

1. **Read the docs first** — Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system design
2. **Set up your environment** — Follow [GETTING_STARTED.md](./GETTING_STARTED.md)
3. **Understand the module system** — Read [FEATURE_MODULES.md](./FEATURE_MODULES.md)

---

## Development Workflow

### 1. Branch Strategy

```
main                    ← Production-ready (deployed on push)
  └── feature/xxx       ← Feature branches (short-lived)
  └── fix/xxx           ← Bug fixes
  └── refactor/xxx      ← Refactoring
```

### 2. Local Development

```bash
# Start the dev server
pnpm dev

# In a separate terminal, start Inngest
pnpm inngest:dev

# Run linting
pnpm lint

# Run type checking
pnpm build
```

### 3. Before Submitting

```bash
# Verify everything builds
pnpm build

# Run linter
pnpm lint

# Verify database is in sync
pnpm prisma generate
```

---

## Code Style & Conventions

### TypeScript

| Rule | Convention |
|---|---|
| **Strict mode** | Always — `strict: true` in `tsconfig.json` |
| **Type imports** | Use `import type { ... }` for type-only imports |
| **Enum imports** | Import enums from `@/generated/prisma` |
| **No `any`** | Avoid `any` — use `unknown` or specific types |
| **Non-null assertion** | Minimize `!` usage — prefer runtime checks |

### File Naming

| Type | Convention | Example |
|---|---|---|
| **Components** | PascalCase | `WorkflowEditor.tsx` |
| **Hooks** | camelCase with `use-` prefix | `use-workflows.ts` |
| **Utilities** | kebab-case | `auth-utils.ts` |
| **Types** | PascalCase | `types.ts` |
| **Server files** | kebab-case | `routers.ts`, `prefetch.ts` |
| **Constants** | SCREAMING_SNAKE_CASE | `PAGINATION.DEFAULT_PAGE` |

### Import Order

```typescript
// 1. External libraries
import { useState, useCallback } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

// 2. Internal shared modules (@ alias)
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 3. Relative imports (same feature)
import { useWorkflowsParams } from '../hooks/use-workflows-params';
import type { WorkflowData } from '../types';
```

### Component Conventions

```typescript
// ✅ Use named exports (not default)
export const Workflows = () => { ... };

// ✅ Mark client components explicitly
"use client";

// ✅ Mark server actions explicitly
"use server";

// ✅ Use Server Components by default — add "use client" only when needed

// ✅ Destructure props with TypeScript
export const WorkflowCard = ({ 
  workflow, 
  onDelete 
}: { 
  workflow: Workflow;
  onDelete: (id: string) => void;
}) => { ... };
```

### Hook Conventions

```typescript
// ✅ Prefix with "use"
export const useSuspenseWorkflows = () => { ... };

// ✅ Return objects (not arrays) for named destructuring
export const useEntitySearch = () => {
  return { searchValue, onSearchChange };
};

// ✅ Each mutation hook handles its own toast notifications
export const useCreateWorkflow = () => {
  return useMutation(trpc.workflows.create.mutationOptions({
    onSuccess: () => toast.success("Created!"),
    onError: (error) => toast.error(error.message),
  }));
};
```

---

## Architecture Conventions

### Feature Module Structure

Every new feature should follow the established module pattern:

```
features/<name>/
├── components/       # React components
├── hooks/            # Custom hooks
├── server/           # tRPC router + prefetch
├── params.ts         # URL params (if listing page)
└── types.ts          # TypeScript types
```

→ See [FEATURE_MODULES.md](./FEATURE_MODULES.md) for the full guide.

### Server/Client Boundary

| Rule | Guidance |
|---|---|
| **Default to Server Components** | Only add `"use client"` when you need interactivity |
| **`"use client"` at the leaf** | Push client boundaries as deep as possible |
| **No Prisma on client** | Database queries only in Server Components or tRPC routers |
| **No hooks in Server Components** | `useState`, `useEffect`, etc. require `"use client"` |

### tRPC Conventions

| Rule | Guidance |
|---|---|
| **Use `protectedProcedure`** for all authenticated endpoints | Never expose data without auth |
| **Use `premiumProcedure`** for creation/mutation that requires billing | Workflow/credential creation |
| **Always filter by `userId`** | Every query must scope to the authenticated user |
| **Validate inputs with Zod** | Every procedure input must have a Zod schema |
| **Use transactions for multi-step operations** | `prisma.$transaction()` for atomic updates |

### Naming Conventions

| Entity | Singular | Plural | Router | Hook |
|---|---|---|---|---|
| Workflow | `Workflow` | `Workflows` | `workflowsRouter` | `useSuspenseWorkflows` |
| Credential | `Credential` | `Credentials` | `credentialsRouter` | `useSuspenseCredentials` |
| Execution | `Execution` | `Executions` | `executionsRouter` | `useSuspenseExecutions` |

---

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

### Types

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `chore` | Tooling, deps, config |
| `perf` | Performance improvement |

### Scopes

| Scope | Area |
|---|---|
| `workflows` | Workflow feature module |
| `editor` | React Flow editor |
| `credentials` | Credential vault |
| `executions` | Execution engine / history |
| `auth` | Authentication |
| `billing` | Subscription billing |
| `api` | tRPC routers |
| `db` | Database / Prisma schema |
| `ui` | Shared UI components |

### Examples

```
feat(editor): add snap-to-grid alignment options
fix(auth): resolve GitHub OAuth callback redirect loop
refactor(workflows): extract pagination into shared hook
docs(engine): add executor deep-dive documentation
chore(deps): upgrade Next.js to 16.3.0
feat(executions): add Slack node executor
fix(db): add cascade delete for workflow connections
```

---

## Pull Request Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/add-slack-executor
```

### 2. Make Your Changes

- Follow the coding conventions above
- Keep PRs focused — one feature or fix per PR
- Include documentation updates if public APIs change

### 3. Self-Review Checklist

Before requesting review, verify:

- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] No `console.log` statements
- [ ] TypeScript strict mode passes
- [ ] New code follows feature module conventions
- [ ] tRPC procedures have proper auth levels
- [ ] Database queries filter by `userId`
- [ ] Zod schemas validate all inputs
- [ ] Toast messages for user-facing errors
- [ ] Relevant docs updated

### 4. PR Description Template

```markdown
## What Changed

<Brief description of the change>

## Why

<Motivation and context>

## How to Test

1. Start the dev server
2. Navigate to ...
3. Verify ...

## Checklist

- [ ] Build passes
- [ ] Documentation updated
- [ ] Feature follows module conventions
```

---

## Adding Features

### Adding a New Node Type

The most common contribution pattern. Follow the 8-step guide in [WORKFLOW_ENGINE.md → Adding a New Node Type](./WORKFLOW_ENGINE.md#adding-a-new-node-type).

**Summary:**
1. Add enum to `prisma/schema.prisma`
2. Create Inngest realtime channel
3. Create executor function
4. Register in executor registry
5. Create React Flow node component
6. Register in node component registry
7. Add channel to Inngest function
8. Create server action for realtime token

### Adding a New Feature Module

Follow the guide in [FEATURE_MODULES.md → Creating a New Feature Module](./FEATURE_MODULES.md#creating-a-new-feature-module).

### Adding a New tRPC Procedure

1. Add the procedure to the appropriate router in `features/<module>/server/routers.ts`
2. Choose the correct procedure type (`protectedProcedure` or `premiumProcedure`)
3. Add Zod input validation
4. Filter queries by `userId`
5. Create a data hook in `features/<module>/hooks/`
6. Add a prefetch helper in `features/<module>/server/prefetch.ts` (for queries)

### Modifying the Database Schema

1. Edit `prisma/schema.prisma`
2. Create a migration: `pnpm prisma migrate dev --name describe_change`
3. Regenerate the client: `pnpm prisma generate`
4. Update affected tRPC routers and types
5. Update documentation ([DATABASE.md](./DATABASE.md))

---

## Documentation

When your change affects documented systems:

| Change Type | Documents to Update |
|---|---|
| New node type | WORKFLOW_ENGINE.md, DATABASE.md (enum) |
| New tRPC procedure | API_REFERENCE.md |
| New feature module | FEATURE_MODULES.md |
| Schema change | DATABASE.md |
| New environment variable | CONFIGURATION.md, GETTING_STARTED.md |
| Auth change | AUTHENTICATION.md |
| New dependency | TECH_STACK.md |
| Architecture decision | Create new ADR in `docs/adr/` |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and principles
- [FEATURE_MODULES.md](./FEATURE_MODULES.md) — Module structure guide
- [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md) — Adding new node types
- [API_REFERENCE.md](./API_REFERENCE.md) — tRPC procedure reference
- [DATABASE.md](./DATABASE.md) — Schema modification guide
- [adr/](./adr/) — Architecture Decision Records
