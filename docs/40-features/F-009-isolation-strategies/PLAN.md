# Plan: Isolation Strategies

## Approach

Deliver in increments; each is independently tested and gate-green.

1. **Foundation (this slice):** add `schemaPerTenant` to `TenancyStrategy` and the adapter capability
   matrix; validate all three strategies in `defineConfig`; update every adapter's capability declaration
   to `schemaPerTenant: "unsupported"`. Record ADR-0017. No behavior change.
2. **Routing/placement contract:** define `TenantPlacement` (schema name | connection reference) resolved
   by the host `TenantStore`; thread it into the adapter execution path. Designed with its first consumer.
3. **Database-per-tenant** (Prisma-friendly, first behavior): per-tenant connection/client cache on
   Knex/Lucid/Prisma + provisioning + adversarial cross-database isolation tests.
4. **Schema-per-tenant** on Knex/Lucid via `search_path` + provisioning + adversarial tests. Prisma
   deferred.
5. **Prisma schema-per-tenant** (deferred): per-schema client cache.

## Boundaries

- Foundation makes no behavior change; adapters still support only `rowLevel` at runtime.
- Fail closed: an adapter must reject any strategy it does not declare `"supported"`.
- Reuse the existing forced-RLS/query-scoping row-level machinery; do not regress it.
- Each new strategy needs real two-tenant adversarial evidence before its capability flips to
  `"supported"`.
- Do not contradict accepted ADRs; new decisions get new ADRs.
