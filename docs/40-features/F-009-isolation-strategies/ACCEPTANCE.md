# Acceptance Criteria: Isolation Strategies

## Implemented Criteria

- `TenancyStrategy` includes `rowLevel`, `schemaPerTenant`, and `databasePerTenant`.
- `defineConfig` accepts all three strategies and still throws `TypeError` on an unknown strategy at the
  runtime boundary.
- `TenancyAdapterCapabilities` includes `schemaPerTenant`; Knex/Lucid declare it `supported` only after
  separate real-PostgreSQL two-schema adversarial tests pass. Prisma uses ADR-0030 schema-bound clients.
- `tenancyjs-adapter-shared` owns the single PostgreSQL RLS/context/schema engine implementation and
  shared identifier/discriminator decisions; ORM packages provide thin bindings.
- Knex/Lucid reject missing/invalid/central-colliding schema placement, qualified tenant tables, and
  unsupported raw/cross-placement paths.
- Lucid hook-skipping paths fail closed because tenant table names are prohibited in the central and
  effective default-search-path schemas.
- Existing row-level isolation and adversarial suites remain green; the full gate retains its coverage
  and package-consumer requirements.

## Implemented Later-Increment Criteria

- Database-per-tenant: two-tenant adversarial tests prove cross-database isolation across the supported
  SQL adapters and Mongoose; per-tenant resources are cached and closed correctly.
- Provisioning resolves the tenant placement and delegates create/migrate/drop behavior to explicit
  host hooks; destructive deprovision never supports `--all`.

## Out Of Scope

- Built-in database credentials, DDL, and ORM migration implementations; hosts provide those through
  the accepted provisioner contract.
