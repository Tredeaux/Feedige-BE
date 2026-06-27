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

# 3. Start Postgres (and optionally the API) via Docker
docker compose up -d postgres

# 4. Generate the Prisma client and sync the schema
npm run prisma:generate
npm run db:push          # or: npm run prisma:migrate  (creates a migration)

# 5. Run the API in watch mode
npm run start:dev
```

The API listens on `http://localhost:3001` by default.

- Health check: `GET http://localhost:3001/api/health`
- API docs: `http://localhost:3001/api/docs`
- Endpoints are versioned: `http://localhost:3001/api/v1/...`

## Environment variables

| Variable       | Required | Default       | Description                             |
| -------------- | -------- | ------------- | --------------------------------------- |
| `NODE_ENV`     | no       | `development` | `development` \| `production` \| `test` |
| `PORT`         | no       | `3001`        | Port the HTTP server binds to           |
| `CORS_ORIGIN`  | no       | `*`           | Comma-separated allowed origins, or `*` |
| `LOG_LEVEL`    | no       | `info`        | pino log level                          |
| `DATABASE_URL` | **yes**  | —             | Postgres connection string              |

Validation lives in [`src/config/env.validation.ts`](src/config/env.validation.ts) — the app refuses to boot on invalid config.

## Scripts

| Script                   | Description                  |
| ------------------------ | ---------------------------- |
| `npm run start:dev`      | Run with hot reload          |
| `npm run build`          | Compile to `dist/`           |
| `npm run lint`           | ESLint (auto-fix)            |
| `npm run typecheck`      | Type-check without emitting  |
| `npm test`               | Unit tests (Jest)            |
| `npm run test:e2e`       | End-to-end tests             |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:studio`  | Open Prisma Studio           |

## Docker

```bash
# Run Postgres + the API together
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
```
