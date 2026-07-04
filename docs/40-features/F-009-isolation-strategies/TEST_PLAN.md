# Test Plan: Isolation Strategies

## Unit Tests

- Shared SQL identifier/table normalization, discriminator decisions, forced-RLS catalog validation,
  row context, schema engine validation, resolver failure, and sanitized database failure.
- Knex/Lucid strategy configuration, unqualified table rules, resolver requirements, capability
  matrices, and row-level regression suites.

## Integration Tests

- Knex 3.3/PostgreSQL 17 two-schema protected-client suite.
- Lucid 22.4/PostgreSQL 17 row-level and schema-per-tenant model/relationship suites.
- Full workspace/package-consumer gate; hosted PostgreSQL evidence remains required before release.

## Security Tests

- Concurrent tenant A/B read/write isolation; cross-tenant mutation denial; qualified/raw rejection;
  central placement separation; rollback and pool cleanup.
- Lucid `.pojo()`, quiet, bulk/direct builder and central tenant-model paths fail closed.
- Central schema tenant-table shadowing, missing/inaccessible placement, privileged roles, invalid
  identifiers, resolver exceptions, and database errors never unlock protected execution.
