# 🚀 Getting Started

> **Last Updated:** April 2026  
> **Time to setup:** ~15 minutes

This guide walks you through setting up the Nodebase development environment from scratch. By the end, you'll have the full application running locally with authentication, database, and the workflow execution engine.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Clone & Install](#1-clone--install)
- [2. Environment Setup](#2-environment-setup)
- [3. Database Setup](#3-database-setup)
- [4. Running the Dev Server](#4-running-the-dev-server)
- [5. Verifying the Setup](#5-verifying-the-setup)
- [Common Issues & Troubleshooting](#common-issues--troubleshooting)
- [IDE Setup](#ide-setup)
- [Available Scripts](#available-scripts)

---

## Prerequisites

Before starting, ensure you have the following installed:

| Requirement | Minimum Version | How to Check |
|---|---|---|
| **Node.js** | 18.x or later | `node --version` |
| **pnpm** | 8.x or later | `pnpm --version` |
| **Git** | Any recent version | `git --version` |

You'll also need accounts for:

| Service | Purpose | Signup |
|---|---|---|
| **Neon** | Serverless PostgreSQL database | [neon.tech](https://neon.tech) (free tier available) |
| **Polar.sh** | Subscription billing | [polar.sh](https://polar.sh) (free for sandbox) |
| **GitHub OAuth App** | Social login (optional) | [GitHub Developer Settings](https://github.com/settings/developers) |
| **Google OAuth App** | Social login (optional) | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |

> **Note:** GitHub and Google OAuth are optional for development. You can use email/password authentication while setting up.

---

## 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd n8n

# Install dependencies with pnpm
pnpm install
```

If you encounter build dependency prompts, approve them:
```bash
pnpm approve-builds
```

This allows Prisma and esbuild to run their post-install build steps (configured in `package.json` under `pnpm.onlyBuiltDependencies`).

---

## 2. Environment Setup

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then configure each variable:

### Required Variables

| Variable | Description | How to Get |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Neon Dashboard → Connection Details → Connection string |
| `BETTER_AUTH_SECRET` | Session encryption key (32+ chars) | Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Base URL of your app | `http://localhost:3000` |
| `ENCRYPTION_KEY` | AES-256 key for credential encryption | Generate: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |

### Authentication Variables

| Variable | Description | How to Get |
|---|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | GitHub Settings → Developer Settings → OAuth Apps → New |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Same as above |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Same as above |

**GitHub OAuth App Setup:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Homepage URL: `http://localhost:3000`
4. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. Copy Client ID and Client Secret

**Google OAuth App Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret

### Billing Variables

| Variable | Description | How to Get |
|---|---|---|
| `POLAR_ACCESS_TOKEN` | Polar.sh API token | Polar Dashboard → Settings → Personal Access Tokens |
| `POLAR_SUCCESS_URL` | Post-checkout redirect | `http://localhost:3000/success?checkout_id={CHECKOUT_ID}` |

> **Tip:** Use Polar's **sandbox** mode for development — set `server: "sandbox"` in `lib/polar.ts` (already configured).

### Development Variables (Optional)

| Variable | Description | Purpose |
|---|---|---|
| `NGROK_URL` | ngrok tunnel URL | Testing webhooks locally |
| `NGROK_AUTHTOKEN` | ngrok auth token | Authenticating ngrok sessions |
| `NODE_ENV` | Environment | Set to `development` automatically |

### Complete `.env` Template

```env
# ═══════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# ═══════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════
BETTER_AUTH_SECRET="your-random-32-char-secret"
BETTER_AUTH_URL="http://localhost:3000"

# GitHub OAuth (optional for dev)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google OAuth (optional for dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ═══════════════════════════════════════════
# ENCRYPTION
# ═══════════════════════════════════════════
ENCRYPTION_KEY="your-random-32-char-encryption-key"

# ═══════════════════════════════════════════
# BILLING (Polar.sh)
# ═══════════════════════════════════════════
POLAR_ACCESS_TOKEN=polar_oat_your_token_here
POLAR_SUCCESS_URL=http://localhost:3000/success?checkout_id={CHECKOUT_ID}

# ═══════════════════════════════════════════
# PUBLIC
# ═══════════════════════════════════════════
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ═══════════════════════════════════════════
# DEVELOPMENT
# ═══════════════════════════════════════════
NODE_ENV=development
```

---

## 3. Database Setup

### Option A: Create Neon Database (Recommended)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Paste it as `DATABASE_URL` in your `.env`

### Push Schema & Generate Client

```bash
# Push the Prisma schema to your database (creates all tables)
pnpm prisma db push

# Generate the Prisma client (TypeScript types)
pnpm prisma generate
```

> **Note:** The Prisma client is generated to `src/generated/prisma/` (configured in `schema.prisma`). This directory is git-ignored and must be regenerated after cloning.

### Verify Database

Open Prisma Studio to inspect your database:

```bash
pnpm prisma studio
```

This opens a browser-based GUI at `http://localhost:5555` where you can view and edit data.

### Working with Migrations

For development, you can use either approach:

```bash
# Quick schema sync (no migration history) — good for prototyping
pnpm prisma db push

# Create a migration (tracked in version control) — good for production
pnpm prisma migrate dev --name your_migration_name
```

---

## 4. Running the Dev Server

### Start the Next.js dev server:

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Start the Inngest dev server (for workflow execution):

In a **separate terminal**:

```bash
pnpm inngest:dev
```

This starts the local Inngest development server that processes workflow execution events. Open the Inngest dashboard at [http://localhost:8288](http://localhost:8288) to monitor function runs.

> **Alternative:** Use `mprocs` to run both servers simultaneously (configured in `package.json` dev dependencies).

### Testing Webhooks (Optional)

To test Google Forms or Stripe webhook triggers locally, you need to expose your local server:

```bash
# Start ngrok tunnel
npx ngrok http 3000
```

Copy the generated URL and use it as your webhook endpoint:
- Google Forms: `https://your-ngrok-url.ngrok-free.app/api/webhooks/google-form?workflowId=<id>`
- Stripe: `https://your-ngrok-url.ngrok-free.app/api/webhooks/stripe?workflowId=<id>`

---

## 5. Verifying the Setup

Run through this checklist to confirm everything is working:

- [ ] **App loads** — [http://localhost:3000](http://localhost:3000) redirects to `/workflows`
- [ ] **Registration works** — Sign up with email/password at `/signup`
- [ ] **Login works** — Log in at `/login`
- [ ] **Dashboard loads** — Sidebar shows Workflows, Credentials, Executions
- [ ] **Workflow creation** — Click "Create Workflow" (requires Pro subscription or bypass)
- [ ] **Editor loads** — Click a workflow to open the React Flow editor
- [ ] **Inngest running** — [http://localhost:8288](http://localhost:8288) shows the Inngest dashboard
- [ ] **Database accessible** — `pnpm prisma studio` opens the data browser

---

## Common Issues & Troubleshooting

### ❌ `PrismaClientInitializationError: Can't reach database server`

**Cause:** Invalid `DATABASE_URL` or Neon project not active.  
**Fix:**
1. Verify your `DATABASE_URL` in `.env`
2. Check that your Neon project is active (not suspended due to inactivity)
3. Ensure the connection string includes `?sslmode=require`

---

### ❌ `Error: Cannot find module '@/generated/prisma'`

**Cause:** Prisma client hasn't been generated yet.  
**Fix:**
```bash
pnpm prisma generate
```

> This must be run after every `git clone` or `prisma/schema.prisma` change.

---

### ❌ `BETTER_AUTH_SECRET is required`

**Cause:** Missing `BETTER_AUTH_SECRET` in `.env`.  
**Fix:** Generate one:
```bash
openssl rand -base64 32
```
Add the output to your `.env` as `BETTER_AUTH_SECRET`.

---

### ❌ `Module not found: Can't resolve 'better-auth/react'`

**Cause:** Dependencies not installed or corrupted.  
**Fix:**
```bash
rm -rf node_modules
pnpm install
pnpm approve-builds
```

---

### ❌ Inngest functions not executing

**Cause:** Inngest dev server not running or not connected.  
**Fix:**
1. Start the Inngest dev server: `pnpm inngest:dev`
2. Check the Inngest dashboard at [http://localhost:8288](http://localhost:8288)
3. Verify the Next.js server is registered by checking "Apps" in the Inngest dashboard

---

### ❌ OAuth login redirects to error page

**Cause:** OAuth callback URLs misconfigured.  
**Fix:**
1. GitHub: Set callback URL to `http://localhost:3000/api/auth/callback/github`
2. Google: Add `http://localhost:3000/api/auth/callback/google` to authorized redirect URIs
3. Verify `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are set in `.env`

---

### ❌ `Build error: Type 'X' is not assignable to type 'Y'`

**Cause:** TypeScript type mismatches, often after schema changes.  
**Fix:**
```bash
pnpm prisma generate    # Regenerate Prisma types
pnpm build              # Attempt build to surface errors
```

---

### ❌ Hot reload not working / stale `.next` cache

**Cause:** Corrupted build cache.  
**Fix:**
```bash
# Windows PowerShell
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
pnpm dev

# macOS/Linux  
rm -rf .next && pnpm dev
```

---

## IDE Setup

### Recommended VS Code Extensions

| Extension | Purpose |
|---|---|
| **Prisma** | Schema syntax highlighting, formatting, auto-complete |
| **Tailwind CSS IntelliSense** | Tailwind class auto-complete and hover previews |
| **ESLint** | Inline linting feedback |
| **Pretty TypeScript Errors** | Readable TypeScript error messages |
| **Error Lens** | Inline error/warning display |

### Recommended VS Code Settings

```jsonc
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server (Turbopack, port 3000) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm inngest:dev` | Start local Inngest dev server (port 8288) |
| `pnpm prisma db push` | Sync schema to database |
| `pnpm prisma migrate dev` | Create and apply migration |
| `pnpm prisma generate` | Generate Prisma client types |
| `pnpm prisma studio` | Open database browser GUI |

---

## Next Steps

Once your environment is running:

1. **Understand the architecture** → [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Explore the database schema** → [DATABASE.md](./DATABASE.md)
3. **Learn the API surface** → [API_REFERENCE.md](./API_REFERENCE.md)
4. **Understand the execution engine** → [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md)
5. **Start contributing** → [CONTRIBUTING.md](./CONTRIBUTING.md)
