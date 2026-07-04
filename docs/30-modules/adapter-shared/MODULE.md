# Module: Adapter Shared

## Purpose

Provide one auditable home for isolation-critical adapter decisions and database-dialect strategy
engines, while keeping ORM packages thin and user-facing.

## Owns

- Dialect-neutral strategy-engine contracts.
- PostgreSQL RLS validation and transaction-local context SQL.
- PostgreSQL schema-per-tenant placement validation and `search_path` application.
- Shared SQL-identifier, qualified-table, and tenant-discriminator decisions.

## Does Not Own

- Tenant context storage, tenant resolution, ORM query APIs, adapter-specific errors/configuration,
  migration execution, provisioning, connection pools, or public framework integration.

## Public Interfaces

- `createPostgresStrategyEngine`, `validatePostgresRlsPolicies`, SQL identifier/table normalization,
  and tenant-discriminator decision helpers. These are consumed by TenancyJS adapters, not intended as
  the primary application API.

## Boundaries

- Depends only on `@tenancyjs/core`; it imports no ORM or framework.
- Knex, Lucid, and Prisma may consume shared pure decisions; only PostgreSQL-capable adapters bind the
  Postgres executor contract.
- All SQL values are parameterized. Identifiers are validated before being used as placement values.
- Schema context is always transaction-local and revalidated before protected execution.
- Accepted decisions: ADR-0017, ADR-0018, ADR-0019.
