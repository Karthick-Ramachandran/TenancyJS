# Acceptance Criteria: Isolation Strategies

## Implemented Criteria

- `TenancyStrategy` includes `rowLevel`, `schemaPerTenant`, and `databasePerTenant`.
- `defineConfig` accepts all three strategies and still throws `TypeError` on an unknown strategy at the
  runtime boundary.
- `TenancyAdapterCapabilities` includes `schemaPerTenant`; Knex/Lucid declare it `supported` only after
  separate real-PostgreSQL two-schema adversarial tests pass. Prisma remains `unsupported`.
- `@tenancyjs/adapter-shared` owns the single PostgreSQL RLS/context/schema engine implementation and
  shared identifier/discriminator decisions; ORM packages provide thin bindings.
- Knex/Lucid reject missing/invalid/central-colliding schema placement, qualified tenant tables, and
  unsupported raw/cross-placement paths.
- Lucid hook-skipping paths fail closed because tenant table names are prohibited in the central and
  effective default-search-path schemas.
- Existing row-level isolation and adversarial suites remain green; the full gate retains its coverage
  and package-consumer requirements.

## Later-increment Criteria (tracked as each lands)

- Database-per-tenant: a two-tenant adversarial test proves cross-database isolation on Knex, Lucid, and
  Prisma; per-tenant connections are cached and closed correctly.
- Provisioning creates and migrates a tenant's schema/database and deprovisioning removes it.

## Out Of Scope

- Prisma schema-per-tenant (deferred, ADR-0017).
- Behavior for the new strategies in this foundation slice.
