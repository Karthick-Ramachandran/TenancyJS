# Acceptance Criteria: Knex, Lucid, And AdonisJS Vertical Slice

## Criteria

- AC-KNEX-01: The protected Knex client scopes supported select/first/count/aggregate/create/update/
  delete operations to the active tenant, validates or injects the discriminator, and preserves
  caller filters inside managed transactions.
- AC-KNEX-02: Missing context, unclassified tables, discriminator mutation, raw/schema/migration
  access, unsafe builder composition, and access to the base client fail before tenant SQL executes.
- AC-KNEX-03: PostgreSQL RLS uses parameterized transaction-local context, `USING` plus `WITH CHECK`,
  forced policies for the application role, startup policy verification, rollback cleanup, and no
  tenant/database values in adapter errors.
- AC-KNEX-04: The shared adapter contract and real PostgreSQL tests prove two-tenant CRUD, bulk,
  aggregate, transaction, central-model, explicit-central, concurrency, rollback, and bypass cases.
- AC-LUCID-01: `tenancyjs-adapter-lucid` remains a distinct public package and provides a
  `TenantScopedModel` lifecycle contract for reads, pagination, create/update/delete, relationships,
  transaction binding, and discriminator immutability.
- AC-LUCID-02: Quiet operations, `.pojo()`, bulk query mutations, direct database builders, raw SQL,
  and relationship queries cannot bypass PostgreSQL RLS; unsupported public escape paths are rejected
  or fail closed and are listed explicitly.
- AC-ADONIS-01: The provider registers one application-owned manager and Lucid tenancy service; the
  middleware resolves once, enters tenant and database scope around `await next()`, maps failures
  safely, and always commits/rolls back/releases resources.
- AC-ADONIS-02: Config, Japa helpers, and Ace wrappers feel native to Adonis. Ace wrappers delegate to
  `tenancyjs-cli` services and do not duplicate migration, seed, or tenant-iteration logic.
- AC-ADONIS-03: Safe CLI init previews and applies conflict-aware Adonis/Lucid provider, middleware,
  config, model/migration, and test changes without reading `.env` or overwriting project files.
- AC-COMPAT-KLA-01: Knex 3.3/PostgreSQL 17 and AdonisJS 7.3/Lucid 22.4 production/Japa examples pass
  on the common Node 24 baseline, including concurrent tenants and clean installed-package consumers.

## Out Of Scope

- AdonisJS 6, non-PostgreSQL providers, database-per-tenant switching, operational migrate/seed/list
  commands, Bouncer/Auth/Inertia recipes, and unrestricted raw or schema access.
