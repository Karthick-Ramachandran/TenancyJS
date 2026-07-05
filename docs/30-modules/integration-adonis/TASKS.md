# Module Tasks: Integration Adonis

## Active Work

- T5 provider/middleware/config/error mapping implemented with unit tests; Japa/Ace/example are T6.

## Tasks

- Complete: accepted provider/middleware/Japa/Ace/config contract (ADR-0014).
- Complete: T5 `defineAdonisTenancyConfig`, `TenancyProvider`, `TenancyMiddleware`, and sanitized error
  mapping, with unit tests (config, errors, middleware, provider, Lucid runner compatibility).
- Complete: framework-neutral `withTenant` test helper (`./testing`) with unit tests (F-007 T6, part 1).
- Complete: local reference example (`examples/adonis-lucid`, scaffolded from the official AdonisJS 7
  `api` starter kit; gitignored/standalone) — Japa + `@japa/api-client` E2E proves two-tenant isolation,
  tenant injection on create, and sanitized 400/404 against real forced RLS on PostgreSQL 17 (4/4 green).
- Complete: package refinements the real app surfaced — a lazy tenancy factory in
  `defineAdonisTenancyConfig` and `web`-environment-gated policy validation in the provider.
- Complete: safe CLI `init` Adonis/Lucid detection and templates in `tenancyjs-cli`
  (`config/tenancy.ts` + `app/middleware/tenant_middleware.ts`), unit-tested and verified end-to-end.
- Deferred: native `node ace tenancy:*` commands ship with the operational CLI (a single
  decorator/tsconfig decision for all of them; see LESSONS on AdonisJS legacy decorators). `npx tenancy
  init` already scaffolds AdonisJS today.
- Todo: v6→v7 CLI fixture, T7 reviews, and published/hosted example evidence when the example moves to
  its own repository.
