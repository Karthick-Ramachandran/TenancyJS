# Module Test Plan: Prisma Adapter

## Unit Tests

- Configuration/model classification and immutable capabilities.
- Operation-specific filter/data transformation without input mutation.
- Context, central bypass, tenant-field tampering, unsupported operation, and delegation behavior.

## Integration Tests

- Shared two-tenant adapter contract against generated Prisma Client and disposable PostgreSQL.
- Batch/interactive transaction behavior and package-consumer extension execution.
- Tested Prisma peer on Node 22 and Node 24.

## Security Tests

- Cross-tenant negative cases for every supported read/write/aggregate/bulk operation.
- Typed fail-closed behavior for missing context, unregistered models, raw queries, nested relations,
  relation traversal, and tenant discriminator tampering.
- No errors/logs expose query arguments, row data, tenant records, or database URLs.

## Evidence

- Unit policy/configuration tests and generated-client compile test.
- Shared contract self-test with a deliberately leaky harness.
- Shared contract plus Prisma-specific negative/transaction tests on Prisma 7.8/PostgreSQL 17.
- Packed public-package consumer execution.

Detailed mapping: `docs/40-features/F-003-prisma-adapter/TEST_PLAN.md`.
