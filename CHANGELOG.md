# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Maintained by both humans and AI assistants. AI-made changes are recorded here
> as part of completing each task.

## [Unreleased]

### Added

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
- Default branch renamed from `master` to `main`.

### Removed

- Default "Hello World" `AppController`/`AppService` and their spec.
