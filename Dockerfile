FROM node:24-alpine AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder

WORKDIR /app
COPY . .
RUN pnpm exec prisma generate

# Build-time placeholders satisfy import-time env validation without baking real
# production secrets into the image. Runtime env must override these values.
ENV A8N_ENV_PROFILE=production
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=build-placeholder-better-auth-secret-32
ENV BETTER_AUTH_URL=https://app.example.invalid
ENV NEXT_PUBLIC_APP_URL=https://app.example.invalid
ENV APP_URL=https://app.example.invalid
ENV NEXT_PUBLIC_WEBHOOK_BASE_URL=https://app.example.invalid
ENV ENCRYPTION_KEY=build-placeholder-encryption-secret-32
ENV POLAR_ACCESS_TOKEN=build-placeholder-polar-token
ENV POLAR_SUCCESS_URL=https://app.example.invalid/success
ENV MCP_API_KEY_HMAC_SECRET=build-placeholder-mcp-api-secret-32
ENV MCP_OAUTH_TOKEN_HMAC_SECRET=build-placeholder-mcp-oauth-secret-32
ENV MCP_OAUTH_ISSUER=https://app.example.invalid
ENV MCP_OAUTH_RESOURCE=https://app.example.invalid
ENV MCP_CORS_ORIGINS=https://app.example.invalid
ENV MCP_RATE_LIMIT_BACKEND=memory

RUN pnpm build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["pnpm", "start"]
