# Plan: Cli Operational

## Approach

Six phases, each landed gate-green on its own PR:

1. **Runtime contract + config loader.** `defineTenancyRuntime()` in core; a CLI config-loader that
   resolves + imports `tenancy.config.ts` via Node 24 type-stripping and validates the runtime shape.
   `TenantStore<TTenant>` interface + the hardened wrappers (`assertStoreTenant`) that enforce id-match
   and uniqueness. `doctor` gains a runtime-load + store round-trip check.
2. **Registry read commands.** `tenant list` and `tenant show` through the store, human + `--json`,
   redacted, with "not supported by your store" degradation.
3. **Registry write commands.** `tenant create | suspend | activate`, echoing the persisted id through
   the hardened contract.
4. **`run <script>`.** Load runtime, resolve tenant/central scope, execute host script inside it, exit
   codes, disposal.
5. **`migrate` / `migrate:central` + `provision` / `deprovision`.** Delegate to native ORM tooling with
   per-tenant placement from the store record; spawned as argument arrays; schema/db-per-tenant only.
6. **Polish.** Unified help, error taxonomy, `--json` everywhere, disposal audit, docs.

## Boundaries

- Setup/diagnostic commands (`init`, `doctor` static parts, `test:leak`) stay runtime-free and safe on
  a project that cannot connect.
- The CLI reads only the `defineTenancyRuntime` contract — never framework internals.
- No new runtime dependency (Node 24 native TS import); native migration and provisioning tools are
  delegated, not reimplemented, including Prisma schema placements.
