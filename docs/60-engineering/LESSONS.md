# Lessons

Durable, hard-won lessons for this repository, so agents and humans do not repeat the same mistakes.
Add a lesson when something broke in a non-obvious way, or when a tempting approach turned out to be
wrong. Keep each entry short: what happened, why, and what to do instead. Repository rules override
model preferences.

## Lessons

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
