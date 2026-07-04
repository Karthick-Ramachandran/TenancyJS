# Acceptance Criteria: Isolation Strategies

## Criteria (foundation slice)

- `TenancyStrategy` includes `rowLevel`, `schemaPerTenant`, and `databasePerTenant`.
- `defineConfig` accepts all three strategies and still throws `TypeError` on an unknown strategy at the
  runtime boundary.
- `TenancyAdapterCapabilities` includes `schemaPerTenant`; every adapter declares a status for it, and all
  three currently declare `schemaPerTenant: "unsupported"` and `databasePerTenant: "unsupported"`.
- No behavior change: row-level isolation and all existing adversarial tests still pass; the full gate is
  green (typecheck, coverage thresholds, `persist doctor`).

## Later-increment Criteria (tracked as each lands)

- Schema-per-tenant: a two-tenant adversarial test proves one tenant cannot read/write another tenant's
  schema on Knex and Lucid; the adapter refuses the strategy unless it declares it `supported`.
- Database-per-tenant: a two-tenant adversarial test proves cross-database isolation on Knex, Lucid, and
  Prisma; per-tenant connections are cached and closed correctly.
- Provisioning creates and migrates a tenant's schema/database and deprovisioning removes it.

## Out Of Scope

- Prisma schema-per-tenant (deferred, ADR-0017).
- Behavior for the new strategies in this foundation slice.
