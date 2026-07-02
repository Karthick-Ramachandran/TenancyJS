# Module Test Plan: Lucid Adapter

## Unit Tests

- Model config, read/find/fetch/paginate/create/update/delete hooks, transaction attachment,
  discriminator invariants, missing context, errors, and public types.

## Integration Tests

- Separate Lucid 22.4/PostgreSQL 17 two-tenant CRUD/aggregate/relationship/transaction tests plus
  production AdonisJS 7/Japa composition on Node 24.

Local status: the Lucid-specific suite is implemented; 11 unit/adversarial tests pass and four real
PostgreSQL tests skip when `TEST_DATABASE_URL` is absent. Hosted evidence remains required.

## Security Tests

- `.pojo()`, quiet persistence, bulk mutations, direct builders, raw SQL, relationship/preload,
  retained database service, missing RLS context, policy validation, and sanitized failures.
