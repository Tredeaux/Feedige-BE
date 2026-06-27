# Engineering Standards — Senior Expectations & Review Checklist

What we expect of every engineer working on Feedige, and the bar we hold work to
in review. It complements [`conventions.md`](conventions.md): conventions are the
_specific rules_ for this codebase; this is the _broader standard_ and the
mindset behind them.

**How to use this**

- **While building:** keep these in mind — they're the responsibilities of a
  senior engineer, not a post-hoc checklist.
- **Before "done":** self-review your change against the relevant items below.
- **For AI assistants:** treat this as acceptance criteria. Check your output
  against each applicable item before proposing it. Use judgement — not every
  item applies to every change.
- **Trade-offs:** when you knowingly skip something, say so (in the PR, a code
  comment, or `SOLUTION.md`). A named, reasoned skip is senior; a silent gap is not.

---

## Architecture & Structure

- [ ] **Separation of concerns** — clear layers (UI, business logic, data access, external services)
- [ ] **Single Responsibility Principle** — functions/components do one thing well
- [ ] **Folder structure** — logical, scalable, and consistent
- [ ] **Dependency direction** — no circular dependencies
- [ ] **Abstraction vs implementation** — proper use of services, repositories, use cases

## Code Quality & Maintainability

- [ ] **Early returns** — avoid deep nesting ("arrow code")
- [ ] **Meaningful names** — variables and functions read clearly
- [ ] **Small, focused functions** — ideally < 30–40 lines
- [ ] **Consistent style** — linting and formatting enforced
- [ ] **Type safety** — strong TypeScript, minimal `any`
- [ ] **DRY** — don't repeat yourself, where it makes sense
- [ ] **Error handling** — centralized, consistent, informative

## Security

- [ ] **Input validation & sanitization** (Zod / `class-validator`, etc.)
- [ ] **No hardcoded secrets / API keys** in code
- [ ] **Auth & authorization** — implemented, or explicitly called out if skipped
- [ ] **Prompt-injection protection** (for AI inputs)
- [ ] **Rate limiting** on sensitive endpoints
- [ ] **CORS, Helmet**, and similar hardening where applicable

## Performance & Scalability

- [ ] **Efficient queries** — indexes used, N+1 awareness
- [ ] **Reasonable caching** where it helps
- [ ] **Proper async/await** — no blocking code
- [ ] **Large-volume awareness** — pagination, streaming, limits
- [ ] **Background-job strategy** for heavy tasks (e.g. AI calls)

## Reliability & Production Readiness

- [ ] **Error boundaries & graceful degradation**
- [ ] **Logging & observability** — structured logs
- [ ] **I/O validation on external services** (validate what the AI returns)
- [ ] **Idempotency** where relevant
- [ ] **Configuration management** — env vars + validation
- [ ] **Health / readiness endpoints**

## Testing

- [ ] **Unit tests** on critical business logic
- [ ] **Integration tests** for key flows
- [ ] **Coverage on important paths** (not coverage for its own sake)

## AI-Specific (for this project — mostly backend)

- [ ] **Prompt engineering quality & version control** — prompts are deliberate and tracked
- [ ] **Structured output handling + fallback** — parse/validate model output, handle malformed responses
- [ ] **Cost & latency awareness** — token usage, response times considered
- [ ] **Hallucination mitigation & validation** — don't trust raw model output blindly
- [ ] **Retry logic or circuit breaker** for external AI calls

## Other Senior Signals

- [ ] **Meaningful commit history** — small, coherent, well-described commits
- [ ] **Good README & setup instructions** — a stranger can run it
- [ ] **Trade-off documentation** (`SOLUTION.md`) — what you chose and why, and what you rejected
- [ ] **Extensibility** — easy to add new features
- [ ] **Comments on complex logic** — explain the non-obvious, not the obvious
