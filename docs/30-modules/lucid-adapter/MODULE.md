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

- Proposed `createLucidTenancy`, `LucidTenancy`, `TenantScopedModel` mixin/base factory, Lucid model
  config/capabilities, and sanitized errors.

## Boundaries

- Distinct public package under ADR-0001; may reuse reviewed Knex enforcement primitives internally.
- Lucid hooks provide native behavior while forced PostgreSQL RLS covers `.pojo()`, quiet, bulk,
  relationship, and direct query paths. ADR-0010 controls the guarantee.
- Linked delivery: `docs/40-features/F-007-knex-lucid-adonis/`.
