# Read the engineering docs before changing anything

The [`docs/`](docs/) folder is the source of truth for how this backend is built
and why. **Read it before writing code, and keep it updated as part of "done".**

- [`docs/README.md`](docs/README.md) — start here
- [`docs/architecture.md`](docs/architecture.md) — module layout, bootstrap pipeline, request lifecycle, data access
- [`docs/conventions.md`](docs/conventions.md) — the rules (modules, DTOs/validation, config, Prisma, errors, logging, versioning, testing)
- [`docs/decisions.md`](docs/decisions.md) — why we chose what we chose
- [`docs/adding-a-feature.md`](docs/adding-a-feature.md) — step-by-step playbook for consistent additions
- [`docs/engineering-standards.md`](docs/engineering-standards.md) — senior expectations & review checklist; self-check changes against it before "done"

Every addition must follow these so the codebase stays consistent.

## Quick reminders

- NestJS modular architecture: thin controllers, logic in services, DI everywhere.
- DTOs + `class-validator` (global `ValidationPipe`); never read `process.env` (use `ConfigService`).
- All DB access via the injected `PrismaService`; schema changes are committed, forward-only migrations (never `db push`).
- Routes under `/api`, URI-versioned (`/api/v1/...`); document with Swagger decorators.
- Update the root `CHANGELOG.md` for every behavior change.
