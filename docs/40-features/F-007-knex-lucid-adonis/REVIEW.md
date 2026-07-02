# Review: Knex, Lucid, And AdonisJS Vertical Slice

## Status

Planning accepted; Knex implementation and hosted evidence are complete; Lucid is in progress.

## Findings

- Knex QueryBuilder extension is experimental and does not provide a stable universal late rewrite
  hook; a broad transparent scoping claim is unsafe.
- Lucid hooks intentionally have bypass paths, including quiet persistence and bulk/direct builder
  operations; model hooks alone are insufficient as an isolation guarantee.
- The proposal combines a narrow protected builder/model surface with forced PostgreSQL RLS and
  transaction-local context. Unsupported composition and retained base clients remain outside the
  guarantee and are rejected or validation failures.
- AdonisJS 7.3/Lucid 22.4 require Node 24 and are the required initial integration target. ADR-0013
  makes Node 24 the common floor across the pre-alpha repository to remove mixed-engine CI complexity.
- Architecture-drift review found and removed a proposed integration-to-CLI dependency. Ace factories
  now use an injected structural port, preserving ADR-0001 direction and ADR-0003 service ownership.
- Security review requires a separate migration role; the runtime role cannot be a table owner or hold
  DDL, superuser, or `BYPASSRLS` privileges on protected tables.
- No accepted ADR is contradicted. PostgreSQL-only initial support, RLS storage behavior, dependency
  additions, and AdonisJS 7 lifecycle were accepted in ADR-0010 and ADR-0013.
- Knex implementation review passes: PostgreSQL 17 isolation, forced-policy validation, concurrency,
  CRUD/aggregate, rollback/savepoints, explicit central behavior, pooled cleanup, package consumers,
  and the full gate pass on Node 22 and 24 in PR #8.
- Lucid implementation architecture review passes locally: the package depends inward on core, keeps
  Adonis lifecycle outside the adapter, uses the canonical manager, and matches ADR-0010/ADR-0013.
- Conventions review passes: `createLucidTenancy` is the documented canonical primitive; no second
  context store, migration system, or competing query language was introduced.
- Security review found no blocker. Transaction settings are parameterized and local, policy
  introspection fails closed, errors omit SQL/bindings/tenant values, hook-skipping paths rely on
  forced RLS, and retained Lucid/raw/privileged surfaces remain explicitly outside the guarantee.
- Remaining gate: the four Lucid 22/PostgreSQL 17 tests must pass in hosted Node 24 CI before T4 is
  complete or any operation is promoted from evidence-pending to supported.
