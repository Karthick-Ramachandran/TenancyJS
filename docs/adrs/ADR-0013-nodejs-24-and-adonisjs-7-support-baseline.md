# ADR-0013: Node.js 24 And AdonisJS 7 Support Baseline

## Status

Accepted

## Supersedes

- ADR-0012-adonisjs-7-provider-middleware-and-testing-contract
- The Node 22 compatibility clauses in ADR-0007, ADR-0008, ADR-0009, and ADR-0010. Their security,
  lifecycle, package-boundary, and database decisions remain accepted.

## Superseded In Part

Decisions 3 through 13 below — the AdonisJS 7 integration contract (the `@tenancyjs/integration-adonis`
package boundary and AdonisJS 7.3 / Lucid 22.4 peer target, `defineAdonisTenancyConfig`, the provider
lifecycle, tenant middleware, sanitized error mapping, tenant-route explicitness, the Japa helper, Ace
factories, safe CLI init templates, the v6-to-v7 fixture, and the PostgreSQL 17 Adonis/Lucid isolation
clause) — are extracted into and superseded by
`ADR-0014-adonisjs-7-integration-provider-and-middleware-contract`. Cite ADR-0014 for those decisions.
Decisions 1 and 2 (the Node.js 24 engine and CI baseline) remain the accepted repository baseline and
are the reason this ADR stays accepted. The decision text below is preserved unchanged for the audit
trail.

## Context

ADR-0012 selected AdonisJS 7.3/Lucid 22.4 on Node 24 while retaining Node 22/24 lanes for the rest of
the repository. That mixed-engine workspace immediately required CI to weaken install-time engine
validation and maintain conditional test exclusions. TenancyJS is still pre-alpha with no stable
consumer compatibility promise, so preserving a second runtime now creates ongoing cost without an
installed-user migration benefit.

Node 24 is a valid common floor for every planned initial stack: Express 5, Next.js 16, NestJS 11,
AdonisJS 7, Prisma 7, Knex 3, Lucid 22, and Sequelize 6 all declare ranges that include Node 24. Node
24 is Active LTS and has a longer remaining support window than Node 22.

The supplied AdonisJS v6-to-v7 upgrade procedure still identifies concrete compatibility requirements
for TenancyJS templates and fixtures: `@poppinss/ts-exec`, current init/build hooks, brace test globs,
encryption config, URL-builder helpers, `HttpRequest`/`HttpResponse` names, package-import aliases, and
optional Inertia/Bouncer/Vite hooks. The repository is not an AdonisJS v6 application, so destructive
npm `--force` upgrade commands never run at its root.

## Decision

1. Set Node.js `>=24` as the minimum engine for the root workspace, every published TenancyJS package,
   every reference application, contributor tooling, and CI. New packages inherit this floor unless a
   later ADR raises it.
2. Run the canonical repository gate on Node 24 with PostgreSQL 17. Remove the Node 22 lane, mixed-engine
   install exceptions, and Node-version-specific test exclusions. Historical Node 22 evidence remains
   factual but is no longer part of the advertised support matrix.
3. Continue targeting AdonisJS `>=7.3.0 <8` and Lucid `>=22.4.0 <23`. Publish
   `@tenancyjs/integration-adonis` separately, depending inward on core, identifiers, and the Lucid
   adapter. It imports no CLI package, base Knex client, or application model.
4. Expose typed `defineAdonisTenancyConfig` for one application-owned manager, resolver, Lucid tenancy
   service, error mapping, and middleware options. Config contains no credentials, creates no hidden
   database client, and never infers central routes or duplicates model classification.
5. The AdonisJS 7 provider registers stable IoC bindings during `register`, validates adapter policy
   during `boot`/`ready`, and releases only integration-owned resources during shutdown. It follows
   current provider and `adonisrc.ts` hook conventions.
6. Tenant middleware copies a frozen host/header snapshot from `HttpContext`, resolves exactly once,
   enters `TenancyManager.runWithTenant` only for `resolved`, then enters the Lucid managed transaction
   around `await next()`. Any resolution, handler, transaction, or cleanup failure rolls back/releases.
7. Missing/invalid identity maps to sanitized 400, unknown/suspended to the same sanitized 404, and
   ambiguous registry state to sanitized 500. Resolver failure never becomes central context.
8. Tenant middleware is explicit on tenant route groups. Central routes omit it or enter explicit core
   central scope through application-owned code. Work spawned or streamed after middleware settlement
   is outside the supported database lifetime.
9. Export a Japa helper/plugin using the same manager/Lucid service. Stable evidence uses AdonisJS 7's
   Japa plugin and API client plus a compiled production application—not framework mocks alone.
10. Export thin Ace command factories only for operations already owned by the shared CLI. They accept
    an application-injected structural service port and never duplicate file writes, migration, seed,
    or tenant iteration.
11. Safe CLI init emits AdonisJS 7-native provider, middleware, config, imports, model/migration, and
    test files through `ProjectChangePlan`. It remains preview-first, conflict-aware, contained,
    symlink-safe, idempotent, secret-safe, and shell-free.
12. Maintain an isolated v6-to-v7 compatibility fixture/checklist derived from the supplied upgrade
    procedure. It verifies generated files use v7 names and layout. Never run its npm `--force`
    command against this monorepo or silently upgrade a user's project.
13. Initial Adonis/Lucid isolation remains PostgreSQL 17 under ADR-0010. Other SQL providers require
    their own enforceable boundary and real-database evidence; framework support does not imply
    database-provider support.

## Alternatives Considered

- Retain Node 22/24 for framework-neutral packages: rejected because the pre-alpha project gains little
  adoption value while paying for mixed engine validation, conditional test graphs, and doubled CI.
- Publish separate Node 22 and Node 24 package families: rejected because it fragments package names,
  documentation, release evidence, and security maintenance before v1.
- Keep Node 22 at root but exempt only Adonis/Lucid packages: rejected after the workspace engine and
  Vitest graph required special CI behavior that could mask incorrect runtime loading.
- Move directly to Node 26: rejected because Node 26 is Current rather than LTS; Node 24 is the common
  production baseline for this release.
- Support AdonisJS 6 and 7 together: rejected because their Node, Lucid, compiler, config, hooks, and
  HTTP surfaces differ materially and would weaken the initial compatibility claim.

## Consequences

The repository has one truthful engine, one install policy, one CI runtime, and one compatibility
baseline across all packages. AdonisJS 7/Lucid 22 no longer force exceptions into otherwise shared
tooling. Dependency updates and package-consumer verification become simpler and cheaper.

Node 22 applications must upgrade their runtime before adopting TenancyJS, even though some individual
frameworks and ORMs could run there. This is an intentional pre-v1 compatibility break. A future need
for older-runtime support requires separate user demand, package evidence, and a superseding ADR.

Historical PRs that proved Node 22 behavior remain valid records of what passed at that time, but they
must not be presented as the current support floor. Adonis middleware may hold a PostgreSQL connection
for handler lifetime, so streaming and long-running handlers remain explicit limits.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-007-knex-lucid-adonis/`
- Modules: `docs/30-modules/lucid-adapter/`, `docs/30-modules/integration-adonis/`
- Superseded decision: `docs/adrs/ADR-0012-adonisjs-7-provider-middleware-and-testing-contract.md`
- Node.js release schedule: `https://github.com/nodejs/Release`
- AdonisJS v6-to-v7 guide: `https://docs.adonisjs.com/guides/upgrade-guides/v6-to-v7`
