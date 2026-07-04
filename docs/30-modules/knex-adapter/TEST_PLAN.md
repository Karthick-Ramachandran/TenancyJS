# Module Test Plan: Knex Adapter

## Unit Tests

- Config/table classification, protected fluent transformations, discriminator handling, rejected
  escapes, transaction lifecycle, validation findings, errors, and public types.

## Integration Tests

- Shared adapter contract plus Knex 3.3/PostgreSQL 17 CRUD/bulk/aggregate/transaction/concurrency/
  rollback/central behavior on Node 24.
- Schema-per-tenant two-schema concurrent reads/writes, cross-tenant mutation denial, central
  placement, rollback, pool cleanup, and qualified/raw rejection.

## Security Tests

- Forced `USING`/`WITH CHECK` RLS, missing context, pool-setting cleanup, base/raw/client/schema escape,
  OR/clear/join/union/subquery rejection, unclassified tables, and sanitized output.
- Schema placement existence/usage/table checks, central collision, invalid resolver output, and
  transaction-local `search_path` reset.
