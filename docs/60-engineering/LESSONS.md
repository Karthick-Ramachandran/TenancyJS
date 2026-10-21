# Lessons

Durable, hard-won lessons for this repository. Keep each entry short: what failed and what to do.

## Database adapters

Applies To:
- `packages/**`

- Drizzle array interpolation becomes a SQL tuple; bind shared PostgreSQL `text[]` values with `sql.param(value)`.
- Lucid bulk, quiet, and `.pojo()` paths skip model hooks and schema `search_path`; keep tenant tables out of the central schema.
- Standalone Lucid 22 fixtures need an emitter with both `emit` and `hasListeners`.
- Lucid query builders are deferred thenables; await callback results inside `AsyncLocalStorage.run` so queries stay in scope.
- Prisma 7 unique selectors must remain top-level; preserve unique fields and add tenant scope with a top-level `AND`.
- Prisma schema-per-tenant needs the schema in its driver adapter/datasource; runtime `search_path` does not route table names.
- Key ALS transactions by tenant identity; reject nested cross-tenant reuse, while same-tenant nesting may use a savepoint.
- Lucid database-per-tenant routes by connection and works across dialects; MySQL `MysqlConfig` needs an object, not a URL.
- Derive query freedom from the connection actually leased; database-per-tenant central mode may use the shared admin connection.
- Lucid model hooks do not cover bulk query-builder writes; use instance methods or an explicit unrestricted scope.
- Drizzle reports public tables with `schema: undefined`; default qualified names to `public` for RLS introspection.

## Framework runtime

Applies To:
- `packages/integration-*/**`

- A Web `ReadableStream` can retain creation-time ALS context; end Next.js tenant scope when the handler promise settles; do no tenant database work in streamed callbacks.
- Adonis config loads before providers boot; resolve Lucid through a lazy factory and construct it when the provider is ready.
- Adonis Ace's legacy decorators conflict with standard TypeScript decorators; build native Ace commands with the operational CLI.
- Validate Adonis tenancy only in `web`; tests should migrate first, then call `validate()` before serving.
- In Ace commands and scripts, call `await tenancy.validate()` before the first `tenancy.run()`.
- NestJS scaffolds CommonJS while TenancyJS is ESM; configure ESM/Nodenext and use `.js` imports with ESM-capable tests.

## Tests and CI

Applies To:
- `packages/**`

- Vitest `test.exclude` replaces defaults; include `configDefaults.exclude` or linked workspace tests run repeatedly.
- Real-database Vitest files run concurrently; give independent Prisma fixtures separate PostgreSQL schemas.
- Terminate noisy children through the existing timeout; truncating captured output avoids pipe-drain stalls.
- Prisma MySQL and PostgreSQL suites are schema-isolated; for load-related flakes, cap file concurrency instead of weakening tests.

## Workspace and packaging

Applies To:
- `package.json`

- Use one Node 24 engine floor across packages so strict engine checks remain meaningful.
- Keep the workspace PostCSS override at the audited patched version and run a production build after Next.js upgrades.
- Lucid 22 standalone packages need AdonisJS Core 7 and Luxon together in dev dependencies.
- An imported empty ESM module is a namespace object, not `{}`; smoke tests should assert its enumerable keys.
- Offline pnpm installs can lack tarballs despite populated `node_modules`; use registry access for clean frozen-lockfile checks.
- npm consumer tests need a fresh temporary cache and cleared inherited `npm_config_*` values.
- A `files: ["dist"]` whitelist can pack stale metadata; use positive globs and reject source, tests, and `.tsbuildinfo`.
- Refresh workspace links and lockfile importers with `pnpm install` before packing new `workspace:*` dependencies.
- Packed consumers install tenancy tarballs without peers; import framework peers as types so compiled JS has no runtime peer imports.
- Peer-library types need the optional driver in package dev dependencies; align the peer graph and typecheck cross-package use.

## Product documentation and adoption

Applies To:
- `docs/**`

- The old `plan-module` skill references a workflow file Persist does not generate; follow its output contract and CLI scaffolds.
- `persist adr accept` expects the ADR slug without its `ADR-####-` filename prefix.
- Build reference apps with official framework scaffolds and real ORMs; hand-built mocks miss integration defects.
- Workspace-linked examples exercise source, not packed tarballs; only clean package consumers verify npm installation.
- From-npm consumer builds exposed docs and UX defects missed by source tests; validate representative published combinations.
