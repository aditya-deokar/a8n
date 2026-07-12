# a8n Production Deployment Audit & Zero-Config-Error Guide

## 🔴 Critical Issues Found in Your Current `.env`

These will cause **runtime errors or validation failures** in production:

### 1. `MCP_CORS_ORIGINS=*` — **WILL FAIL production validation**
Your [env.ts](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L327-L333) explicitly blocks wildcard CORS in production:
```typescript
if (env.MCP_CORS_ORIGINS === "*") {
  addIssue(issues, "MCP_CORS_ORIGINS", "MCP_CORS_ORIGINS must not be '*' in production.");
}
```
**Fix:** Set `MCP_CORS_ORIGINS=https://a8n.aditya-deokar.me`

---

### 2. `MCP_API_KEY_HMAC_SECRET` and `MCP_OAUTH_TOKEN_HMAC_SECRET` — **Missing**
Your [env.ts](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L289-L290) requires both to be ≥32 characters, and [lines 316-317](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L316-L317) requires them to be non-empty in production:
```typescript
requireSecretLength(env, issues, "MCP_API_KEY_HMAC_SECRET", 32);
requireSecretLength(env, issues, "MCP_OAUTH_TOKEN_HMAC_SECRET", 32);
// ...
requireProductionValue(env, issues, "MCP_API_KEY_HMAC_SECRET");
requireProductionValue(env, issues, "MCP_OAUTH_TOKEN_HMAC_SECRET");
```
**Fix:** Generate with `openssl rand -base64 32` and add to Vercel env vars.

---

### 3. `BETTER_AUTH_URL` — **Missing in your .env, required in production**
[Line 313](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L313) requires it and [line 319](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L319) requires HTTPS:
```typescript
requireProductionValue(env, issues, "BETTER_AUTH_URL");
requireHttpsUrl(env, issues, "BETTER_AUTH_URL");
```
**Fix:** Set `BETTER_AUTH_URL=https://a8n.aditya-deokar.me`

---

### 4. All URLs must be HTTPS — **Your .env has `http://localhost:3000`**
The production validator checks these URLs for `https://`:
| Variable | Required HTTPS? |
|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ Yes |
| `APP_URL` | ✅ Yes |
| `BETTER_AUTH_URL` | ✅ Yes |
| `NEXT_PUBLIC_WEBHOOK_BASE_URL` | ✅ Yes |
| `POLAR_SUCCESS_URL` | ✅ Yes |
| `MCP_OAUTH_ISSUER` | ✅ Yes |
| `MCP_OAUTH_RESOURCE` | ✅ Yes |

**Fix:** All must point to `https://a8n.aditya-deokar.me`

---

### 5. `POLAR_SUCCESS_URL` has `localhost` — **Will fail in production**
Your `.env` has:
```
POLAR_SUCCESS_URL=http://localhost:3000/success?checkout_id={CHECKOUT_ID}
```
**Fix:** `POLAR_SUCCESS_URL=https://a8n.aditya-deokar.me/success?checkout_id={CHECKOUT_ID}`

---

### 6. `INNGEST_DEV=1` and `INNGEST_BASE_URL` — **Must NOT be set in production**
Setting `INNGEST_DEV=1` forces the Inngest SDK into dev mode, which won't connect to Inngest Cloud. `INNGEST_BASE_URL=http://127.0.0.1:8288` points to a local dev server.

**Fix:** Remove both from your Vercel production environment variables entirely. Do **not** set them at all.

---

