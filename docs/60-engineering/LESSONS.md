# Lessons

Durable, hard-won lessons for this repository, so agents and humans do not repeat the same mistakes.
Add a lesson when something broke in a non-obvious way, or when a tempting approach turned out to be
wrong. Keep each entry short: what happened, why, and what to do instead. Repository rules override
model preferences.

## Lessons

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
- The Adonis provider's fail-closed policy validation must run only in the `web` environment
  (`app.getEnvironment() === 'web'`). Validating in `console` would block the very `migration:run` that
  creates the schema/policies it checks; validating in `test` would fail before the suite provisions
  its schema. In tests, run migrations then call `tenancyConfig.tenancy.validate()` before serving —
  the adapter's `run()` refuses until `validate()` has passed, mirroring production startup order.
