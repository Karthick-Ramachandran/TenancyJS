# Module: Adapter Shared

## Purpose

Provide one auditable home for isolation-critical adapter decisions and database-dialect strategy
engines, while keeping ORM packages thin and user-facing.

## Owns

- Dialect-neutral strategy-engine contracts.
- PostgreSQL RLS validation and transaction-local context SQL.
- PostgreSQL schema-per-tenant placement validation and `search_path` application.
- Lifetime one-to-one tenant/schema placement enforcement and optional transaction-local tenant roles.
- Shared SQL-identifier, qualified-table, and tenant-discriminator decisions.
- Bounded ORM-neutral tenant resource cache for database-per-tenant client/pool lifecycle.
- Shared honest validation result for lazily resolved tenant databases.

## Does Not Own

- Tenant context storage, tenant resolution, ORM query APIs, adapter-specific errors/configuration,
  migration execution, provisioning, connection pools, or public framework integration.

## Public Interfaces

- `createPostgresStrategyEngine`, `validatePostgresRlsPolicies`, SQL identifier/table normalization,
  tenant-discriminator decision helpers, `createTenantResourceCache`, and
  `deferredDatabaseValidationResult`. These are consumed by TenancyJS adapters, not intended as the
  primary application API.

## Boundaries

- Depends only on `@tenancyjs/core`; it imports no ORM or framework.
- Knex, Lucid, and Prisma may consume shared pure decisions; only PostgreSQL-capable adapters bind the
  Postgres executor contract.
- All SQL values are parameterized. Identifiers are validated before being used as placement values.
- Schema context is always transaction-local and revalidated before protected execution.
- Schema placement claims are retained for the engine lifetime; collisions fail before application
  callbacks execute.
- Accepted decisions: ADR-0017, ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0022.
