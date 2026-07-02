# Module Test Plan: Lucid Adapter

## Unit Tests

- Model config, read/find/fetch/paginate/create/update/delete hooks, transaction attachment,
  discriminator invariants, missing context, errors, and public types.

## Integration Tests

- Separate Lucid 21.8/PostgreSQL 17 two-tenant CRUD/aggregate/relationship/transaction tests plus
  production Adonis/Japa composition on Node 22/24.

## Security Tests

- `.pojo()`, quiet persistence, bulk mutations, direct builders, raw SQL, relationship/preload,
  retained database service, missing RLS context, policy validation, and sanitized failures.
