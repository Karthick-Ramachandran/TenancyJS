# Module Test Plan: Sequelize Adapter

## Unit Tests

- Config/classification, plain filters/data, tenant conflicts, missing context, unsupported surface,
  validation/redaction, capabilities, and public types.

## Integration Tests

- PostgreSQL 17 row/schema/database suites with colliding IDs, CRUD/count, rollback, concurrency,
  central access, state cleanup, cache collision, and shutdown.

## Security Tests

- No raw/literal/include/scope/association/instance/QueryInterface escape; forced RLS failures and
  tenant conflicts fail before unsafe delegation.
