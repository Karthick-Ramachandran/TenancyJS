# Module Test Plan: Knex Adapter

## Unit Tests

- Config/table classification, protected fluent transformations, discriminator handling, rejected
  escapes, transaction lifecycle, validation findings, errors, and public types.

## Integration Tests

- Shared adapter contract plus Knex 3.3/PostgreSQL 17 CRUD/bulk/aggregate/transaction/concurrency/
  rollback/central behavior on Node 24.

## Security Tests

- Forced `USING`/`WITH CHECK` RLS, missing context, pool-setting cleanup, base/raw/client/schema escape,
  OR/clear/join/union/subquery rejection, unclassified tables, and sanitized output.