### 7. Duplicate blocks in `.env`
Your current [.env](file:///c:/Users/adity/Documents/final-year%20project/n8n/.env) has **duplicate configurations** — lines 1-45 and lines 46-100 contain overlapping/repeated variable definitions. This is confusing and the last definition wins, which could silently override values.

---

## 🟡 Recommended Configuration for Production

### Vercel Dashboard — Required Environment Variables

Set these in **Vercel → Project Settings → Environment Variables** (scope: **Production only**):

| Variable | Value | Type |
|---|---|---|
| `NODE_ENV` | `production` | Plain |
| `A8N_ENV_PROFILE` | `production` | Plain |
| `NEXT_PUBLIC_APP_URL` | `https://a8n.aditya-deokar.me` | Plain |
| `APP_URL` | `https://a8n.aditya-deokar.me` | Plain |
| `BETTER_AUTH_URL` | `https://a8n.aditya-deokar.me` | Plain |
| `NEXT_PUBLIC_WEBHOOK_BASE_URL` | `https://a8n.aditya-deokar.me` | Plain |
| `DATABASE_URL` | *(your Neon connection string)* | Sensitive |
| `BETTER_AUTH_SECRET` | *(≥32 char random string)* | Sensitive |
| `ENCRYPTION_KEY` | *(≥32 char random string)* | Sensitive |
| `MCP_API_KEY_HMAC_SECRET` | *(≥32 char random string)* | Sensitive |
| `MCP_OAUTH_TOKEN_HMAC_SECRET` | *(≥32 char random string)* | Sensitive |
| `GOOGLE_CLIENT_ID` | *(your Google OAuth ID)* | Sensitive |
| `GOOGLE_CLIENT_SECRET` | *(your Google OAuth secret)* | Sensitive |
| `POLAR_ACCESS_TOKEN` | *(your Polar token)* | Sensitive |
| `POLAR_SUCCESS_URL` | `https://a8n.aditya-deokar.me/success?checkout_id={CHECKOUT_ID}` | Plain |
| `MCP_CORS_ORIGINS` | `https://a8n.aditya-deokar.me` | Plain |
| `MCP_RATE_LIMIT_BACKEND` | `database` | Plain |
| `MCP_OAUTH_ISSUER` | `https://a8n.aditya-deokar.me` | Plain |
| `MCP_OAUTH_RESOURCE` | `https://a8n.aditya-deokar.me` | Plain |

### Inngest Setup for Production
1. Sign up for [Inngest Cloud](https://inngest.com)
2. Create an app and get your **Event Key** and **Signing Key**
3. Set in Vercel:
   - `INNGEST_EVENT_KEY=<your-event-key>`
   - `INNGEST_SIGNING_KEY=<your-signing-key>`
4. In Inngest Cloud, sync your app URL: `https://a8n.aditya-deokar.me/api/inngest`
5. **Do NOT set** `INNGEST_DEV` or `INNGEST_BASE_URL`

---

## 🟢 Additional Production Hardening Tips

### Security
- **Rotate secrets** — `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, and both HMAC secrets should be unique, random, and different from development values
- **CRON_SECRET** — Set this to prevent unauthorized cron endpoint access
- **Webhook secrets** — Set `A8N_WEBHOOK_SHARED_SECRET` and `GOOGLE_FORM_WEBHOOK_SECRET`

### Google OAuth
Make sure your Google Cloud Console OAuth consent screen has:
- **Authorized redirect URI:** `https://a8n.aditya-deokar.me/api/auth/callback/google`
- **Authorized JavaScript origin:** `https://a8n.aditya-deokar.me`

### Database
- Your Neon connection string with `sslmode=verify-full` is correct ✅
- Using the `-pooler` endpoint is correct for serverless ✅
- Consider enabling connection pooling in Neon dashboard if not already done

### Vercel-Specific
- **Custom domain:** Ensure `a8n.aditya-deokar.me` is added in Vercel → Domains and DNS is configured
- **Function region:** Match your Vercel function region to your Neon database region (`ap-southeast-1`) for lowest latency
- **Build command:** Your `postinstall` script runs `prisma generate` automatically ✅

---

## Quick Validation Command

Run this locally to validate your production env before deploying:
```bash
pnpm env:check:production
```
This executes the same [validateEnv()](file:///c:/Users/adity/Documents/final-year%20project/n8n/src/env.ts#L273-L341) with `--profile production` and will catch all the issues listed above.
