# ⚙️ Configuration Reference

> **Last Updated:** April 2026  
> **Location:** Environment variables (`.env`), config files (project root + `src/config/`)

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [App Constants](#app-constants)
- [Component Configuration](#component-configuration)

---

## Environment Variables

All environment variables are loaded from `.env` in the project root. The `.env` file is git-ignored — see `.env.example` for the template.

### Complete Variable Reference

#### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Neon PostgreSQL connection string |

**Format:** `postgresql://<user>:<password>@<host>/<database>?sslmode=require&channel_binding=require`

**Where Used:**
- `prisma.config.ts` — Prisma CLI database connection
- `src/lib/db.ts` — `PrismaNeon` adapter connection string

---

#### Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ | — | Session encryption key (32+ characters) |
| `BETTER_AUTH_URL` | ✅ | — | Base URL of the app |

**How to Generate:**
```bash
openssl rand -base64 32
```

**Where Used:**
- `src/lib/auth.ts` — Better Auth server configuration (auto-detected from env)

---

#### OAuth Providers

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | Optional | — | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Optional | — | GitHub OAuth App Client Secret |
| `GOOGLE_CLIENT_ID` | Optional | — | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | — | Google OAuth Client Secret |

**Where Used:**
- `src/lib/auth.ts` — Better Auth `socialProviders` configuration

**Setup:**
- GitHub: [Developer Settings → OAuth Apps](https://github.com/settings/developers)
  - Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`
- Google: [Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
  - Redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`

> **Note:** OAuth is optional for development. Email/password auth works without these.

---

#### Encryption

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENCRYPTION_KEY` | ✅ | — | AES-256 encryption key for credentials |

**How to Generate:**
```bash
openssl rand -base64 32
```

**Where Used:**
- `src/lib/encryption.ts` — `Cryptr` instance for `encrypt()` / `decrypt()`

**Security:**
- This key encrypts all API credentials stored in the database
- Changing this key **invalidates all existing encrypted credentials**
- Never commit this to version control

---

#### Billing

| Variable | Required | Default | Description |
|---|---|---|---|
| `POLAR_ACCESS_TOKEN` | ✅ | — | Polar.sh API access token |
| `POLAR_SUCCESS_URL` | ✅ | — | Post-checkout redirect URL |

**Format:**
```
POLAR_ACCESS_TOKEN=polar_oat_<your_token>
POLAR_SUCCESS_URL=http://localhost:3000/success?checkout_id={CHECKOUT_ID}
```

**Where Used:**
- `src/lib/polar.ts` — Polar SDK client initialization
- `src/lib/auth.ts` — Better Auth Polar plugin `checkout.successUrl`
- `src/trpc/init.ts` — `premiumProcedure` subscription checks

**Setup:**
- Get token from [Polar Dashboard → Settings → Personal Access Tokens](https://polar.sh/settings)
- Use `sandbox` server mode for development (configured in `src/lib/polar.ts`)

---

#### Public URLs

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | — | Public base URL of the application |

**Where Used:**
- Client-side code can access `NEXT_PUBLIC_*` variables (Next.js convention)
- Used for generating webhook URLs and share links

---

#### MCP Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_AUDIT_LOG_ENABLED` | No | `true` | Set to `"false"` to disable MCP audit console output |
| `MCP_CORS_ORIGINS` | No | `"*"` | Allowed CORS origins (defined in config; not wired to route yet) |

**Where Used:**
- `src/mcp/config.ts` — `MCP_CONFIG.AUDIT_LOG_ENABLED`, `MCP_CONFIG.CORS_ORIGINS`
- `src/mcp/middleware/audit-logger.ts` — structured request logging

**Planned (not implemented):**
- `MCP_SERVER_ENABLED` — feature flag to disable the endpoint
- `MCP_API_KEY_SECRET` — server secret for HMAC API key hashing
- `MCP_RATE_LIMIT_ENABLED` — toggle rate limiting

> Full MCP operations guide: [mcp/10-operations.md](./mcp/10-operations.md)

---

#### Development

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Environment mode |
| `NGROK_URL` | No | — | ngrok tunnel URL for webhook testing |
| `NGROK_AUTHTOKEN` | No | — | ngrok authentication token |

**Where Used:**
- `NODE_ENV` — Conditional logic (retry count, Prisma singleton)
- Inngest: 3 retries in production, 0 retries in development
- Prisma: Global singleton only in development (prevents HMR connection leaks)

---

### Variable Validation Flow

Variables are validated at different points:

```
Application Start
├── Prisma: DATABASE_URL validated on first query (PrismaNeon adapter)
├── Better Auth: BETTER_AUTH_SECRET validated on server init
├── Cryptr: ENCRYPTION_KEY validated on first encrypt/decrypt
├── Polar: POLAR_ACCESS_TOKEN validated on first API call
└── OAuth: Client IDs validated on OAuth flow initiation
```

> **Note:** There is no centralized env validation (like `zod` parsing at startup). Variables are validated when first accessed by their respective libraries.

---

### Environment Variable Summary

```env
# ===== REQUIRED =====
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="32-char-random-string"
BETTER_AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="32-char-random-string"
POLAR_ACCESS_TOKEN="polar_oat_..."
POLAR_SUCCESS_URL="http://localhost:3000/success?checkout_id={CHECKOUT_ID}"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ===== OPTIONAL (OAuth) =====
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ===== OPTIONAL (Development) =====
NODE_ENV=development
NGROK_URL=
NGROK_AUTHTOKEN=
```

---

## Configuration Files

### `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,        // Enable React Compiler (auto-memoization)
  turbopack: { root: "." },   // Turbopack dev server configuration
  async redirects() {
    return [{
      source: "/",
      destination: "/workflows",
      permanent: false,         // Root redirects to workflows dashboard
    }];
  },
};

export default nextConfig;
```

| Option | Value | Purpose |
|---|---|---|
| `reactCompiler` | `true` | Automatic memoization — no manual `useMemo`/`useCallback` |
| `turbopack.root` | `"."` | Turbopack root directory for development |
| `redirects` | `/ → /workflows` | Root URL redirects to main dashboard |

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts", "**/*.ts", "**/*.tsx",
    ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

| Option | Value | Purpose |
|---|---|---|
| `strict` | `true` | Full strict mode (null checks, type safety) |
| `paths.@/*` | `./src/*` | Import alias: `@/lib/db` → `src/lib/db` |
| `jsx` | `react-jsx` | React 19 JSX transform |
| `moduleResolution` | `bundler` | Modern bundler resolution (Next.js/Turbopack) |
| `incremental` | `true` | Faster re-compilations |

---

### `prisma.config.ts`

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

| Option | Value | Purpose |
|---|---|---|
| `schema` | `prisma/schema.prisma` | Schema file location |
| `datasource.url` | `env('DATABASE_URL')` | Database URL from environment |

---

### `components.json` (shadcn/ui)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "gray",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

| Option | Value | Purpose |
|---|---|---|
| `style` | `"new-york"` | shadcn/ui design variant |
| `rsc` | `true` | Server Component support |
| `baseColor` | `"gray"` | Neutral color scheme |
| `cssVariables` | `true` | Theme via CSS variables (not Tailwind config) |

---

### `postcss.config.mjs`

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

Tailwind CSS v4 uses a PostCSS plugin instead of the legacy `tailwind.config.js`.

---

### `eslint.config.mjs`

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
export default eslintConfig;
```

| Config | Purpose |
|---|---|
| `next/core-web-vitals` | Performance rules (no large images, proper links) |
| `next/typescript` | TypeScript-specific Next.js rules |

---

## App Constants

### Pagination Defaults

```typescript
// src/config/constants.ts
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 5,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
};
```

Used by all features via `params.ts` and tRPC input validation.

### Node Component Registry

```typescript
// src/config/node-components.ts
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTrigger,
  [NodeType.STRIPE_TRIGGER]: StripeTriggerNode,
  [NodeType.GEMINI]: GeminiNode,
  [NodeType.OPENAI]: OpenAiNode,
  [NodeType.ANTHROPIC]: AnthropicNode,
  [NodeType.DISCORD]: DiscordNode,
  [NodeType.SLACK]: SlackNode,
} as const satisfies NodeTypes;
```

Maps `NodeType` enum values to React Flow components for rendering.

---

## Component Configuration

### Query Client

```typescript
// src/trpc/query-client.ts
staleTime: 30 * 1000       // 30 seconds
```

### React Flow Editor

```typescript
// features/editor/components/editor.tsx
snapGrid: [10, 10]          // 10px snap grid
snapToGrid: true
panOnScroll: true            // Scroll to pan
panOnDrag: false             // Disable drag-to-pan
selectionOnDrag: true        // Drag to select
fitView: true                // Auto-fit on load
```

### Search Debounce

```typescript
// hooks/use-entity-search.tsx
debounceMs: 500              // 500ms search debounce
```

### Mobile Breakpoint

```typescript
// hooks/use-mobile.ts
MOBILE_BREAKPOINT: 768       // 768px mobile detection
```

### Polar SDK

```typescript
// src/lib/polar.ts
server: "sandbox"            // Use "production" for live billing
```

### Inngest Retries

```typescript
// src/inngest/functions.ts
retries: process.env.NODE_ENV === "production" ? 3 : 0
```

---

## Related Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) — How to set up environment variables
- [ARCHITECTURE.md](./ARCHITECTURE.md) — How configuration fits into the system
- [TECH_STACK.md](./TECH_STACK.md) — Technology versions and rationale
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production configuration differences
