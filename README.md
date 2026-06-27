# Feedige — Backend

NestJS + TypeScript API for Feedige.

## Stack

- **Framework:** [NestJS 11](https://nestjs.com/) (Express)
- **Language:** TypeScript
- **Database:** PostgreSQL via [Prisma](https://www.prisma.io/)
- **Validation:** `class-validator` + global `ValidationPipe`, env validated with Joi
- **Docs:** OpenAPI/Swagger at `/api/docs`
- **Logging:** structured JSON via [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- **Security:** Helmet, configurable CORS
- **Health:** Terminus health check at `/api/health` (includes DB ping)

## Requirements

- Node.js `>=22` (see [`.nvmrc`](.nvmrc))
- Docker (for local Postgres)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres via Docker
docker compose up -d postgres

# 4. Apply migrations and seed sample data
npm run migrate:deploy   # apply committed migrations
npm run db:seed          # optional: insert sample feedback

# 5. Run the API in watch mode
npm run start:dev
```

The API listens on `http://localhost:3001` by default.

- Health check: `GET http://localhost:3001/api/health`
- API docs: `http://localhost:3001/api/docs`
- Endpoints are versioned: `http://localhost:3001/api/v1/...`

## Environment variables

| Variable        | Required | Default       | Description                                    |
| --------------- | -------- | ------------- | ---------------------------------------------- |
| `NODE_ENV`      | no       | `development` | `development` \| `production` \| `test`        |
| `PORT`          | no       | `3001`        | Port the HTTP server binds to                  |
| `CORS_ORIGIN`   | no       | `*`           | Comma-separated allowed origins, or `*`        |
| `LOG_LEVEL`     | no       | `info`        | pino log level                                 |
| `DATABASE_URL`  | **yes**  | —             | Postgres connection string                     |
| `POSTGRES_PORT` | no       | `5432`        | Host port docker-compose publishes Postgres on |
| `API_PORT`      | no       | `3001`        | Host port docker-compose publishes the API on  |

Validation lives in [`src/config/env.validation.ts`](src/config/env.validation.ts) — the app refuses to boot on invalid config.

## Database & migrations

Schema changes are managed with **Prisma Migrate** — every change is a committed,
timestamped migration in [`prisma/migrations/`](prisma/migrations). This keeps environment
setup reproducible and upgrades deterministic.

```bash
# Make a schema change in prisma/schema.prisma, then create a migration:
npm run migrate -- --name <describe_change>   # creates + applies in dev

# Apply pending migrations (CI / production / fresh environments):
npm run migrate:deploy

# Inspect state / reset a local DB (drops data, re-applies, re-seeds):
npm run migrate:status
npm run migrate:reset
```

**Fresh environment** (clean setup): `migrate deploy` applies all committed migrations from
scratch — no manual SQL. In Docker this runs automatically on container start (see
[`docker-entrypoint.sh`](docker-entrypoint.sh)), so a new environment comes up fully provisioned.

**Upgrades** are roll-forward: each change is a new migration applied with `migrate deploy`.
Downgrades are intentionally **not** supported (Prisma is forward-only by design); to revert,
write a new forward migration. The `Feedback.status` enum models lifecycle state for the same
reason — recoverable via data, not schema rollback.

## Scripts

| Script                   | Description                    |
| ------------------------ | ------------------------------ |
| `npm run start:dev`      | Run with hot reload            |
| `npm run build`          | Compile to `dist/`             |
| `npm run lint`           | ESLint (auto-fix)              |
| `npm run typecheck`      | Type-check without emitting    |
| `npm test`               | Unit tests (Jest)              |
| `npm run test:e2e`       | End-to-end tests               |
| `npm run migrate`        | Create/apply a dev migration   |
| `npm run migrate:deploy` | Apply committed migrations     |
| `npm run migrate:reset`  | Reset DB (drop, migrate, seed) |
| `npm run db:seed`        | Seed sample data               |
| `npm run prisma:studio`  | Open Prisma Studio             |

## Docker

```bash
# Run Postgres + the API together. The API container applies migrations on start.
docker compose up --build
```

## Project structure

```
src/
  config/          # env validation
  health/          # /api/health (Terminus + Prisma ping)
  prisma/          # PrismaService + global PrismaModule
  app.module.ts    # root module wiring
  main.ts          # bootstrap: helmet, cors, versioning, swagger, pino
prisma/
  schema.prisma    # data model
  migrations/      # committed, timestamped migrations
  seed.ts          # idempotent sample-data seed
docker-entrypoint.sh  # runs `migrate deploy` then starts the app
```
