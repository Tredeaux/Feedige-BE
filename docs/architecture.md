# Architecture

## Stack

- **Framework:** NestJS 11 (Express platform)
- **Language:** TypeScript (decorators + DI)
- **Database:** PostgreSQL via Prisma 6 (Prisma Migrate)
- **Validation:** `class-validator`/`class-transformer` + global `ValidationPipe`; env via Joi
- **Docs:** OpenAPI/Swagger (`@nestjs/swagger`) at `/api/docs`
- **Logging:** structured JSON via `nestjs-pino`
- **Security:** Helmet, configurable CORS
- **Health:** `@nestjs/terminus` at `/api/health` (incl. DB ping)

## Module layout

```
src/
  main.ts                  # Bootstrap: builds the request pipeline (see below)
  app.module.ts            # Root module: wires global + feature modules
  config/
    env.validation.ts      # Joi schema; app refuses to boot on invalid env
  prisma/
    prisma.service.ts      # PrismaClient lifecycle (connect/disconnect)
    prisma.module.ts       # @Global() — exports PrismaService app-wide
  health/
    health.controller.ts   # GET /api/health (version-neutral)
    health.module.ts
    prisma.health.ts       # custom Terminus indicator: DB ping
prisma/
  schema.prisma            # data model (source of truth for the DB)
  migrations/              # committed, timestamped migrations
  seed.ts                  # idempotent sample-data seed
test/                      # Jest e2e specs
docs/                      # you are here
docker-entrypoint.sh       # runs `prisma migrate deploy` then starts the app
```

## Bootstrap pipeline (`main.ts`)

The request pipeline is configured once, in order:

```
NestFactory.create(AppModule, { bufferLogs: true })
  ├─ useLogger(pino)            # structured logging as the app logger
  ├─ helmet()                   # security headers
  ├─ enableCors(...)            # reflect "*" or explicit allow-list
  ├─ setGlobalPrefix("api")     # everything under /api
  ├─ enableVersioning(URI, v1)  # feature routes are /api/v1/...
  ├─ useGlobalPipes(            # validate + transform every payload
  │    ValidationPipe { whitelist, forbidNonWhitelisted, transform })
  ├─ enableShutdownHooks()      # clean Prisma disconnect on SIGTERM/SIGINT
  └─ SwaggerModule.setup("api/docs", ...)   # OpenAPI UI
```

## Root module wiring (`app.module.ts`)

```
AppModule
  ├─ ConfigModule.forRoot({ isGlobal, validationSchema })  # Joi-validated env
  ├─ LoggerModule.forRoot(pinoHttp{...})                   # global pino logging
  ├─ PrismaModule (@Global)                                # DB access everywhere
  └─ HealthModule                                          # /api/health
```

Cross-cutting concerns (config, logging, database) are **global**. Features are
**self-contained modules** added to `AppModule`'s `imports`.

## Request lifecycle (feature endpoint)

```
HTTP → Controller (@Controller, versioned route, Swagger decorators)
        │  receives a validated DTO (ValidationPipe ran class-validator)
        ▼
      Service (business logic; @Injectable)
        │  uses
        ▼
      PrismaService (injected) → PostgreSQL
        ▲
        └─ errors surface as Nest HttpExceptions → standard error response
```

- **Controllers are thin**: routing, DTO in, DTO/entity out. No business logic.
- **Services own logic** and are the only place that touches `PrismaService`.
- **DTOs define and validate** the request shape (class-validator) and document it
  (Swagger).

## Configuration & environment

- Env is validated by Joi at startup (`config/env.validation.ts`). Missing/invalid
  values **fail the boot** — no silent misconfiguration.
- Code reads config through the typed `ConfigService`, never `process.env`.

## Database & migrations

- `prisma/schema.prisma` is the source of truth; the generated client is accessed
  only via `PrismaService`.
- Schema changes are **committed migrations** under `prisma/migrations/`. Applied
  with `migrate deploy` (CI, production, and automatically on container start via
  `docker-entrypoint.sh`). **Forward-only** — see decisions.md.

## Data model

Four tables model the triage workflow (full schema:
[`prisma/schema.prisma`](../prisma/schema.prisma); overview table in the README):

```
users ──1:N──► feedback ──1:N──► feedback_analysis   (versioned AI analyses; unique (feedback_id, version))
  │               │
  │               └──1:N──► audit_log                 (append-only action history)
  └─── submitted_by / analyzed_by / user_id           (nullable user references)
```

Engineering conventions applied here (rationale in [decisions.md](decisions.md)):

- **UUID PKs** via Postgres `gen_random_uuid()` — the DB generates ids.
- **Naming:** snake_case columns/tables (`@map`/`@@map`); camelCase Prisma client.
- **Indexing:** FK columns are explicitly indexed (Postgres does not auto-index
  them). Also `feedback.status` and `feedback.created_at` for triage listing, and a
  **unique `(feedback_id, version)`** on `feedback_analysis` to guard re-analysis
  versions (its leftmost column also serves `feedback_id` lookups).
- **Referential actions:** deleting a `feedback` **cascades** to its analyses and
  audit logs; deleting a `user` **sets null** on their references so history/feedback
  survives.
- **Flexible status fields:** `status`/`sentiment`/`priority`/`role` are `VARCHAR`,
  not Postgres enums — new values need no migration. Lifecycle is recoverable
  through data + the `audit_log`, not schema rollback.
- **Append-only audit:** `audit_log` records `action` with `old_value`/`new_value`
  as JSONB for flexible before/after snapshots.

## The boundary with the frontend

FE (`Feedige-FE`) and BE are **separate repositories** with no shared types
package. The DTOs here are the API contract and must be kept in step with the
frontend's `src/lib/` schemas. The Swagger spec at `/api/docs` is the
machine-readable contract. See
[decisions.md](decisions.md#separate-frontend-and-backend-repositories).
