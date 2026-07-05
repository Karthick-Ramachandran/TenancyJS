# Lessons

Durable, hard-won lessons for this repository, so agents and humans do not repeat the same mistakes.
Add a lesson when something broke in a non-obvious way, or when a tempting approach turned out to be
wrong. Keep each entry short: what happened, why, and what to do instead. Repository rules override
model preferences.

## Lessons

- Drizzle's SQL template expands a JavaScript array interpolation as a SQL tuple, not one PostgreSQL
  array parameter. Shared executor bindings such as `text[]` must use `sql.param(value)` explicitly or
  RLS/schema introspection fails before validation can report the real policy state.

- Lucid bulk/quiet/`.pojo()` paths skip model hooks and therefore do not inherit schema-mode
  `search_path`; keep tenant table names absent from the central schema so those paths fail closed.
- Standalone Lucid 22 database fixtures need an emitter with both `emit` and `hasListeners`; an
  emit-only stub fails before SQL and looks like adapter policy-introspection failure.
- Lucid query builders are deferred thenables; await callback results inside `AsyncLocalStorage.run`
  or a directly returned builder executes after the transaction scope has closed.
- Setting Vitest `test.exclude` replaces its default exclusions; always include `configDefaults.exclude`
  or linked workspace tests under `node_modules` run repeatedly and corrupt shared database fixtures.
- A mixed Node-engine workspace forced relaxed install validation and conditional test graphs; while
  pre-alpha, prefer one Node 24 floor across packages so strict engine checks remain meaningful.
- Next.js can retain a vulnerable transitive PostCSS release despite a current Next pin; keep the
  workspace override at the audited patched release and verify the production build after updates.
- Lucid 22 needs AdonisJS Core 7 and Luxon available even for a standalone adapter package; declare
  and test all three peers together or strict installs/imports fail before adapter tests begin.
- The installed `plan-module` skill references `docs/ai/MODULE_DELIVERY_WORKFLOW.md`, but this Persist
  template does not generate that file; use the skill's explicit output contract and Persist CLI
  scaffolds, and do not assume optional workflow memory exists.
- `persist adr accept` expects the ADR slug without the `ADR-####-` filename prefix; pass the slug
  printed after the number or the CLI will not find an in-place Proposed ADR.
- An imported empty ESM module is a module-namespace object, not a plain `{}`; export smoke tests
  should assert its enumerable keys rather than deep-equality with a plain object.
- A populated `node_modules` does not guarantee every tarball is available for `pnpm install --offline`;
  clean-copy verification should use `--frozen-lockfile`, normal registry access, and fail-fast shell
  behavior unless the store was explicitly prefetched.
- Package-consumer tests that invoke npm must use a fresh temporary cache and remove inherited
  `npm_config_*` values from pnpm; otherwise user-cache permissions and pnpm-only settings make the
  test environment-dependent.
- An npm `files: ["dist"]` whitelist can publish stale compiler metadata despite `.npmignore`; use
  positive artifact globs and make the pack gate reject source, tests, and `.tsbuildinfo` entries.
- New `workspace:*` package dependencies cannot be packed until `pnpm install` refreshes workspace
  links and lockfile importers; source aliases keep compilation deterministic but are not a substitute
  for the required install and package-consumer gate.
- Prisma 7 validates unique selectors at the top level of `WhereUniqueInput`; preserve caller unique
  fields and append tenant scope through a top-level `AND` instead of nesting the entire original
  `where`, or unique reads/writes fail before reaching the database.
- Real-database Vitest files run concurrently; give independent Prisma fixtures separate PostgreSQL
  schemas instead of resetting shared tables, or their `beforeEach` hooks corrupt each other's evidence.
- Killing a noisy child while its pipe is draining can stall test-process completion; truncate captured
  output, mark failure, and let the existing timeout own forced termination.
- A Web `ReadableStream` created inside `AsyncLocalStorage` can retain that creation context when its
  callbacks run later; end the supported Next tenant scope at handler promise settlement and prohibit
  tenant-scoped database work inside streamed body callbacks.
- The pack-check consumer installs only the tenancyjs tarballs with no peers, then imports each package;
  a framework integration must import every peer (`@adonisjs/*`, express, etc.) as `import type` so the
  compiled JS has no runtime peer import, or the bare-consumer smoke import fails. Adonis error classes
  therefore extend plain `Error` with a `status` field rather than importing Adonis's `Exception`.
- AdonisJS loads `config/*` before service providers boot, so the Lucid database service is not live
  when `config/tenancy.ts` is evaluated; constructing `createLucidTenancy(db)` there throws "requires a
  Lucid Database service". `defineAdonisTenancyConfig` therefore accepts the Lucid service as a
  factory `() => LucidTenancyAdapter`, resolved lazily (the provider triggers it at `ready()`). Only a
  real booted app surfaced this — unit tests with fakes could not.
- AdonisJS's `@flags`/`@args` (Ace) and `@column` (Lucid) are legacy/experimental decorators, but the
  repository's TypeScript config uses standard decorators (no `experimentalDecorators`). A native Ace
  command using `@flags.boolean() declare apply` fails to build (`TS1206: Decorators are not valid
  here`). The Lucid adapter already sidesteps this by not using `@column`; native Ace commands are
  therefore built with the operational CLI (one decorator/tsconfig decision for all of them), not
  standalone. `npx tenancy init` already covers AdonisJS scaffolding.
