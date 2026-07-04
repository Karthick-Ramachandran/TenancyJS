# Architecture Impact: Isolation Strategies

## Affected Modules

- `@tenancyjs/core`: `TenancyStrategy` union, `TenancyAdapterCapabilities`, `defineConfig` validation.
- `@tenancyjs/adapter-knex`, `@tenancyjs/adapter-lucid`, `@tenancyjs/adapter-prisma`: capability
  declarations now (foundation); routing/connection/schema management in later increments.
- Later: the CLI (`provision`/`deprovision`, migrate routing) and the host `TenantStore` contract (returns
  identity + placement).

## ADR Impact

- New: **ADR-0017** (tenant isolation strategy model and routing contract) — accepted with this slice.
- Later increments reference ADR-0017; database-per-tenant and schema-per-tenant behavior may add
  focused ADRs (connection pooling, provisioning) as needed.

## Security Impact

- Foundation: no behavior change, no new dependency, no network/DB/secrets/file writes.
- Later: schema-per-tenant and database-per-tenant introduce per-tenant `search_path`/connection routing
  and provisioning (DDL) — each must ship with two-tenant adversarial isolation evidence and fail-closed
  behavior (an adapter rejects any strategy it does not declare `"supported"`). Row-level's forced-RLS
  guarantee must not regress.
