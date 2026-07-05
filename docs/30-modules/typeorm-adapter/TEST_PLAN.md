# Module Test Plan: Typeorm Adapter

## Unit Tests

- Classification/config, criteria composition, data conflict rules, missing context, unsupported/native
  surface, validation/redaction, capabilities, and public generic types.

## Integration Tests

- PostgreSQL 17 row/schema/database suites with colliding IDs, CRUD/count, rollback, concurrency,
  central access, role/search-path cleanup, cache collision, and shutdown.

## Security Tests

- Forced RLS/role failures; no raw/query builder/DataSource/manager escape; unknown entities/relations
  fail; tenant fields cannot be overridden or moved.
