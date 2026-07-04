# Module: Knex Adapter

## Purpose

Provide a fail-closed, native-fluent Knex row-level boundary for shared PostgreSQL databases.

## Owns

- Table classification, protected builders, discriminator enforcement, managed transaction/RLS
  context, policy validation, typed failures, capability metadata, and the Knex operation matrix.

## Does Not Own

- Tenant resolution, authentication/authorization, Lucid models, framework middleware, migrations,
  schema mutation, operational commands, base-client protection, or database-per-tenant pooling.

## Public Interfaces

- Proposed `createKnexTenancy`, `KnexTenancy`, protected client/builder types, config/table metadata,
  RLS validation results, capability constants, and sanitized errors.

## Boundaries

- Depends on core and peers on Knex 3.3. Initial compatibility is PostgreSQL 17 only.
- The protected callback client is the security boundary. Raw/schema/migration/connection/client and
  unproven fluent composition are unavailable or rejected. ADR-0010 controls expansion.
- Linked delivery: `docs/40-features/F-007-knex-lucid-adonis/`.
