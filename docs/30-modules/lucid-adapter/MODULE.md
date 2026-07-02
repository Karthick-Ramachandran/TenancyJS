# Module: Lucid Adapter

## Purpose

Provide a first-class Lucid model and transaction contract rather than presenting generic Knex as
AdonisJS support.

## Owns

- Lucid tenancy transaction service, `TenantScopedModel` lifecycle behavior, transaction attachment,
  model/table metadata, hook-skipping path behavior, typed errors, and a Lucid-specific matrix.

## Does Not Own

- Adonis IoC/HTTP/Ace/Japa behavior, tenant resolution, schema migrations, base database service,
  authentication/authorization, or database-per-tenant connection switching.

## Public Interfaces

- Implemented `createLucidTenancy`, `LucidTenancyAdapter`, explicit tenant-model config, capability
  metadata, forced-policy validation, managed callback execution, and sanitized errors. Model hooks
  are registered from configuration; no competing model base class is required.

## Boundaries

- Distinct public package under ADR-0001; may reuse reviewed Knex enforcement primitives internally.
- Lucid hooks provide native behavior while forced PostgreSQL RLS covers `.pojo()`, quiet, bulk,
  relationship, and direct query paths. ADR-0010 controls the guarantee.
- The package requires Node 24 and peers on AdonisJS 7.3, Lucid 22.4, Luxon 3.7, and PostgreSQL driver
  8.20. Framework/provider lifecycle remains owned by `integration-adonis` under ADR-0012.
- Linked delivery: `docs/40-features/F-007-knex-lucid-adonis/`.
