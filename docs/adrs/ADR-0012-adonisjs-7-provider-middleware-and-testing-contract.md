# ADR-0012: AdonisJS 7 Provider, Middleware, And Testing Contract

## Status

Accepted — superseded by ADR-0013-nodejs-24-and-adonisjs-7-support-baseline

## Supersedes

- ADR-0011-adonis-provider-middleware-and-testing-contract
- ADR-0010 Decision 1 and Decision 10 only where they select Lucid 21.8 and Node 22/24 for Lucid
  evidence; the PostgreSQL RLS architecture and all other ADR-0010 decisions remain accepted.

## Context

ADR-0011 selected AdonisJS 6/Lucid 21 so the integration could run in both repository Node 22/24
lanes. The product owner has now made AdonisJS 7 a release requirement: it is the current major after
a long v6 lifecycle and is the version new adopters will choose. Current AdonisJS 7.3 and Lucid 22.4
require Node 24.

The supplied v6-to-v7 upgrade procedure also exposes concrete compatibility changes relevant to
TenancyJS templates and examples: `@poppinss/ts-exec`, Adonis init/build hooks, brace test globs,
encryption config, URL builder helpers, `HttpRequest`/`HttpResponse` names, new package-import aliases,
and optional Inertia/Bouncer/Vite hooks. The repository itself is a pnpm monorepo and is not an
AdonisJS v6 application, so destructive npm `--force` upgrade commands cannot run at its root.

## Decision

1. `@tenancyjs/integration-adonis` targets AdonisJS `>=7.3.0 <8` and Lucid `>=22.4.0 <23`, declares
   Node `>=24`, and receives hosted Node 24 production/Japa/PostgreSQL evidence. Core, Knex, Prisma,
   Express, Next, and CLI retain their existing Node 22/24 lanes.
2. Publish the integration separately, depending inward on core, identifiers, and the Lucid adapter.
   It imports no CLI package, base Knex client, or application model. Ace factories accept an
   application-injected structural shared-CLI service port.
3. Expose typed `defineAdonisTenancyConfig` for one application-owned manager, resolver, Lucid tenancy
   service, error mapping, and middleware options. Config contains no credentials, creates no hidden
   database client, and never infers central routes or duplicates model classification.
4. The AdonisJS 7 provider registers stable IoC bindings during `register`, validates adapter policy
   during `boot`/`ready`, and releases only integration-owned resources during shutdown. It follows
   current Adonis provider and `adonisrc.ts` hook conventions.
5. Tenant middleware copies a frozen host/header snapshot from `HttpContext`, resolves exactly once,
   enters `TenancyManager.runWithTenant` only for `resolved`, then enters the Lucid managed transaction
   around `await next()`. Any resolution, handler, transaction, or cleanup failure rolls back/releases.
6. Missing/invalid identity maps to sanitized 400, unknown/suspended to the same sanitized 404, and
   ambiguous registry state to sanitized 500. Resolver failure never becomes central context.
7. Tenant middleware is explicit on tenant route groups. Central routes omit it or enter explicit core
   central scope through application-owned code. Work spawned or streamed after middleware settlement
   is outside the supported database lifetime.
8. Export a Japa helper/plugin using the same manager/Lucid service. Stable evidence uses AdonisJS 7's
   Japa plugin and API client plus a compiled production application—not framework mocks alone.
9. Export thin Ace command factories only for operations already owned by the shared CLI. They map
   arguments/results/exits without duplicating file writes, migration, seed, or tenant iteration.
10. Safe CLI init emits AdonisJS 7-native provider, middleware, config, imports, model/migration, and
    test files through `ProjectChangePlan`. It remains preview-first, conflict-aware, contained,
    symlink-safe, idempotent, secret-safe, and shell-free.
11. Maintain an isolated v6-to-v7 compatibility fixture/checklist derived from the supplied upgrade
    procedure. It verifies TenancyJS-generated files use v7 names and layout. Never run its npm
    `--force` command against the monorepo or silently upgrade a user's project.
12. Initial Adonis/Lucid isolation remains PostgreSQL 17 under ADR-0010. Other SQL providers require
    their own enforceable boundary and real-database evidence; framework support does not imply
    database-provider support.

## Alternatives Considered

- Keep AdonisJS 6 as the initial target: rejected because it would launch against the previous major
  and miss the intended adopter base.
- Support v6 and v7 in one initial peer range: rejected because their Node, Lucid, compiler, config,
  hooks, and HTTP type surfaces differ materially and would weaken the first compatibility claim.
- Drop Node 22 repository-wide: rejected because existing framework-neutral and proven packages still
  support it; only AdonisJS 7 requires Node 24.
- Execute the supplied npm `--force` upgrade at repository root: rejected because this is a pnpm
  monorepo, not a v6 Adonis app, and forced dependency replacement would damage unrelated packages.
- Put upgrade automation inside runtime integration: rejected; runtime tenancy and project migration
  have different trust/write boundaries. Upgrade guidance and isolated fixtures are sufficient now.
- Put Adonis behavior in the Lucid adapter or store tenant state on `HttpContext`: rejected by the
  accepted package direction and canonical async-context model.

## Consequences

TenancyJS aligns its Adonis launch with the current ecosystem and can use current provider, compiler,
hook, HTTP, Lucid, Japa, and Ace conventions without a compatibility shim. The existing Node 22 support
promise remains intact for non-Adonis packages.

The Adonis package/example require a dedicated Node 24 lane and cannot be exercised as supported on
Node 22. A future v6 compatibility package would need separate evidence. Tenant middleware may hold a
PostgreSQL connection for handler lifetime, so streaming and long-running handlers remain explicit
limits. The generic v6-to-v7 upgrade procedure is guidance/fixture input, not an automatic destructive
TenancyJS operation.

## Related Documents

- PRD: `docs/40-features/F-007-knex-lucid-adonis/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-007-knex-lucid-adonis/`
- Module: `docs/30-modules/integration-adonis/`
- Superseded decision: `docs/adrs/ADR-0011-adonis-provider-middleware-and-testing-contract.md`
- Adonis upgrade guide: `https://docs.adonisjs.com/guides/upgrade-guides/v6-to-v7`
- Adonis service providers: `https://docs.adonisjs.com/guides/concepts/service-providers`
- Lucid documentation: `https://lucid.adonisjs.com/docs/introduction`
