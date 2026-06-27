# Playbook: Adding a Feature Consistently

Follow this when adding an endpoint or feature module. It encodes the patterns
already in the codebase so new work matches existing work. The running example is
"add `POST /api/v1/feedback`".

## 1. Model the data (if it needs persistence)

- Edit `prisma/schema.prisma` (add/extend the model; use enums for lifecycle state).
- Create a migration: `npm run migrate -- --name <describe_change>`. Commit the
  generated folder under `prisma/migrations/`. **Never `db push`.**
- Update `prisma/seed.ts` if sample data helps local/dev setup (keep it idempotent).

## 2. Scaffold the module

Create `src/<feature>/` with:

- `<feature>.module.ts` — declares controller + providers; add it to
  `AppModule`'s `imports`.
- `<feature>.controller.ts` — thin; versioned route + Swagger decorators.
- `<feature>.service.ts` — `@Injectable()`; business logic; injects `PrismaService`.
- `dto/` — request/response DTOs.

(You can use the Nest CLI: `npx nest g module <feature>`, `... g controller`,
`... g service` — then adjust to these conventions.)

## 3. Define DTOs with validation + docs

- A DTO class per input with `class-validator` decorators (`@IsString`,
  `@IsEmail`, `@MinLength`, `@MaxLength`, …) and `@ApiProperty()` for Swagger.
- The global `ValidationPipe` validates/transforms automatically — no manual checks.
- **Match the frontend's shape** (separate repo, hand-synced — see architecture.md).

## 4. Implement controller + service

- Controller: `@Controller({ path: "<feature>", version: "1" })`, `@ApiTags()`,
  one handler per operation; receive the DTO, return the result.
- Service: encapsulate logic; the only place using `PrismaService`. Throw Nest
  `HttpException`s for error cases (e.g. `NotFoundException`).

## 5. Config / env (if needed)

- New env var? Add it to `src/config/env.validation.ts` (Joi) **and** `.env.example`.
  Read it via `ConfigService`, never `process.env`.

## 6. Test it

- **Unit** (`*.spec.ts`, colocated): test the service with Prisma mocked, via
  `Test.createTestingModule`.
- **e2e** (`test/*.e2e-spec.ts`): exercise the endpoint over HTTP (status codes,
  validation rejection, persisted effect). Needs a DB.

## 7. Verify locally (all must pass)

```bash
npm run lint
npm run typecheck
npm run build        # must emit dist/main.js
npm test
npm run test:e2e     # needs a database (docker compose up -d postgres)
```

## 8. Document & commit

- Update root `CHANGELOG.md` under `[Unreleased]`.
- New pattern or notable choice → add to [decisions.md](decisions.md); update
  [conventions.md](conventions.md) if a rule changed.
- Verify the endpoint shows correctly at `/api/docs`.
- Commit (Husky runs lint-staged). CI must stay green.

## Quick checklist

- [ ] Prisma model + committed migration (no `db push`)
- [ ] Feature module registered in `AppModule`
- [ ] DTOs with class-validator + `@ApiProperty`
- [ ] Controller thin + versioned (`/api/v1/...`) + `@ApiTags`
- [ ] Service holds logic; only it uses `PrismaService`
- [ ] DTO shape matches the frontend contract
- [ ] Nest exceptions for errors (no hand-rolled status codes)
- [ ] No direct `process.env` (use `ConfigService`); env in Joi + `.env.example`
- [ ] Unit `*.spec.ts` + e2e `*.e2e-spec.ts`
- [ ] lint / typecheck / build / test / test:e2e green
- [ ] Swagger updated; CHANGELOG (+ decisions/conventions if relevant) updated