- The Adonis provider's fail-closed policy validation must run only in the `web` environment
  (`app.getEnvironment() === 'web'`). Validating in `console` would block the very `migration:run` that
  creates the schema/policies it checks; validating in `test` would fail before the suite provisions
  its schema. In tests, run migrations then call `tenancyConfig.tenancy.validate()` before serving —
  the adapter's `run()` refuses until `validate()` has passed, mirroring production startup order.
- A reference example must be a REAL app scaffolded from the framework's own tooling
  (`create-next-app`, the official AdonisJS starter kit) with the real ORM installed — not a
  hand-crafted minimal app. Building the real app catches integration bugs mocks miss: the AdonisJS
  config-loads-before-providers-boot factory bug, and the Next.js example's missing `app/actions.ts`,
  both surfaced only at real `next build` / app boot. A hand-crafted "example" is not compatibility
  evidence.
- Example apps that depend on the workspace via `workspace:*` exercise local source, not the packed
  tarball, so they cannot prove the "install from npm and it works" claim — a true consumer test only
  exists after the packages are published. This is why the runnable examples were moved OUT of this
  monorepo into a separate repository (see ADR-0015): they will install from the published npm
  packages. The monorepo keeps only `packages/*`, their tests, and an `examples/README.md` placeholder.
- The Prisma MySQL integration lane runs real-DB Vitest files concurrently with the PostgreSQL Prisma
  suites. They are schema-isolated, so contention is load/timing, not cross-test corruption. Watch CI;
  if a real-DB file flakes, cap real-DB file concurrency (`poolOptions`/`maxConcurrency`) rather than
  weakening the tests.
- Prisma schema-per-tenant cannot be done by pinning a connection's `search_path` per tenant. A
  `PrismaClient` built with `?options=-c search_path=<schema>` (or a `pg.Pool` `options`) does NOT route
  its queries to that schema — an adversarial two-schema test showed tenant A's client reading tenant B's
  rows, and the `pg.Pool` `options` form errors on connect. Prisma resolves table names from the
  datasource, not the session `search_path`, so runtime search_path pinning is silently ignored. This is
  why Prisma schema-per-tenant cannot reuse ADR-0018: a real implementation needs the tenant's schema in
  the **datasource/driver**, not a runtime session setting. Prisma 7's explicit PostgreSQL driver-adapter
  schema option now supplies that mechanism under ADR-0030. Do not re-attempt the `search_path` route.
- An `AsyncLocalStorage`-scoped per-tenant transaction/connection must be keyed on tenant identity, or a
  nested `run()` for a *different* tenant silently reuses the parent's transaction and leaks. The Lucid
  adapter re-read the fresh context but reused an existing ALS transaction with it, so a tenant-B `run()`
  nested inside tenant A ran `set_config('search_path', schemaB, local)` on A's transaction (A's later
  queries then hit schema B), or ran B's model writes on A's leased connection. Fix: store the tenant
  scope key alongside the ALS transaction and fail closed when a nested scope's key differs (same-tenant
  nesting stays a savepoint; cross-tenant and central-in-tenant are rejected). Knex is immune because it
  captures `context` once at scope entry and only re-applies it inside its own savepoints.
- A workspace package that exposes peer-library types must pin the peer's optional driver in its own
  dev dependencies. Otherwise pnpm can instantiate the same ORM version under two driver peer graphs
  (for example TypeORM with `pg@8.16` and `pg@8.22`), making nominal class types incompatible in a
  cross-package consumer even though runtime behavior works. Align the package test peer graph and keep
  a cross-package typecheck/E2E to catch it.
- Lucid's database-per-tenant strategy is dialect-agnostic — it isolates purely by routing each tenant
  scope to its own leased connection (no forced RLS, no `search_path`), so it works on MySQL as well as
  PostgreSQL (row-level and schema-per-tenant remain Postgres-only). Gotcha found while adding the MySQL
  test: Lucid's `MysqlConfig` type does NOT accept a `connection` URL string the way `PostgreConfig`
  does — pass an object (`{ host, port, user, password, database }`). Runtime tolerates the string
  (knex/mysql2 parse it), so the mismatch only surfaces at `tsc`, not at test runtime.
- ADR-0033 tier-aware query freedom: the enforcement tier must be derived from the *actual connection
  that was leased*, never from the strategy string. The Knex `unrestricted()` accessor first gated on
  `strategy === "databasePerTenant"` — but a database-per-tenant config in **central mode** falls through
  to the shared admin connection (`config.knex`) and never leases a per-tenant database, so the raw handle
  would have run on the shared connection. Fix: thread an explicit `databaseEnforced` boolean that `run()`
  sets `true` ONLY on the leased-connection path (`databasePerTenant && mode === "tenant"`); the gate keys
  off that, not the strategy. Every capability/freedom flip is per-scope, not per-config. An adversarial
  review caught this before ship; the central-mode gate test now locks it.
