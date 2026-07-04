# Architecture Impact: Isolation Strategies

## Affected Modules

- `@tenancyjs/core`: `TenancyStrategy` union, `TenancyAdapterCapabilities`, `defineConfig` validation.
- `@tenancyjs/adapter-shared`: new package owning shared isolation decisions and dialect engines.
- `@tenancyjs/adapter-knex`, `@tenancyjs/adapter-lucid`: thin PostgreSQL schema strategy bindings.
- `@tenancyjs/adapter-prisma`: consumes shared identifier/discriminator decisions but retains its own
  query-rewrite boundary; Prisma schema-per-tenant remains deferred.
- Later: the CLI (`provision`/`deprovision`, migrate routing) and the host `TenantStore` contract (returns
  identity + placement).

## ADR Impact

- ADR-0017 defines the strategy/routing model; ADR-0018 defines schema enforcement tiers; ADR-0019
  establishes the shared engine package and hook-bypass boundary; ADR-0020 validates the effective
  default search path against tenant-table shadowing.

## Security Impact

- Schema-per-tenant adds per-transaction catalog validation and local `search_path`; it adds no network,
  telemetry, secret handling, filesystem writes, DDL, or automatic provisioning.
- Adapter-enforced schema mode is explicitly weaker than forced RLS and a future per-tenant-role mode.
  It depends on the protected surface rejecting qualification/raw access and on Lucid central-table
  shadow checks. Row-level's forced-RLS guarantee remains unchanged.
