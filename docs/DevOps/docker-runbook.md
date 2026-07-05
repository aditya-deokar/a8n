# Docker Runbook

This project now has a Docker-based local, development, and test environment. Docker is used for reproducible Postgres databases and optional containerized app execution. Vercel/GitHub Actions can still run the production deployment flow.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local Postgres, test Postgres, dev app, and test app profiles |
| `Dockerfile.dev` | Development/test app image |
| `Dockerfile` | Production-style app image |
| `docker/env/local.host.env` | Host-side local app env using Docker Postgres on `127.0.0.1:5432` |
| `docker/env/app.development.env` | Container-side dev app env using `db-local` service DNS |
| `docker/env/test.host.env` | Host-side test env using Docker Postgres on `127.0.0.1:5433` |
| `docker/env/app.test.env` | Container-side test app env using `db-test` service DNS |
| `scripts/neon-to-local.ts` | Safe Neon dump and local Docker restore helper |

## Prerequisites

- Docker Desktop running.
- Node and pnpm installed for host-side commands.
- Dependencies installed with `pnpm install --frozen-lockfile`.

## Local Database

Start local Postgres:

```powershell
pnpm db:local:up
pnpm db:local:wait
```

Generate Prisma client and apply committed migrations:

```powershell
pnpm db:local:generate
pnpm db:local:migrate
```

Validate local Docker env:

```powershell
pnpm env:check:local-docker
```

Run the app from the host against Docker Postgres:

```powershell
pnpm dev:local-docker
```

Open:

```text
http://localhost:3000
```

## Containerized Development App

Run the app inside Docker:

```powershell
pnpm docker:dev
```

This starts:

- `db-local`
- `app-dev`

The app uses `docker/env/app.development.env` and connects to Postgres through Docker DNS at `db-local:5432`.

## Test Database

Start test Postgres:

```powershell
pnpm db:test:up
pnpm db:test:wait
pnpm db:test:migrate
```

Run API tests against the Docker test database:

```powershell
pnpm test:api:docker-db
```

Run the API release gate against the Docker test database:

```powershell
pnpm api:release:gate:docker-db
```

Run the containerized test environment smoke:

```powershell
pnpm docker:test:env
```

## Local Build With Docker Env

When your normal `.env` is missing or incomplete, build with the committed local Docker env:

```powershell
pnpm build:local-docker
```

This is the local build command to use before testing staging/production workflows.

## Dump Neon Into Local Docker Postgres

Do not paste real database credentials into chat or commit them to files.

In PowerShell, set your Neon connection string only in the current shell:

```powershell
$env:NEON_DATABASE_URL="postgresql://user:password@ep-your-neon-host/neondb?sslmode=require"
```

Start local Postgres:

```powershell
pnpm db:local:up
```

Restore Neon into local Docker Postgres:

```powershell
pnpm db:neon:restore:local -- --yes
```

What this does:

1. Starts `db-local`.
2. Runs `pg_dump` from a temporary `postgres:16-alpine` container.
3. Writes a local dump under `tmp/db-dumps`.
4. Runs `pg_restore --clean --if-exists` into `db-local`.
5. Leaves your Neon database unchanged.

After restore, run:

```powershell
pnpm db:local:migrate
pnpm dev:local-docker
```

## Reset Local Docker Databases

To remove local Docker database volumes, run manually:

```powershell
docker compose down -v
```

This deletes local Docker Postgres data only. It does not touch Neon, staging, or production.

Use this reset if a local migration failed before the migration history was fixed. After reset:

```powershell
pnpm db:local:up
pnpm db:local:wait
pnpm db:local:migrate
```
