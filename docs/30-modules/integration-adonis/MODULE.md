# Module: Integration Adonis

## Purpose

Bridge AdonisJS tenant HTTP/test/console lifecycles into the canonical manager and Lucid tenancy
service using framework-native provider, middleware, Japa, and Ace conventions.

## Owns

- Typed config, IoC bindings/provider, HTTP request adaptation/middleware, sanitized failure mapping,
  Japa tenant helpers, thin Ace wrappers, setup hooks/templates, and compatibility evidence.

## Does Not Own

- Tenant registry/storage, authentication/Bouncer policy, Lucid query enforcement, Knex behavior,
  migration/seed/tenant iteration logic, cache/storage/queue tenancy, or database-per-tenant switching.

## Public Interfaces

- Proposed `defineAdonisTenancyConfig`, provider/binding tokens, `TenancyMiddleware`, Adonis resolver
  input adapter, Japa `withTenant`, and Ace factories accepting an injected shared-CLI service port.

## Boundaries

- Depends inward on core/identifiers/Lucid adapter and peers on AdonisJS/Lucid; imports no CLI, base
  Knex client, or application models. ADR-0012 controls lifecycle and compatibility.
- Initial target is AdonisJS 7.3/Lucid 22.4/PostgreSQL 17 on Node 24; AdonisJS 6 is not claimed.
- Linked delivery: `docs/40-features/F-007-knex-lucid-adonis/`.
