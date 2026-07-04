# ADR-0019: Adapter Shared Postgres Strategy Engine

## Status

Accepted

## Context

Knex and Lucid independently implement the same PostgreSQL RLS catalog queries, privileged-role
checks, transaction-local tenant settings, SQL-identifier validation, and tenant-discriminator
rules. These are isolation controls rather than ORM-specific behavior. Keeping byte-near copies in
public adapters creates multiple audit surfaces and makes ADR-0018's `search_path` strategy likely to
drift between adapters.

F-009 already selects a dialect-organized strategy engine with thin ORM bindings. The remaining
decision is its package boundary and the fail-closed behavior needed for Lucid operations that bypass
model hooks.

## Decision

1. Add `@tenancyjs/adapter-shared` as a separately versioned but application-internal package. It owns
   dialect-neutral strategy contracts and PostgreSQL isolation primitives; public ORM packages remain
   the user-facing APIs.
2. Move PostgreSQL RLS validation, transaction-context application, SQL-identifier/table-name
   normalization, and the tenant-discriminator decision into this package. Adapter-specific errors
   and public configuration types remain in their adapters.
3. Implement schema-per-tenant through one PostgreSQL strategy engine. It resolves a validated schema
   from the active tenant, verifies schema existence and runtime-role access inside the managed
   transaction, then applies transaction-local `search_path` with `set_config(..., true)`.
4. Knex and Lucid provide thin executor bindings (`raw` versus `rawQuery`) and retain ownership of
   protected query/model behavior. They do not duplicate isolation SQL.
5. Schema-per-tenant uses unqualified tenant table names and applies no tenant discriminator. Qualified
   tenant-table configuration, raw SQL, and a tenant schema equal to the central schema are rejected.
6. Lucid hook-skipping operations do not receive the managed transaction. Validation therefore
   requires tenant-table names to be absent from the configured central schema. An unscoped `.pojo()`,
   quiet, or direct unqualified operation fails with a missing relation instead of reading a central
   table. Qualified/base-database access remains outside the adapter guarantee.
7. Knex/Lucid `schemaPerTenant` capabilities change to `supported` only after unit tests and separate
   real-PostgreSQL two-schema adversarial suites pass. Provisioning and per-tenant roles remain later
   F-009 tasks.

## Alternatives Considered

- Keep helpers private in each adapter: rejected because security fixes and new strategies would have
  to land repeatedly.
- Put PostgreSQL behavior in core: rejected because core is framework-, ORM-, and database-neutral.
- Share source files without a package: rejected because it creates an undeclared cross-package
  boundary and breaks package-consumer resolution.
- Claim Lucid schema isolation only for hook-running methods: rejected because an unqualified
  hook-skipping query could otherwise resolve a same-named central table.
- Require per-tenant database roles immediately: rejected by ADR-0018; database-enforced mode remains
  opt-in and is delivered separately.

## Consequences

There is one audited copy of PostgreSQL isolation SQL and one insertion point for future dialect
strategies. Knex and Lucid share identical placement validation while retaining native public APIs.
Prisma can reuse identifier and discriminator decisions without pretending it supports PostgreSQL
`search_path`.

The new package becomes a release dependency of each consuming adapter and must pass package-consumer
checks. Runtime schema validation adds catalog queries at the start of every protected transaction;
correctness is preferred over an unsafe cache in this first implementation. Adapter-enforced schema
isolation still cannot constrain a retained raw/base client, and this limit remains explicit.

## Related Documents

- PRD: `docs/40-features/F-009-isolation-strategies/PRD.md`
- Architecture: `docs/40-features/F-009-isolation-strategies/ARCHITECTURE_IMPACT.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-009-isolation-strategies/`
- Related decisions: ADR-0010, ADR-0017, ADR-0018
