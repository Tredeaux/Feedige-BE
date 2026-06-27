# Conventions & Rules

These are the rules every addition must follow so the codebase reads as if one
person wrote it. When a rule genuinely shouldn't apply, say why in the PR and in
[decisions.md](decisions.md).

## Modules & structure

- **One module per feature**, in its own folder: `src/<feature>/` with
  `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, and a
  `dto/` folder. Register the module in `AppModule`'s `imports`.
- **Controllers are thin** — routing, validation (via DTOs), and shaping the
  response. No business logic, no direct Prisma calls.
- **Services hold the logic** and are `@Injectable()`. They are the only layer that
  injects and uses `PrismaService`.
- **Use dependency injection** (constructor injection); don't instantiate services
  or `PrismaClient` manually.

## DTOs & validation

- **Every request body/query is a DTO class** with `class-validator` decorators
  (`@IsString()`, `@IsEmail()`, `@MinLength()`, etc.).
- The **global `ValidationPipe`** (configured in `main.ts`) runs automatically with
  `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — so unknown
  properties are rejected and payloads are transformed to DTO instances. Don't
  re-validate manually.
- **Annotate DTOs and responses with Swagger** decorators (`@ApiProperty()`,
  `@ApiTags()`, `@ApiOperation()`) so `/api/docs` stays accurate.

## Configuration & env

- **Never read `process.env` directly.** Inject `ConfigService` and read typed
  values.
- Add new env vars to **both** `src/config/env.validation.ts` (Joi schema, with a
  sensible default or `.required()`) **and** `.env.example`. The app must fail fast
  if a required var is missing.

## Database (Prisma)

- **All DB access is via the injected `PrismaService`.** Never `new PrismaClient()`.
- **Schema changes go through migrations**, never `db push`:
  `npm run migrate -- --name <change>` in dev, committed under `prisma/migrations/`.
- **Migrations are forward-only.** To revert, write a new forward migration (Prisma
  is forward-only by design — see decisions.md). Keep the `seed.ts` idempotent.
- **Schema conventions:** UUID PKs via `gen_random_uuid()`; snake_case DB names via
  `@map`/`@@map` (camelCase client); **explicitly index every foreign key** (Postgres
  doesn't auto-index them). State fields (`status`/`sentiment`/`priority`/`role`) are
  `VARCHAR` for flexibility — recoverability comes from data + the `audit_log`, not
  schema rollback. Set `onDelete` deliberately (cascade children, set-null nullable
  user refs). See decisions.md.

## Routing & versioning

- **All routes live under the `/api` prefix** (global) and feature routes are
  **URI-versioned** (`/api/v1/...`). New feature controllers get a version.
- **Operational endpoints** (e.g. health) are version-neutral
  (`@Controller({ path: "health", version: VERSION_NEUTRAL })`).

## Errors

- **Throw Nest `HttpException`s** (or built-ins like `NotFoundException`,
  `BadRequestException`) — let Nest produce consistent error responses. Don't
  hand-roll status codes in controllers.
- Let `ValidationPipe` handle input errors; don't duplicate that logic.

## Logging

- **Use the pino logger** (nestjs-pino). Request logging is automatic; for explicit
  logs inject the Nest `Logger`.
- **Never log secrets.** Sensitive headers (`authorization`, `cookie`) are already
  redacted in the pino config — extend redaction if you add sensitive fields.

## Health & observability

- Extend `/api/health` with new Terminus indicators (following `prisma.health.ts`)
  when you add critical external dependencies.

## Naming & style

- **Files:** kebab-case with a role suffix (`feedback.controller.ts`,
  `feedback.service.ts`, `feedback.module.ts`, `create-feedback.dto.ts`).
- **Classes:** PascalCase (`FeedbackService`, `CreateFeedbackDto`).
- Let ESLint + Prettier handle formatting/ordering; don't fight them.

## Testing

- **Unit tests** are colocated `*.spec.ts` files; test services with Prisma mocked
  or a test DB. Use Nest's `Test.createTestingModule`.
- **e2e tests** live in `test/` (`*.e2e-spec.ts`) and exercise the real app over
  HTTP; they need a database (CI provides a Postgres service + `migrate deploy`).
- Test behavior and contracts (status codes, validation, persisted effects).

## Quality gates (must stay green)

Run before committing (the Husky pre-commit hook runs lint-staged automatically):

```bash
npm run lint        # ESLint (auto-fix)
npm run typecheck   # tsc --noEmit
npm run build       # nest build  → must emit dist/main.js
npm test            # Jest unit
npm run test:e2e    # Jest e2e (needs a database)
```

> Build note: keep non-`src` TypeScript (e.g. `prisma/seed.ts`) **excluded** from
> `tsconfig.build.json`. Including it widens the inferred `rootDir` and shifts the
> build output to `dist/src/main.js`, breaking `node dist/main`. See decisions.md.

## Documentation upkeep

- Update the root `CHANGELOG.md` (`[Unreleased]`) for every behavior change.
- Update these docs when you change a convention or make a notable decision, and
  keep Swagger decorators current.
