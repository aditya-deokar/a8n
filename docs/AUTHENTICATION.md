# 🔑 Authentication & Authorization

> **Last Updated:** April 2026  
> **Auth Library:** Better Auth v1.6.0  
> **OAuth Providers:** GitHub, Google  
> **Billing Integration:** Polar.sh (via Better Auth plugin)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Server Configuration](#server-configuration)
- [Client Configuration](#client-configuration)
- [Auth Utilities](#auth-utilities)
- [Route Protection Strategy](#route-protection-strategy)
- [Session Management](#session-management)
- [API Routes](#api-routes)
- [Billing Integration](#billing-integration)
- [Authorization Matrix](#authorization-matrix)
- [Auth Flow Diagrams](#auth-flow-diagrams)

---

## Architecture Overview

```mermaid
graph TB
    subgraph Browser["🖥️ Browser"]
        AuthClient["authClient<br/>(better-auth/react)"]
        LoginPage["/login Page"]
        SignupPage["/signup Page"]
        SidebarUI["Sidebar<br/>(checkout, portal, logout)"]
    end

    subgraph Server["⚡ Next.js Server"]
        AuthHandler["/api/auth/[...all]<br/>toNextJsHandler(auth)"]
        AuthServer["auth<br/>(Better Auth Instance)"]
        PrismaAdapter["Prisma Adapter<br/>(PostgreSQL)"]
    end

    subgraph Middleware["🛡️ Middleware Layer"]
        RequireAuth["requireAuth()<br/>Server Component guard"]
        ProtectedProc["protectedProcedure<br/>tRPC middleware"]
        PremiumProc["premiumProcedure<br/>tRPC + Polar check"]
    end

    subgraph External["🌐 External"]
        GitHub["GitHub OAuth"]
        Google["Google OAuth"]
        PolarSh["Polar.sh<br/>Billing"]
    end

    subgraph Database["💾 Database"]
        UserTable["user"]
        SessionTable["session"]
        AccountTable["account"]
        VerificationTable["verification"]
    end

    AuthClient --> AuthHandler
    LoginPage --> AuthClient
    SignupPage --> AuthClient
    SidebarUI --> AuthClient
    
    AuthHandler --> AuthServer
    AuthServer --> PrismaAdapter
    PrismaAdapter --> UserTable
    PrismaAdapter --> SessionTable
    PrismaAdapter --> AccountTable
    PrismaAdapter --> VerificationTable
    
    AuthServer --> GitHub
    AuthServer --> Google
    AuthServer --> PolarSh
    
    RequireAuth --> AuthServer
    ProtectedProc --> AuthServer
    PremiumProc --> PolarSh
```

---

## Server Configuration

The auth server is configured in `src/lib/auth.ts`:

```typescript
import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/db";
import { polarClient } from "./polar";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,    // Auto-login after registration
  },
  
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,    // Sync user → Polar customer
      use: [
        checkout({
          products: [{
            productId: "58285280-605b-468f-b711-5b5c9ff936bd",
            slug: "pro",
          }],
          successUrl: process.env.POLAR_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
        portal(),    // Billing portal access
      ],
    })
  ]
});
```

### Configuration Breakdown

| Feature | Setting | Behavior |
|---|---|---|
| **Database** | `prismaAdapter(prisma, { provider: "postgresql" })` | Stores auth data in Neon PostgreSQL via Prisma |
| **Email/Password** | `enabled: true, autoSignIn: true` | Users can register with email; auto-logged in on signup |
| **GitHub OAuth** | `clientId` + `clientSecret` from env | "Login with GitHub" button |
| **Google OAuth** | `clientId` + `clientSecret` from env | "Login with Google" button |
| **Polar Plugin** | `createCustomerOnSignUp: true` | Creates Polar billing customer on every new registration |
| **Checkout** | `slug: "pro"`, `authenticatedUsersOnly: true` | Only logged-in users can purchase Pro plan |
| **Portal** | `portal()` | Users can manage subscriptions via `authClient.customer.portal()` |

---

## Client Configuration

The auth client is configured in `src/lib/auth-client.ts`:

```typescript
import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [polarClient()],
});
```

### Client API

| Method | Purpose | Example |
|---|---|---|
| `authClient.signUp.email()` | Register with email/password | `authClient.signUp.email({ name, email, password })` |
| `authClient.signIn.email()` | Login with email/password | `authClient.signIn.email({ email, password })` |
| `authClient.signIn.social()` | OAuth login | `authClient.signIn.social({ provider: "github" })` |
| `authClient.signOut()` | Logout and clear session | `authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })` |
| `authClient.useSession()` | React hook for session state | `const { data: session, isPending } = authClient.useSession()` |
| `authClient.checkout()` | Initiate Polar checkout | `authClient.checkout({ slug: "pro" })` |
| `authClient.customer.portal()` | Open billing portal | Direct navigation to Polar portal |

---

## Auth Utilities

Server-side utility functions in `src/lib/auth-utils.ts`:

### `requireAuth()`

Validates the current session in Server Components. Redirects to `/login` if unauthenticated.

```typescript
export const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session;
};
```

**Usage (in Server Components / pages):**
```typescript
export default async function DashboardPage() {
  const session = await requireAuth();
  // session.user.id, session.user.name, etc.
}
```

### `requireUnauth()`

Inverse of `requireAuth`. Redirects authenticated users away from auth pages.

```typescript
export const requireUnauth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }
};
```

**Usage (in login/signup pages):**
```typescript
export default async function LoginPage() {
  await requireUnauth(); // Redirects away if already logged in
  return <LoginForm />;
}
```

---

## Route Protection Strategy

a8n uses **three layers** of route protection:

### Layer 1: Server Component Guards

For pages — redirect unauthenticated users before any rendering occurs.

```typescript
// In page server component or layout
const session = await requireAuth();
```

### Layer 2: tRPC Middleware

For API calls — reject unauthenticated requests with proper HTTP status codes.

```typescript
// protectedProcedure
const session = await auth.api.getSession({ headers: await headers() });
if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
return next({ ctx: { ...ctx, auth: session } });
```

### Layer 3: Subscription Gating

For premium features — verify active Polar subscription.

```typescript
// premiumProcedure (extends protectedProcedure)
const customer = await polarClient.customers.getStateExternal({
  externalId: ctx.auth.user.id,
});
if (!customer.activeSubscriptions?.length) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
}
```

### Protection by Route

| Route | Protection | Method |
|---|---|---|
| `/login` | `requireUnauth()` — redirect if authenticated | Server Component |
| `/signup` | `requireUnauth()` — redirect if authenticated | Server Component |
| `/workflows` | `requireAuth()` — redirect if unauthenticated | Server Component |
| `/credentials` | `requireAuth()` — redirect if unauthenticated | Server Component |
| `/executions` | `requireAuth()` — redirect if unauthenticated | Server Component |
| `/workflows/:id` (editor) | `requireAuth()` — redirect if unauthenticated | Server Component |
| `workflows.getMany` | `protectedProcedure` | tRPC Middleware |
| `workflows.create` | `premiumProcedure` | tRPC Middleware |
| `credentials.create` | `premiumProcedure` | tRPC Middleware |

---

## Session Management

### Session Storage

Sessions are stored in the `session` database table:

| Field | Purpose |
|---|---|
| `token` | Unique session identifier (sent as cookie) |
| `expiresAt` | Session expiration time |
| `ipAddress` | Client IP at login time (audit trail) |
| `userAgent` | Browser at login time (audit trail) |
| `userId` | FK → user who owns this session |

### Session Resolution

On each request, Better Auth resolves the session from the request headers:

```typescript
const session = await auth.api.getSession({
  headers: await headers(), // Next.js request headers
});
// Returns: { user: { id, name, email, ... }, session: { token, expiresAt, ... } }
// Or null if not authenticated
```

### Session Lifecycle

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant A as Better Auth
    participant DB as Database

    U->>B: Submit login form
    B->>A: POST /api/auth/sign-in/email
    A->>DB: Validate credentials
    DB-->>A: User found
    A->>DB: Create Session record
    A-->>B: Set-Cookie (session token)
    B-->>U: Redirect to /workflows

    Note over B,A: Subsequent requests
    B->>A: Request with cookie
    A->>DB: Lookup session by token
    DB-->>A: Session + User
    A-->>B: Authenticated response
```

---

## API Routes

### Auth Handler

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

This catch-all route handles all Better Auth endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/sign-up/email` | POST | Email/password registration |
| `/api/auth/sign-in/email` | POST | Email/password login |
| `/api/auth/sign-in/social` | POST | Initiate OAuth flow |
| `/api/auth/callback/:provider` | GET | OAuth callback handler |
| `/api/auth/sign-out` | POST | Logout and clear session |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/checkout` | POST | Initiate Polar checkout |
| `/api/auth/customer/portal` | POST | Open Polar billing portal |

---

## Billing Integration

### Polar.sh Client

```typescript
// src/lib/polar.ts
import { Polar } from "@polar-sh/sdk";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox"  // Use "production" for live billing
});
```

### Customer Lifecycle

```mermaid
sequenceDiagram
    participant U as User
    participant BA as Better Auth
    participant P as Polar.sh

    U->>BA: Sign up
    BA->>P: Create customer (externalId = user.id)
    P-->>BA: Customer created
    
    U->>BA: Click "Upgrade to Pro"
    BA->>P: authClient.checkout({ slug: "pro" })
    P-->>U: Redirect to checkout page
    U->>P: Complete payment
    P-->>U: Redirect to success URL
    
    Note over BA,P: Subsequent premium checks
    BA->>P: polarClient.customers.getStateExternal({ externalId })
    P-->>BA: { activeSubscriptions: [...] }
    BA->>BA: Allow/deny based on subscription state
```

### Sidebar Billing UI

The sidebar (`src/components/app-sidebar.tsx`) includes billing actions:

```typescript
// Show upgrade button only for free users
{!hasActiveSubscription && !isLoading && (
  <SidebarMenuButton onClick={() => authClient.checkout({ slug: "pro" })}>
    <StarIcon /> Upgrade to Pro
  </SidebarMenuButton>
)}

// Always show billing portal
<SidebarMenuButton onClick={() => authClient.customer.portal()}>
  <CreditCardIcon /> Billing Portal
</SidebarMenuButton>

// Logout
<SidebarMenuButton onClick={() => authClient.signOut(/* ... */)}>
  <LogOutIcon /> Sign out
</SidebarMenuButton>
```

---

## Authorization Matrix

### Resource-Level Permissions

| Resource Action | Unauthenticated | Free (Authenticated) | Pro (Subscribed) |
|---|---|---|---|
| View login/signup pages | ✅ | ❌ (redirected away) | ❌ (redirected away) |
| View workflows list | ❌ → `/login` | ✅ (own only) | ✅ (own only) |
| Create workflow | ❌ | ❌ (`FORBIDDEN`) | ✅ |
| Edit workflow (nodes/edges) | ❌ | ✅ (own only) | ✅ (own only) |
| Delete workflow | ❌ | ✅ (own only) | ✅ (own only) |
| Rename workflow | ❌ | ✅ (own only) | ✅ (own only) |
| Execute workflow | ❌ | ✅ (own only) | ✅ (own only) |
| View executions | ❌ | ✅ (own only) | ✅ (own only) |
| Create credential | ❌ | ❌ (`FORBIDDEN`) | ✅ |
| Edit/delete credential | ❌ | ✅ (own only) | ✅ (own only) |
| View credentials | ❌ | ✅ (own only) | ✅ (own only) |
| Checkout (upgrade) | ❌ | ✅ | ✅ (manage existing) |
| Billing portal | ❌ | ✅ | ✅ |

### Data Isolation

All data access is filtered by `userId`:

```
WHERE userId = ctx.auth.user.id          -- Direct resources
WHERE workflow.userId = ctx.auth.user.id -- Nested resources (executions)
WHERE { id: credentialId, userId }       -- Credential access in executors
```

There is **no admin role** or cross-tenant access. Every user sees only their own data.

---

## Auth Flow Diagrams

### Email/Password Registration

```mermaid
sequenceDiagram
    participant U as User
    participant F as Signup Form
    participant AC as authClient
    participant API as /api/auth/sign-up/email
    participant DB as Database
    participant P as Polar.sh

    U->>F: Fill name, email, password
    F->>AC: authClient.signUp.email({ name, email, password })
    AC->>API: POST /api/auth/sign-up/email
    API->>DB: Create User record
    API->>DB: Create Account record (email/password)
    API->>P: Create Polar customer (externalId = user.id)
    API->>DB: Create Session record
    API-->>AC: Set-Cookie + session data
    AC-->>F: Success (autoSignIn)
    F-->>U: Redirect to /workflows
```

### GitHub OAuth Login

```mermaid
sequenceDiagram
    participant U as User
    participant AC as authClient
    participant API as /api/auth
    participant GH as GitHub
    participant DB as Database

    U->>AC: authClient.signIn.social({ provider: "github" })
    AC->>API: POST /api/auth/sign-in/social
    API-->>U: Redirect to GitHub OAuth
    U->>GH: Authorize a8n
    GH-->>API: GET /api/auth/callback/github?code=xxx
    API->>GH: Exchange code for token
    GH-->>API: Access token + profile
    API->>DB: Find or create User
    API->>DB: Create/update Account (github)
    API->>DB: Create Session
    API-->>U: Redirect to / (with session cookie)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ | Session encryption key (32+ characters) |
| `BETTER_AUTH_URL` | ✅ | Base URL of the app (`http://localhost:3000`) |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth App Client Secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth Client Secret |
| `POLAR_ACCESS_TOKEN` | ✅ | Polar.sh API access token |
| `POLAR_SUCCESS_URL` | ✅ | Post-checkout redirect URL |

→ See [CONFIGURATION.md](./CONFIGURATION.md) for complete environment setup.

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Auth layer in the system architecture
- [DATABASE.md](./DATABASE.md) — User, Session, Account, Verification models
- [API_REFERENCE.md](./API_REFERENCE.md) — Procedure authorization levels
- [GETTING_STARTED.md](./GETTING_STARTED.md) — OAuth app setup instructions
