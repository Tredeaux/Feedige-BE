# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Maintained by both humans and AI assistants. AI-made changes are recorded here
> as part of completing each task.

## [Unreleased]

### Changed

- Self-registration grants the `triage` role (open/collaborative triage) — registered users can
  access the panel. Feedback-only users (created implicitly by a submission) remain `member`.
  `admin` is still granted out-of-band.

### Security

- Authorization: `users.role` default is `member` (migration) for feedback-only users. Added
  `RolesGuard` + `@Roles()` for protecting admin/triage endpoints, and a seeded admin
  (`admin@feedige.dev` / `admin12345`, dev only). The frontend gates the panel on role.
- Rate limiting via `@nestjs/throttler`: 100/min global baseline, 5/min on `/auth/register` and
  `/auth/login`.
- CORS no longer sends `credentials` (auth is Bearer-based), so a `*` origin can't enable
  credentialed cross-origin requests.
- Login runs a constant-time bcrypt comparison (dummy hash when the user is absent) to prevent
  timing-based account enumeration.
- Anonymous feedback submissions no longer overwrite an existing user's name.

### Added

- Global `AllExceptionsFilter` — consistent error shape, Prisma errors mapped (P2002→409,
  P2025→404), and no internal leakage on 5xx.
- Self-hosted authentication (`auth` module): `POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
  and a guarded `GET /api/v1/auth/me`. Passwords hashed with bcrypt; JWTs issued via `@nestjs/jwt`
  and verified with `passport-jwt` (`JwtAuthGuard`). Added a nullable `password_hash` column to
  `users` (migration) and `JWT_SECRET`/`JWT_EXPIRES_IN` env vars. Unit + e2e tests cover
  register/login/me, duplicate (409), bad credentials (401), and unauthenticated access (401).
- `POST /api/v1/feedback` endpoint (`feedback` module: controller + service + DTOs). Validated
  with `class-validator` + Swagger; persists atomically in a transaction — upserts the submitting
  user by email, creates the feedback, and writes a `feedback_created` audit-log entry. Unit +
  e2e tests cover the happy path, validation rejection, and whitelist enforcement.
- `applyGlobalConfig()` (`src/app.config.ts`) — shared `/api` prefix, URI versioning, and the
  global `ValidationPipe`, used by both `main.ts` and the e2e tests so tests exercise the real
  request pipeline.
- Domain schema: `users`, `feedback`, `feedback_analysis` (versioned), and `audit_log` tables
  in `prisma/schema.prisma`, documented in the README and `docs/`. UUID PKs via
  `gen_random_uuid()`, snake_case↔camelCase mapping, explicit FK indexes, a unique
  `(feedback_id, version)`, and `onDelete` cascade/set-null rules.
- `docs/engineering-standards.md` — senior engineering expectations & review checklist (the bar
  we hold work to). Linked from `AGENTS.md` and the docs index so AI tools self-check against it.
- `docs/` engineering folder — architecture, conventions, decision log (ADRs), and a
  "adding a feature" playbook — as the source of truth for BE design decisions and rules.
  Added `AGENTS.md`/`CLAUDE.md` pointing to it so AI tools discover it.
- Comprehensive `README` — tech stack, architecture, API endpoints, data model, migrations,
  and a "Packages reference" section summarising every explicit dependency.
- Prisma migration workflow: clean committed `init` migration (`prisma/migrations/`), replacing
  `db push`. Schema changes are now tracked, timestamped, and reproducible.
- Idempotent database seed (`prisma/seed.ts`, `npm run db:seed`) for fresh-environment setup.
- Migration scripts: `migrate`, `migrate:deploy`, `migrate:reset`, `migrate:status`.
- `docker-entrypoint.sh`: the API container runs `prisma migrate deploy` on start, so new
  environments come up fully provisioned.
- `POSTGRES_PORT` and `API_PORT` env vars to configure the host ports docker-compose publishes
  Postgres and the API on (avoids clashes with other local services).
- Initial NestJS + TypeScript scaffold (module/controller/service structure, Jest unit + e2e setup).
- `@nestjs/config` with Joi environment validation — the app fails fast on missing/invalid config.
- Global `ValidationPipe` (whitelist + transform) for request payload validation.
- Helmet security headers and configurable CORS (`CORS_ORIGIN`).
- `/api` global prefix and URI-based API versioning (default `v1`).
- Swagger/OpenAPI documentation served at `/api/docs`.
- Structured JSON logging via `nestjs-pino`, with redaction of `authorization`/`cookie` headers.
- Graceful shutdown hooks.
- Prisma ORM (PostgreSQL): global `PrismaModule`/`PrismaService` and an example `Feedback` model.
- Terminus health check at `/api/health`, including a database connectivity ping.
- Multi-stage `Dockerfile` and `docker-compose.yml` (PostgreSQL + API).
- GitHub Actions CI (lint, typecheck, build, unit tests, e2e against a Postgres service).
- Dependabot configuration and a pull request template.
- Husky + lint-staged pre-commit hooks.
- Project hygiene: `format:check` script, `.nvmrc`, `.editorconfig`, `engines` pin (Node `>=22`).
- `.gitignore` (the initial scaffold lacked one; `node_modules` was untracked).
- This `CHANGELOG.md`.

### Changed

- Pinned Prisma to **v6**. npm installed v7 by default, which drops `url` from the schema and
  requires driver adapters + a `prisma.config.ts`; v6 was chosen for a stable, well-documented
  NestJS + Prisma setup.
- Rewrote `src/main.ts` to wire Helmet, CORS, versioning, Swagger, and pino during bootstrap.
- CI now applies schema via `prisma migrate deploy` instead of `prisma db push`.
- Moved `prisma` CLI to runtime dependencies so the production image can self-migrate.
- Docker host Postgres port now defaults to 5432 but is configurable via `POSTGRES_PORT`.
- Default branch renamed from `master` to `main`.

### Fixed

- `nest build` emitted to `dist/src/main.js` instead of `dist/main.js` after `prisma/seed.ts`
  was added (it widened TypeScript's inferred `rootDir`), which crashed the Docker container with
  "Cannot find module '/app/dist/main'". Fixed by excluding `prisma` from `tsconfig.build.json`.

### Removed

- Default "Hello World" `AppController`/`AppService` and their spec.
