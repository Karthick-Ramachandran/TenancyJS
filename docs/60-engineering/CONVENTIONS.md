# Conventions

The canonical, reusable vocabulary for this repository. Agents reference these by name and reuse them
instead of inventing new components, helpers, or patterns. Repository rules override model
preferences.

## Canonical Primitives

- `TenantContext`: immutable tenant execution state owned by `tenancyjs-core`.
- `TenancyManager`: the only public lifecycle entry point for tenant and central execution scopes.
- `TenancyBootstrapper`: context-local setup/revert contract registered at manager construction.
- `TenancyLifecycleError`: combined evidence when lifecycle cleanup fails.
- `TenantResolver`: framework-neutral tenant resolution contract.
- `TenantResolutionOutcome`: exhaustive, non-secret result of ordered resolver plus tenant-store lookup.
- `TenancyContractCase`: runner-neutral `{ name, run }` conformance case from `tenancyjs-testing`.
- `TenancyAdapter`: implemented ORM-neutral capability and validation contract owned by core.
- `createPrismaTenancyExtension`: canonical Prisma row-level extension factory; never expose a base
  Prisma client as the protected application client.
- `createPrismaSchemaTenancy` and `createPrismaDatabaseTenancy`: canonical callback-scoped Prisma
  placement routers; both reuse the shared bounded cache and never expose a client beyond its lease.
- `createKnexTenancy`: canonical Knex protected-callback factory; execution stays locked until forced
  PostgreSQL RLS validation passes, and the base Knex client is never application-facing.
- `createLucidTenancy`: canonical Lucid 22 managed-transaction factory; registered models use native
  hooks for normal operations while forced PostgreSQL RLS denies hook-skipping paths.
- `createTypeOrmTenancy` and `createSequelizeTenancy`: canonical strategy-discriminated protected
  plain-value repository/model facades for PostgreSQL and MySQL; native ORM clients, query builders,
  instances, and raw APIs stay private.
- `createDrizzleTenancy` with `createPostgresDrizzleBinding` or `createMySqlDrizzleBinding`: canonical
  protected Drizzle 0.45 table facade. Native database/transaction/SQL objects stay private; every
  cache-owned tenant binding supplies deterministic pool cleanup.
- `createMongooseTenancy`: canonical adapter-enforced protected lean-model facade and database router;
  it requires replica-set resources for managed transactions and never returns Mongoose documents or
  queries.
- `createPostgresStrategyEngine`: canonical shared PostgreSQL schema-placement engine in
  `tenancyjs-adapter-shared`; Knex/Lucid/TypeORM/Sequelize bind their executor shapes to it and never duplicate its
  RLS/context/`search_path` SQL. It owns the lifetime tenant-to-schema collision guard; adapters do not
  implement their own placement maps.
- `createTenantResourceCache`: canonical bounded database-per-tenant resource lifecycle; adapters use
  its single-flight leases and never create an unbounded per-tenant client map.
- `createPostgresSchemaProvisioner` / `createPostgresDatabaseProvisioner`: canonical batteries-included
  `TenancyProvisioner` factories in `tenancyjs-adapter-shared` (ADR-0039). Hosts pass a `pg`-shaped admin
  connection + a placement resolver; the factory owns the idempotent CREATE/DROP SCHEMA/DATABASE DDL
  (identifiers validated via `assertSqlIdentifier`) and delegates `migrate` to a host callback. Do not
  hand-write provision/deprovision DDL in host configs or scaffolds when these apply.
- `createExpressTenancyMiddleware`: canonical Express 5 request-lifecycle bridge; it composes an
  application-owned `TenancyManager` and tenant resolver and never creates hidden tenant state.
- `captureTenancy` / `runWithTenancySnapshot` (`tenancyjs-core`, ADR-0040): canonical way to carry tenant
  context across a queue/timer/worker boundary (where `AsyncLocalStorage` context is lost). Capture a
  serializable snapshot at enqueue, restore it on the worker. Do not hand-thread tenant ids into job
  payloads or re-open scopes manually.
- `onboardTenant` (`tenancyjs-core`, F-021): canonical signup-path lifecycle — `store.create` →
  `provisioner.provision` → `provisioner.migrate`, with best-effort rollback on failure. Do not
  re-sequence these by hand in a signup handler; call `onboardTenant`.
- `createNextTenancy`: canonical Next.js App Router Node bridge for Route Handlers and Server Actions;
  its separate Edge helper transports only untrusted identity hints for Node revalidation.
- `TenancyModule` + `@TenantRoute`: canonical NestJS 11 guard/interceptor composition. Resolution occurs
  before authorization guards; canonical tenant/adapter context covers only the handler Observable.
- `defineAdonisTenancyConfig`: canonical typed AdonisJS 7 config factory; it validates and freezes one
  application-owned manager, resolver, and Lucid tenancy service and creates no hidden database client.
- `TenancyMiddleware`: canonical AdonisJS 7 tenant-route middleware; it resolves once and runs each
  request inside `runWithTenant` and the Lucid managed transaction, with sanitized failure mapping and
  no central fallback. `TenancyProvider` is its companion provider that registers the binding and
  validates the Lucid policy fail-closed at `ready`.
- `createRowLevelAdapterContract`: runner-neutral two-tenant adapter conformance suite.
- `ProjectChangePlan`: canonical immutable CLI preview/apply contract; content is never printed in
  normal output and every action is revalidated before commit.
- `runDoctor`: canonical deterministic CLI diagnostic entry point with stable findings and exit mapping.
- `TenancyIntegration`: framework lifecycle bridge contract.
- Conformance suites in `tenancyjs-testing`: required evidence for stable adapters and integrations.
- `pnpm check`: canonical repository gate for lint, format, types, tests, package verification, and
  Persist memory validation.

Core, resolver, outcome, contract-case, adapter, shared strategy engine, Prisma-extension, Knex, Lucid, Express, Next, and
AdonisJS names above are implemented contracts. `TenancyIntegration` remains the framework-neutral
planned vocabulary; do not introduce a competing name without updating the feature plan and an ADR
where applicable.

## Naming Conventions

- npm packages use `tenancyjs-<name>` with `adapter-*` and `integration-*` prefixes.
- Repository module folders use kebab-case; public TypeScript types use PascalCase.
- Adapter packages name the public data-layer surface: `adapter-prisma`, `adapter-sequelize`,
  `adapter-knex`, and `adapter-lucid`.
- Acceptance criteria use stable IDs (`AC-*`); implementation tasks use stable IDs (`T-*`).

## Rules

- Do not import a framework or ORM from `tenancyjs-core`.
- Do not publish an adapter or integration as stable unless its conformance suite and example E2E pass.
- Do not duplicate tenant-context storage in an adapter or integration; use `TenancyManager`.
- Do not execute ORM CLI commands through a shell; use an argument-array process runner.
- Do not patch project files without dry-run output, path validation, and conflict detection.
- Do not call a task complete unless `pnpm check` passes; list any environment-specific skipped lanes.

## Anti-Patterns

- A process-global `currentTenant`; use async-scoped `TenantContext`.
- Treating resolver failure as central mode; return an explicit resolution error or central-route result.
- Claiming Lucid support through Knex alone; use the Lucid adapter and Adonis lifecycle integration.
- Reimplementing migrations in TenancyJS; delegate through the selected data-layer driver.
- Building every compatibility combination before one secure vertical slice is production-ready.
