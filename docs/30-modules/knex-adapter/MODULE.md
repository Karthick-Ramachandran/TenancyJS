# Module: Knex Adapter

## Purpose

Provide fail-closed, native-fluent Knex row-level and schema-per-tenant boundaries for PostgreSQL.

## Owns

- Table classification, protected builders, discriminator enforcement, managed transaction binding,
  typed failures, capability metadata, and the Knex operation matrix.

## Does Not Own

- Tenant resolution, authentication/authorization, Lucid models, framework middleware, migrations,
  schema mutation, operational commands, base-client protection, or database-per-tenant pooling.

## Public Interfaces

- Implemented `createKnexTenancy`, `KnexTenancy`, protected client/builder types, config/table metadata,
  isolation validation results, capability constants, and sanitized errors.

## Boundaries

- Depends on core and adapter-shared and peers on Knex 3.3. Compatibility is PostgreSQL 17 only.
- The protected callback client is the security boundary. Raw/schema/migration/connection/client and
  unproven fluent composition are unavailable or rejected. ADR-0010 controls expansion.
- Linked delivery: `docs/40-features/F-007-knex-lucid-adonis/`.
- F-009/ADR-0019 add adapter-enforced schema-per-tenant through the shared PostgreSQL engine; the base
  client, provisioning, and database-enforced per-tenant roles remain outside this module.
