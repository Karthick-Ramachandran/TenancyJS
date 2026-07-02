# Review: Knex, Lucid, And AdonisJS Vertical Slice

## Status

Planning accepted; Knex implementation is in progress.

## Findings

- Knex QueryBuilder extension is experimental and does not provide a stable universal late rewrite
  hook; a broad transparent scoping claim is unsafe.
- Lucid hooks intentionally have bypass paths, including quiet persistence and bulk/direct builder
  operations; model hooks alone are insufficient as an isolation guarantee.
- The proposal combines a narrow protected builder/model surface with forced PostgreSQL RLS and
  transaction-local context. Unsupported composition and retained base clients remain outside the
  guarantee and are rejected or validation failures.
- Current AdonisJS 7/Lucid 22 require Node 24. Initial support targets AdonisJS 6.21/Lucid 21.8 so the
  repository's Node 22/24 policy remains truthful; AdonisJS 7 is a later compatibility lane.
- Architecture-drift review found and removed a proposed integration-to-CLI dependency. Ace factories
  now use an injected structural port, preserving ADR-0001 direction and ADR-0003 service ownership.
- Security review requires a separate migration role; the runtime role cannot be a table owner or hold
  DDL, superuser, or `BYPASSRLS` privileges on protected tables.
- No accepted ADR is contradicted. PostgreSQL-only initial support, RLS storage behavior, dependency
  additions, and Adonis lifecycle were accepted in ADR-0010 and ADR-0011.
- Knex implementation review passes: PostgreSQL 17 isolation, forced-policy validation, concurrency,
  CRUD/aggregate, rollback/savepoints, explicit central behavior, pooled cleanup, package consumers,
  and the full gate pass on Node 22 and 24 in PR #8.
