# Review: Isolation Strategies

## Status

Architecture, conventions, and security reviews passed locally. T1–T7 and the isolation-review
hardening are implemented; provisioning remains deferred.

## Findings

- Architecture: no conflict with ADR-0017/0018. ADR-0019 records the new package boundary and central
  shadow rule. Core remains database-neutral and ORM packages remain user-facing.
- Security: duplicated RLS/context SQL is removed from Knex/Lucid; all SQL values are parameterized;
  schema names are validated; resolver/catalog failures fail closed with sanitized adapter errors.
- Isolation tier: shared-role schema mode is adapter-enforced; the optional per-tenant-role mode is
  database-enforced. Base/raw shared-role clients remain outside the default guarantee.
- Lucid: bulk/quiet/`.pojo()` paths do not inherit the managed transaction. Central tenant-table
  shadowing is rejected so these unqualified paths fail closed; real PostgreSQL evidence confirms it.
- Testing: local PostgreSQL 17 focused evidence passes 11/11 across Knex schema and Lucid row/schema
  suites. The no-database workspace run passes 308 tests with 44 environment-skipped tests and all
  coverage floors.
- Follow-up consolidations landed: shared adapter errors, integration HTTP mapping, CLI capability
  derivation, all three database-per-tenant bindings, and the optional database-enforced schema role.
  Provisioning and typed enforcement-tier metadata remain deferred.
- Final local gate: PostgreSQL 17 `pnpm check` passes 343 tests with 14 MySQL-only skips, all coverage
  floors, 11 packed-package consumer checks, and Persist Doctor. Dependency audit reports no known
  vulnerabilities.
- Database-per-tenant cache review: ADR-0021/0022 produce one bounded, single-flight,
  collision-aware, lease-safe lifecycle with sanitized failures. Knex, Lucid, and Prisma capabilities
  are supported after real separate-database evidence.
- Post-merge isolation review: the Lucid nested cross-tenant transaction reuse bug was fixed in PR #25.
  Remaining findings were closed with same-connection role/search-path reversion evidence, a lifetime
  tenant/schema collision guard, colliding-ID write assertions for all database routers, a public
  Prisma-router collision test, honest lazy-validation warnings, and callback-lifetime documentation.
