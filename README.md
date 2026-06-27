# Feedige — Backend

The API for **Feedige**, an AI-powered feedback triage app. It ingests product
feedback, persists it to Postgres, and (planned) runs AI analysis to surface
sentiment, themes, priority, and recommended actions. Consumed by the
[frontend](https://github.com/Tredeaux/Feedige-FE).

---

## Tech stack

| Concern    | Choice                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| Framework  | [NestJS 11](https://nestjs.com/) (Express)                                  |
| Language   | TypeScript                                                                  |
| Database   | PostgreSQL via [Prisma 6](https://www.prisma.io/) (Migrate)                 |
| Validation | `class-validator` + global `ValidationPipe`; env via Joi                    |
| API docs   | OpenAPI / Swagger (`@nestjs/swagger`)                                       |
| Logging    | Structured JSON via [nestjs-pino](https://github.com/iamolegga/nestjs-pino) |
| Security   | Helmet, configurable CORS                                                   |
| Health     | `@nestjs/terminus` (liveness + DB ping)                                     |
| Quality    | ESLint + Prettier · Husky + lint-staged · CI (GitHub Actions)               |

---

## Architecture

A standard NestJS modular layout. Cross-cutting concerns (config, logging,
database) are global; features are self-contained modules. The bootstrap wires
the request pipeline once in `main.ts`.

```
main.ts                      Bootstrap pipeline:
  ├─ helmet()                  security headers
  ├─ CORS                      configurable allow-list
  ├─ /api prefix + URI v1      versioned routing
  ├─ ValidationPipe            whitelist + transform DTOs
  ├─ pino logger               structured request logs
  ├─ Swagger  → /api/docs      OpenAPI UI
  └─ shutdown hooks            clean Prisma disconnect

AppModule
  ├─ ConfigModule (global)     Joi-validated env, fail-fast
  ├─ LoggerModule (pino)       global structured logging
  ├─ PrismaModule (global)     PrismaService — DB access
  └─ HealthModule              GET /api/health (+ Prisma indicator)
```

**Key modules**

| Path                           | Responsibility                                        |
| ------------------------------ | ----------------------------------------------------- |
| `src/config/env.validation.ts` | Joi schema; the app refuses to boot on invalid config |
| `src/prisma/`                  | Global `PrismaService` (connect/disconnect lifecycle) |
| `src/health/`                  | Terminus health check + custom Prisma DB indicator    |
| `src/main.ts`                  | Bootstrap: security, versioning, Swagger, logging     |

---

## API endpoints

All routes are under the `/api` prefix; feature routes are URI-versioned (`/api/v1/...`).

| Method | Path                    | Description                             | Status       |
| ------ | ----------------------- | --------------------------------------- | ------------ |
| `GET`  | `/api/health`           | Liveness check incl. database ping      | ✅ Available |
| `GET`  | `/api/docs`             | Swagger / OpenAPI UI                    | ✅ Available |
| `POST` | `/api/v1/auth/register` | Create an account, returns a JWT        | ✅ Available |
| `POST` | `/api/v1/auth/login`    | Sign in, returns a JWT                  | ✅ Available |
| `GET`  | `/api/v1/auth/me`       | Current user (requires Bearer token)    | ✅ Available |
| `POST` | `/api/v1/feedback`      | Submit feedback (upsert user + persist) | ✅ Available |
| `GET`  | `/api/v1/feedback`      | List feedback with analysis             | 🚧 Planned   |

Authentication is self-hosted: passwords are hashed with **bcrypt**, and protected
routes require a **JWT** bearer token (`Authorization: Bearer <token>`). See
[`docs/decisions.md`](docs/decisions.md#self-hosted-jwt-authentication).

**Health response**

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "details": { "database": { "status": "up" } }
}
```

Interactive docs: **http://localhost:3001/api/docs**

---

## Data model

Managed in [`prisma/schema.prisma`](prisma/schema.prisma). Four tables model the
triage workflow:

```
users ──1:N──► feedback ──1:N──► feedback_analysis      (versioned AI analyses)
  │                │
  │                └──1:N──► audit_log                   (append-only history)
  └──────────────── submitted_by / analyzed_by / user_id (nullable refs)
```

| Table               | Purpose                                         | Key columns                                                                                                                                                   |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | Submitters & triagers                           | `email` (unique), `role` (default `triage`)                                                                                                                   |
| `feedback`          | Raw feedback awaiting/undergoing triage         | `raw_text`, `source` (default `web`), `status` (default `pending`: `pending`/`reviewed`/`actioned`/`archived`), `submitted_by` → users                        |
| `feedback_analysis` | AI analysis, **multiple versions per feedback** | `version`, `sentiment`, `priority`, `confidence` (DECIMAL 3,2), `key_themes[]`, `recommended_actions[]`, `model_used`; `feedback_id` → feedback **(cascade)** |
| `audit_log`         | Append-only action trail                        | `action`, `old_value`/`new_value` (JSONB), `feedback_id` → feedback **(cascade)**, `user_id` → users                                                          |

Design notes (see [`docs/decisions.md`](docs/decisions.md) for full rationale):

- **UUID** primary keys via Postgres `gen_random_uuid()` (database-authoritative).
- **snake_case** columns in Postgres, **camelCase** in the Prisma client (`@map`/`@@map`).
- **Foreign keys are explicitly indexed** (Postgres doesn't auto-index them); plus
  indexes on `feedback.status`/`created_at` and a unique `(feedback_id, version)`.
- **`onDelete`:** deleting feedback cascades to its analyses and audit logs;
  deleting a user nulls their references (feedback/analyses/logs are preserved).
- **Status/sentiment/priority/role are `VARCHAR`** (not enums) for flexibility —
  adding a value needs no migration.

---

## Getting started

**Prerequisites:** Node.js `>=22` (see [`.nvmrc`](.nvmrc)) and Docker (for local Postgres).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres
docker compose up -d postgres

# 4. Apply migrations and (optionally) seed sample data
npm run migrate:deploy
npm run db:seed

# 5. Run the API in watch mode
npm run start:dev
```

The API listens on **http://localhost:3001** by default.

> **Port already in use?** Override at launch, e.g. `PORT=3011 npm run start:dev`,
> and set `POSTGRES_PORT` if `5432` is taken.

---

## Environment variables

| Variable        | Required | Default       | Description                                    |
| --------------- | -------- | ------------- | ---------------------------------------------- |
| `NODE_ENV`      | no       | `development` | `development` \| `production` \| `test`        |
| `PORT`          | no       | `3001`        | Port the HTTP server binds to                  |
| `CORS_ORIGIN`   | no       | `*`           | Comma-separated allowed origins, or `*`        |
| `LOG_LEVEL`     | no       | `info`        | pino log level                                 |
| `DATABASE_URL`  | **yes**  | —             | Postgres connection string                     |
| `POSTGRES_PORT` | no       | `5432`        | Host port docker-compose publishes Postgres on |

Validated in [`src/config/env.validation.ts`](src/config/env.validation.ts) — invalid config fails fast at boot.

---

## Database & migrations

Schema changes are managed with **Prisma Migrate** — every change is a committed,
timestamped migration in [`prisma/migrations/`](prisma/migrations), so
environment setup is reproducible and upgrades are deterministic.

```bash
# Edit prisma/schema.prisma, then create a migration (dev):
npm run migrate -- --name <describe_change>

# Apply pending migrations (CI / production / fresh env):
npm run migrate:deploy

# Inspect / reset (reset drops data, re-applies, re-seeds):
npm run migrate:status
npm run migrate:reset
```

- **Fresh environment:** `migrate deploy` applies every committed migration from
  scratch — no manual SQL. In Docker this runs automatically on container start
  (see [`docker-entrypoint.sh`](docker-entrypoint.sh)).
- **Upgrades are roll-forward:** each change is a new migration. Downgrades are
  intentionally not supported (Prisma is forward-only by design); to revert,
  write a new forward migration.

---

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

---

## Docker

```bash
# Run Postgres + the API together (API auto-migrates on start)
docker compose up --build
```

---

## Project structure

```
src/
  config/          env validation (Joi)
  health/          GET /api/health (Terminus + Prisma ping)
  prisma/          PrismaService + global PrismaModule
  app.module.ts    root module wiring
  main.ts          bootstrap: helmet, cors, versioning, swagger, pino
prisma/
  schema.prisma    data model
  migrations/      committed migration history
  seed.ts          idempotent sample-data seed
```

---

## Packages reference

Short notes on every package we explicitly depend on, for future reference.

### Framework & runtime

| Package                    | What it does                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `@nestjs/common`           | Core NestJS building blocks — decorators, pipes, guards, DI primitives. |
| `@nestjs/core`             | The framework runtime (module system, request lifecycle).               |
| `@nestjs/platform-express` | Express HTTP adapter under NestJS.                                      |
| `@nestjs/config`           | Loads and exposes configuration/env, with validation hooks.             |
| `reflect-metadata`         | Enables the decorator metadata NestJS DI relies on.                     |
| `rxjs`                     | Reactive streams — NestJS's foundation for interceptors/observables.    |

### Database

| Package          | What it does                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `prisma`         | CLI + migration engine. Kept as a runtime dep so the container can self-migrate. |
| `@prisma/client` | The generated, fully-typed database client used in services.                     |

### Validation & config

| Package             | What it does                                                                           |
| ------------------- | -------------------------------------------------------------------------------------- |
| `joi`               | Schema validation for **environment variables** — the app won't boot on bad config.    |
| `class-validator`   | Decorator-based validation of incoming request DTOs (via the global `ValidationPipe`). |
| `class-transformer` | Converts plain request payloads into typed class instances (DTO transform).            |

### API, security & ops

| Package            | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `@nestjs/swagger`  | Generates the OpenAPI spec + Swagger UI at `/api/docs`.                |
| `helmet`           | Sets security-related HTTP response headers.                           |
| `@nestjs/terminus` | Health-check framework powering `GET /api/health` (incl. the DB ping). |

### Logging

| Package       | What it does                                                              |
| ------------- | ------------------------------------------------------------------------- |
| `nestjs-pino` | Wires the pino logger into NestJS as the app logger + request logging.    |
| `pino-http`   | The HTTP request/response logging layer pino-nestjs builds on.            |
| `pino-pretty` | Human-readable pretty log output in development (raw JSON in production). |

### Tooling

| Package                                             | What it does                                          |
| --------------------------------------------------- | ----------------------------------------------------- |
| `typescript`                                        | The language + type checker.                          |
| `@nestjs/cli` / `@nestjs/schematics`                | Build, run, and scaffold NestJS code.                 |
| `@nestjs/testing`                                   | Utilities to bootstrap modules in tests.              |
| `jest` / `ts-jest`                                  | Unit-test runner + TypeScript transform.              |
| `supertest`                                         | HTTP assertions for e2e tests.                        |
| `ts-node` / `ts-loader` / `tsconfig-paths`          | Run TS directly / webpack TS / path-alias resolution. |
| `source-map-support`                                | Maps runtime stack traces back to TypeScript source.  |
| `eslint` / `typescript-eslint`                      | Linting (with TS awareness).                          |
| `eslint-config-prettier` / `eslint-plugin-prettier` | Make ESLint and Prettier cooperate.                   |
| `prettier`                                          | Code formatter.                                       |
| `husky` / `lint-staged`                             | Git hooks; lint/format only staged files pre-commit.  |
