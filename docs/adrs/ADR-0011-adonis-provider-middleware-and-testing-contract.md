# ADR-0011: Adonis Provider, Middleware, And Testing Contract

## Status

Accepted — superseded by ADR-0012-adonisjs-7-provider-middleware-and-testing-contract

## Context

T-08 must make TenancyJS native to AdonisJS without placing framework behavior in core or conflating
Lucid with generic Knex. Adonis applications expect IoC providers, class middleware, typed config,
Ace commands, and Japa integration. Tenant HTTP lifecycle must also coordinate resolution, core async
context, and the Lucid managed transaction accepted by ADR-0010.

Current AdonisJS 7.3/Lucid 22 packages require Node 24. The repository supports Node 22 and 24, while
AdonisJS 6.21/Lucid 21.8 support both. The initial compatibility claim must remain executable in both
existing CI lanes.

## Decision

1. Publish `@tenancyjs/integration-adonis` as a separate package depending inward on core,
   identifiers, and the Lucid adapter. It initially peers on AdonisJS 6.21.x and Lucid 21.8.x and is
   exercised on Node 22/24. AdonisJS 7/Lucid 22 requires a later Node-24 compatibility lane.
2. Expose a typed `defineAdonisTenancyConfig` for one application-owned manager, resolver, Lucid
   tenancy service, error mapping, and middleware options. Configuration does not contain credentials,
   create database clients, infer central routes, or duplicate table/model classification.
3. An Adonis service provider registers stable IoC bindings for the manager, resolver, and Lucid
   tenancy service during `register`; validates configuration/policies during `boot`/`ready`; and
   releases owned resources during shutdown only when the integration created them. Application-owned
   resources are never disconnected implicitly.
4. Tenant middleware copies a frozen host/header snapshot from `HttpContext`, resolves exactly once,
   enters `TenancyManager.runWithTenant` only for `resolved`, then enters the Lucid managed transaction
   around `await next()`. Any resolution, handler, transaction, or cleanup failure rolls back/releases.
5. Missing/invalid identity maps to sanitized 400, unknown/suspended to the same sanitized 404, and
   ambiguous registry state to sanitized 500. Applications may override response mapping without
   receiving raw SQL/bindings/credentials. Resolver failure never becomes central context.
6. Tenant middleware is registered explicitly on tenant route groups. Central routes omit it or enter
   explicit core central scope through application-owned code. Work spawned or streamed after the
   middleware promise settles is outside the supported database lifetime.
7. Export a Japa helper/plugin that runs callbacks under the same manager/Lucid service and restores
   both contexts after success/failure. HTTP evidence uses the Adonis Japa plugin and API client rather
   than treating Vitest-only unit tests as framework compatibility.
8. Export thin Ace command factories only for operations already owned by `@tenancyjs/cli` (initially
   Doctor and leak-test/diagnostic services). Factories accept an application-injected structural CLI
   service port, so the integration does not depend on the CLI package. Commands map arguments/results/
   exits and never reimplement project writes, migration, seed, or tenant iteration. Operational
   wrappers follow when T-10 adds services.
9. Safe CLI init extends the existing `ProjectChangePlan` engine with Adonis provider, middleware,
   config, model/migration, and test templates. It remains preview-first, conflict-aware, contained,
   symlink-safe, idempotent, secret-safe, and shell-free.
10. Stable support requires a compiled production Adonis + Lucid example, Japa HTTP and console tests,
    concurrent PostgreSQL isolation, rollback/cleanup failures, clean package consumers, and hosted
    Node 22/24 evidence.

## Alternatives Considered

- Put Adonis behavior in the Lucid adapter: rejected because framework lifecycle and ORM enforcement
  have different dependency directions, users, and release cadence.
- Store the current tenant on `HttpContext` or an IoC singleton: rejected because background async work
  and concurrent requests require the canonical `TenancyManager` scope.
- Start/end tenant state imperatively around `next()`: rejected because thrown/rejected paths and nested
  execution need lexical cleanup owned by core.
- Register middleware globally on every route: rejected because central routes must be explicit and a
  resolution failure cannot silently choose central mode.
- Implement `tenancy:migrate`/`seed` directly as Ace commands now: rejected by ADR-0003 and T-10
  ownership; wrappers must delegate to shared CLI services.
- Target AdonisJS 7 only: rejected because it would silently drop the accepted Node 22 lane.
- Claim Adonis compatibility from generic middleware mocks: rejected; production and Japa evidence are
  required.

## Consequences

Adonis users receive native package structure and lifecycle behavior while all tenant state remains in
the framework-neutral manager. Lucid transactions and HTTP cleanup have one explicit owner, Japa tests
exercise real framework behavior, and Ace cannot drift from shared CLI semantics.

Initial support deliberately targets AdonisJS 6 rather than the latest major. Tenant middleware may
hold a PostgreSQL connection for the handler lifetime, so streaming and long-running handlers need
clear limits and performance evidence. Broader Auth/Bouncer/Inertia/queue recipes and operational Ace
commands remain follow-up work.

## Related Documents

- PRD: `docs/40-features/F-007-knex-lucid-adonis/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-007-knex-lucid-adonis/`
- Module: `docs/30-modules/integration-adonis/`
- Adonis service providers: `https://docs.adonisjs.com/guides/concepts/service-providers`
- Adonis middleware: `https://docs.adonisjs.com/guides/basics/middleware`
- Adonis testing: `https://docs.adonisjs.com/guides/testing/introduction`
- Adonis Ace: `https://docs.adonisjs.com/guides/ace/introduction`
