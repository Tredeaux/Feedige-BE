# Feedige BE — Engineering Docs

**Read this folder before making changes.** It is the source of truth for _how_
the Feedige backend is built and _why_. The goal is that any contributor — human
or AI — can extend the API so that every addition is consistent with what already
exists.

## How to use these docs

1. **Before writing code**, skim [`conventions.md`](conventions.md) and
   [`architecture.md`](architecture.md).
2. **When adding an endpoint/feature**, follow [`adding-a-feature.md`](adding-a-feature.md).
3. **When making a non-obvious technical choice**, record it in
   [`decisions.md`](decisions.md) (an ADR-style log).
4. **When you change how things work**, update the relevant doc here _and_ the
   root `CHANGELOG.md` as part of the same change. Docs are part of "done".

## Contents

| Doc                                                  | What's in it                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)                   | Module layout, bootstrap pipeline, request lifecycle, data access                         |
| [conventions.md](conventions.md)                     | The rules: modules, DTOs/validation, config, Prisma, errors, logging, versioning, testing |
| [decisions.md](decisions.md)                         | Why we chose what we chose (and the alternatives we rejected)                             |
| [adding-a-feature.md](adding-a-feature.md)           | Step-by-step playbook + checklist for consistent additions                                |
| [engineering-standards.md](engineering-standards.md) | Senior expectations & review checklist — the bar we hold work to                          |

## The short version

- **NestJS 11 + TypeScript**, modular architecture. Thin controllers, logic in services.
- **Validation everywhere.** DTOs with `class-validator` + a global `ValidationPipe`;
  env validated with Joi (fail-fast at boot).
- **Never read `process.env` directly.** Use the typed `ConfigService`.
- **All DB access goes through `PrismaService`** (injected; global `PrismaModule`).
- **Routes live under `/api` and are URI-versioned** (`/api/v1/...`). Document them
  with Swagger decorators.
- **Migrations are committed and forward-only** (Prisma Migrate). Never `db push`.
- **Structured logging** via nestjs-pino; **health** via Terminus at `/api/health`.
- **This is a separate repo from the frontend** — API DTOs are hand-synced. See
  [decisions.md](decisions.md#separate-frontend-and-backend-repositories).
