# Deployment Guide for Vercel

This project is built with Next.js, Prisma (Neon), Inngest, and Better Auth. Follow these steps to deploy it to Vercel.

## 1. Prerequisites

- A [Vercel](https://vercel.com) account.
- A [Neon](https://neon.tech) database.
- An [Inngest](https://inngest.com) account.
- OAuth credentials for GitHub/Google (optional, for social login).

## 2. Environment Variables

You need to set the following environment variables in your Vercel project settings:

### Database (Neon)
- `DATABASE_URL`: Your Neon PostgreSQL connection string.

### Authentication (Better Auth)
- `BETTER_AUTH_SECRET`: A random string (can be generated with `openssl rand -base64 32`).
- `BETTER_AUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`).
- `NEXT_PUBLIC_APP_URL`: Same as `BETTER_AUTH_URL`.
- `GITHUB_CLIENT_ID`: (Optional) Your GitHub OAuth client ID.
- `GITHUB_CLIENT_SECRET`: (Optional) Your GitHub OAuth client secret.
- `GOOGLE_CLIENT_ID`: (Optional) Your Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: (Optional) Your Google OAuth client secret.

### Inngest
- `INNGEST_EVENT_KEY`: Your Inngest event key (found in Inngest Cloud).
- `INNGEST_SIGNING_KEY`: Your Inngest signing key (found in Inngest Cloud).

### Encryption
- `ENCRYPTION_KEY`: A 32-character string for encrypting credentials.

### Payments (Polar)
- `POLAR_ACCESS_TOKEN`: Your Polar access token.
- `POLAR_SUCCESS_URL`: URL to redirect after successful payment.

### AI Providers (Optional)
- `OPENAI_API_KEY`: For OpenAI nodes.
- `ANTHROPIC_API_KEY`: For Anthropic nodes.
- `GOOGLE_GENERATIVE_AI_API_KEY`: For Gemini nodes.

## 3. Vercel Configuration

The project is already configured for Vercel.

### Build Command
Vercel will automatically detect Next.js and use:
- **Build Command**: `pnpm build`
- **Install Command**: `pnpm install`

The `package.json` includes a `postinstall` script that runs `prisma generate`, so you don't need to worry about the Prisma client.

### Database Migrations
To apply migrations to your production database, you should run the following command once:
```bash
pnpm prisma migrate deploy
```
You can do this from your local machine (with the production `DATABASE_URL` in `.env`) or via a Vercel build step (not recommended for every build).

## 4. Inngest Integration

Once deployed, you need to tell Inngest about your production app:

1. Go to your Inngest Cloud dashboard.
2. Add a new "Cloud" platform.
3. Use the URL: `https://your-app.vercel.app/api/inngest`.
4. Inngest will automatically sync your functions.

## 5. Troubleshooting

- **Prisma Client Issues**: If you see errors about Prisma client not being found, ensure `postinstall` is in `package.json` and `src/generated/prisma` is where it's generated.
- **Database Connections**: If you hit connection limits, ensure you are using the Neon Serverless driver (this project is already configured to use it in `src/lib/db.ts`).
- **Timeouts**: If your workflows are long, Inngest will automatically handle them by breaking them into steps, avoiding Vercel's serverless timeout.
