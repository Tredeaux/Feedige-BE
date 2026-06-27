# Decision Log (ADRs)

Lightweight record of notable technical decisions: what we chose, why, and the
alternative we rejected. Append new entries at the top. Keep them short.

Format: **Decision → Why → Rejected alternative (when it would win).**

---

## AI analysis via OpenAI (structured, validated)

**Decision:** `POST /api/v1/feedback/:id/analyze` (triage/admin) calls the OpenAI
Chat Completions API with **Structured Outputs** (a strict JSON schema) to produce
`sentiment`/`priority`/`summary`/`confidence`/`keyThemes`/`recommendedActions`,
validates the response with **Joi** before persisting a new `feedback_analysis`
**version** (+ an audit-log entry). Prompt + output contract are versioned in code
(`analysis.constants.ts`, `ANALYSIS_PROMPT_VERSION`). Model defaults to
`gpt-4o-mini` (`OPENAI_MODEL`).

**Why (maps to the engineering standards' AI items):**

- **Structured output + validation:** schema-constrained generation _and_ a Joi
  re-check — we never trust raw model output (malformed JSON → 422).
- **Prompt-injection:** feedback is passed as the _user_ message and the system
  prompt explicitly says to treat it as untrusted data, not instructions.
- **Reliability:** the OpenAI client uses built-in retries (2) + a 30s timeout;
  failures surface as 503, not a crash.
- **Cost/latency:** `gpt-4o-mini` + `temperature 0.2`; one call per analyze.
- **Optionality:** `OPENAI_API_KEY` is optional — the client provider yields `null`
  and the endpoint returns 503 when unset, so the app still boots (and CI passes)
  without a key.

**Rejected:**

- **Auto-analyze on submit** — would put a slow, paid, failable LLM call in the
  user's submit path; instead it's an explicit triage action. Revisit with a
  **background worker/queue** when volume warrants (persist-first is already in
  place, so the move is incremental).
- **Default to Llama/other** — the schema's `model_used` default mentioned Llama,
  but the product choice here is OpenAI; `model_used` records whatever actually ran.

## Security hardening: authorization, rate limiting, error handling

Follow-ups from the senior audit:

- **Authorization (roles):** The `users.role` default is `member` (migration), so
  feedback-only users created implicitly by a submission are least-privileged. A
  `RolesGuard` + `@Roles()` decorator (`src/auth/`) protect admin/triage endpoints,
  and the frontend gates the panel on `role ∈ {admin, triage}`. **Product decision
  (updated):** **self-registration grants the `triage` role** — Feedige is an open/
  collaborative triage tool, so anyone who signs up can triage. `admin` is still
  granted out-of-band (seed / future promotion endpoint). **Trade-off:** there is no
  approval step on triage access; if the tool ever needs vetted triagers, switch
  registration back to `member` and add an admin-only promotion flow (the guard/role
  model already supports it).
- **Rate limiting:** In-app via `@nestjs/throttler` — a global 100/min baseline and
  a tight 5/min on `/auth/register` + `/auth/login`. **Why:** blunt brute-force and
  abuse with a portable, per-route limit. **Trade-off:** the in-memory store is
  per-instance; back it with **Redis** for multi-replica, and add **edge/gateway**
  rate limiting (Cloudflare/nginx) as the primary volumetric layer in production.
- **CORS:** dropped `credentials: true` (auth is Bearer, not cookies) so a `*`
  origin can't enable credentialed cross-origin requests; set an explicit
  `CORS_ORIGIN` allow-list in real environments.
- **Centralized errors:** a global `AllExceptionsFilter` normalizes the error shape,
  maps Prisma errors (P2002→409, P2025→404), and never leaks internals on 5xx.
- **Login timing:** login always runs a bcrypt compare (against a dummy hash when
  the user is absent) to avoid timing-based account enumeration.
- **Identity:** anonymous feedback submissions no longer overwrite an existing
  user's name (find-or-create, no update). **Remaining hardening:** email
  verification before a feedback-only account can be "claimed" via registration.

## Self-hosted JWT authentication

**Decision:** Roll our own auth (no external provider): passwords hashed with
**bcryptjs**, **JWT** issued on register/login (`@nestjs/jwt` + `passport-jwt`),
protected routes guarded by `JwtAuthGuard`. The token is returned to the client
and sent as `Authorization: Bearer <token>`. A `password_hash` column was added to
`users` (nullable — feedback-only users have none and can later "claim" the account
by registering).

**Why:** The requirement was explicitly "no external auth, clean and simple". Bearer
tokens are the simplest contract across the separate FE/BE origins.

**Trade-off / hardening:** The FE stores the token in `localStorage`, which is
readable by XSS. For production, move to an **httpOnly, Secure, SameSite cookie**
(needs HTTPS + CORS `credentials`), add refresh tokens/rotation, rate-limit
`/auth/*`, and consider `argon2` over bcrypt. `bcryptjs` (pure JS) was chosen over
native `bcrypt`/`argon2` to avoid native builds in the Alpine Docker image.

**Rejected:** External auth (Clerk/Auth0) — explicitly out of scope; httpOnly
cookies now — more setup than "simple" warrants in local dev across two origins.

## Domain schema: users / feedback / feedback_analysis / audit_log

**Decision:** Model the triage domain as four tables with these senior choices:

- **UUID PKs** generated by Postgres `gen_random_uuid()` (`@default(dbgenerated(...))`,
  `@db.Uuid`) — the DB is authoritative for ids; UUIDs avoid enumerable integer keys.
- **snake_case** DB names via `@map`/`@@map`; the Prisma client stays camelCase.
- **`feedback_analysis` is versioned** (`version` + unique `(feedback_id, version)`)
  so re-analyses are kept as new rows, not overwrites — full history.
- **`audit_log` is append-only** with `old_value`/`new_value` as JSONB for flexible
  before/after snapshots.
- **Explicit FK indexes** on every foreign key (Postgres doesn't auto-index them),
  plus `feedback.status` / `feedback.created_at` for triage listing.
- **Referential actions:** `ON DELETE CASCADE` from `feedback` → analyses/audit
  (children are meaningless without the parent); `ON DELETE SET NULL` for the
  nullable user references (deleting a user must not erase feedback or history).

**Why:** Matches the provided spec while adding the integrity/perf details a
production schema needs. Versioned analyses + an audit trail make triage decisions
explainable and reversible through data.

**Rejected:**

- **Postgres enums** for `status`/`sentiment`/`priority`/`role` — chose `VARCHAR`
  (per the spec) for flexibility: adding a value needs no migration, and `ALTER TYPE`
  on enums is awkward. Revisit enums (or `CHECK` constraints) if we need DB-enforced
  value integrity; document the trade-off then.
- **`cuid()`/autoincrement** ids — UUIDs were specified and are better for
  distributed/opaque ids.
- **Single mutable `analysis` row per feedback** — loses re-analysis history.

## Squashed the placeholder migration

**Decision:** Replaced the throwaway scaffold migration (the example
`Feedback{title,body,status}` model) with a single clean `init` migration for the
real four-table schema.

**Why:** The placeholder was never deployed to any shared/production environment
(only local dev + ephemeral CI), so a create-then-immediately-replace history adds
no value. One clean `init` is easier to read and reason about.

**Rejected:** Keeping the placeholder and adding a second migration that drops/
recreates everything. That's the correct approach **once any migration has shipped
to a shared environment** — never edit/delete published migration history after that
point. We squashed only because nothing had shipped.

## Self-migrating container

**Decision:** The API container runs `prisma migrate deploy` on startup via
`docker-entrypoint.sh` before launching the app; the `prisma` CLI is a runtime
dependency (not dev-only) so it's present in the production image.

**Why:** A fresh environment comes up fully provisioned with no manual step —
"clean setup" is just `docker compose up`.

**Rejected:** Running migrations as a separate CI/CD step or one-off job. That's
better at scale (multiple replicas shouldn't race to migrate) — if we move to
horizontal scaling, switch to a dedicated migration job and drop the entrypoint
migrate. For now, simplicity wins.

---

## Forward-only migrations (no downgrade)

**Decision:** Use Prisma Migrate with committed, timestamped migrations; no
down/rollback migrations. To revert, write a new forward migration.

**Why:** Prisma is forward-only by design and roll-forward is a safer production
posture for data than scripted downgrades. Explicit product decision.

**Rejected:** Paired up/down scripts via `prisma migrate diff`, or a separate
up/down tool (node-pg-migrate). Reconsider only if a hard requirement for
symmetric downgrades appears.

---

## Pinned Prisma to v6 (not v7)

**Decision:** Pin `prisma` and `@prisma/client` to `^6`.

**Why:** npm installs Prisma 7 by default, which **drops `url` from the schema** and
requires driver adapters + a `prisma.config.ts` — added complexity the NestJS
ecosystem hasn't standardized on. v6 is stable and well-documented for NestJS.

**Rejected:** Prisma 7 with driver adapters. Revisit when the driver-adapter
pattern is mainstream; the upgrade will need `prisma.config.ts` and a `@prisma/adapter-pg`
setup. (Note: `package.json#prisma` seed config is also deprecated in 7 — move it to
`prisma.config.ts` at that time.)

---

## NestJS as the framework

**Decision:** NestJS 11 on Express, with DI, modules, and decorators.

**Why:** Opinionated structure (modules/controllers/services) keeps a growing API
consistent; first-class DI, validation, Swagger, and testing support.

**Rejected:** Express/Fastify alone (less structure, more boilerplate for DI,
validation, docs). Choose minimal frameworks for tiny services; Feedige expects to
grow.

---

## Global ValidationPipe + class-validator DTOs

**Decision:** A global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
`transform`) with class-validator DTOs.

**Why:** Every endpoint validates and transforms input consistently with zero
per-handler code; unknown properties are rejected.

**Rejected:** Per-route manual validation or Zod pipes. Zod is great (and used on
the FE), but class-validator is Nest-idiomatic and integrates with Swagger; mixing
both here would be inconsistent.

---

## Joi-validated env, fail-fast

**Decision:** Validate env with Joi in `ConfigModule.forRoot`; the app refuses to
boot on invalid config. Read via `ConfigService`.

**Why:** Catch misconfiguration at startup, not deep in a request. Typed access.

**Rejected:** Reading `process.env` ad hoc (untyped, fails late and silently).

---

## /api prefix + URI versioning

**Decision:** Global `/api` prefix and URI versioning (`/api/v1/...`); operational
routes (health) are version-neutral.

**Why:** Clean separation of API surface; versioning lets the contract evolve
without breaking existing clients.

**Rejected:** Header/media-type versioning (less obvious to consumers); no
versioning (painful to evolve a contract consumed by a separate FE repo).

---

## Structured logging with nestjs-pino

**Decision:** `nestjs-pino` as the app logger; automatic request logging; redact
sensitive headers.

**Why:** Fast, JSON, production-grade logs that aggregators can parse; one logger
across the app.

**Rejected:** Nest's default logger (not structured/JSON, weaker for production).

---

## Terminus health check

**Decision:** `@nestjs/terminus` at `/api/health` with a custom Prisma DB-ping
indicator.

**Why:** Standard, extensible health contract for orchestrators/uptime checks that
verifies real dependencies (the DB), not just process liveness.

**Rejected:** A hand-rolled `{status:"ok"}` endpoint (doesn't prove the DB is
reachable).

---

## Configurable host ports (POSTGRES_PORT, API_PORT)

**Decision:** docker-compose publishes Postgres and the API on `${POSTGRES_PORT:-5432}`
and `${API_PORT:-3001}`.

**Why:** Defaults stay conventional for clean environments, but developers with
those ports already in use can override in `.env` without editing committed files.

**Rejected:** Hardcoded ports (collide with other local services).

---

## Separate frontend and backend repositories

**Decision:** FE (`Feedige-FE`) and BE are separate repos. The API contract is
expressed by DTOs + the Swagger spec and **hand-synced** with the FE's `src/lib/`
schemas.

**Why:** Explicit product choice for independent deploy/ownership.

**Trade-off / how to proceed:** Shapes can drift across repos. Keep DTOs aligned
with the FE on every change. If drift becomes painful, generate a typed FE client
from this service's OpenAPI/Swagger spec (preferred — it already exists) or publish
a shared types package.
