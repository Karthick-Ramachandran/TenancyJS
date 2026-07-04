# Review: Isolation Strategies

## Status

Architecture, conventions, and security reviews passed locally; hosted CI evidence remains pending.

## Findings

- Architecture: no conflict with ADR-0017/0018. ADR-0019 records the new package boundary and central
  shadow rule. Core remains database-neutral and ORM packages remain user-facing.
- Security: duplicated RLS/context SQL is removed from Knex/Lucid; all SQL values are parameterized;
  schema names are validated; resolver/catalog failures fail closed with sanitized adapter errors.
- Isolation tier: current schema mode is adapter-enforced, not database-enforced. Base/raw shared-role
  clients remain outside the guarantee and per-tenant roles remain T4.
- Lucid: bulk/quiet/`.pojo()` paths do not inherit the managed transaction. Central tenant-table
  shadowing is rejected so these unqualified paths fail closed; real PostgreSQL evidence confirms it.
- Testing: local PostgreSQL 17 focused evidence passes 11/11 across Knex schema and Lucid row/schema
  suites. The no-database workspace run passes 308 tests with 44 environment-skipped tests and all
  coverage floors.
- Deferred non-blockers: shared adapter error factory, integration HTTP mapping, typed enforcement-tier
  capability metadata, CLI capability derivation, provisioning, and database-per-tenant.
- Final local gate: PostgreSQL 17 `pnpm check` passes 343 tests with 14 MySQL-only skips, all coverage
  floors, 11 packed-package consumer checks, and Persist Doctor. Dependency audit reports no known
  vulnerabilities.
