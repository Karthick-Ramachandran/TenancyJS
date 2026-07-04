# Module Test Plan: Lucid Adapter

## Unit Tests

- Model config, read/find/fetch/paginate/create/update/delete hooks, transaction attachment,
  discriminator invariants, missing context, errors, and public types.

## Integration Tests

- Separate Lucid 22.4/PostgreSQL 17 two-tenant CRUD/aggregate/relationship/transaction tests plus
  production AdonisJS 7/Japa composition on Node 24.

Local status: row-level and schema-per-tenant suites are implemented. Four row-level plus four schema
PostgreSQL 17 tests pass when `TEST_DATABASE_URL` is configured; hosted schema evidence remains required.

## Security Tests

- `.pojo()`, quiet persistence, bulk mutations, direct builders, raw SQL, relationship/preload,
  retained database service, missing RLS context, policy validation, and sanitized failures.
- Schema placement validation, central tenant-table shadow rejection, `.pojo()`/quiet/bulk/direct
  unqualified failure, effective default-search-path shadow rejection, cross-tenant reads/mutations,
  rollback, concurrency, and pooled search-path reset.
