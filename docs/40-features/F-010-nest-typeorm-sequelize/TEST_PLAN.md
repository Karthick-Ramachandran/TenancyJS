# Test Plan: Nest Typeorm Sequelize

## Unit Tests

- Nest config/metadata/store, resolver outcome mapping, guard ordering, interceptor completion/error/
  unsubscribe, concurrent requests, no central fallback, and exact-once resolver/executor calls.
- ORM config/classification, criteria composition, create/update tenant conflicts, errors/redaction,
  missing context, unknown models/operations, and capability matrices.

## Integration Tests

- Compiled Nest 11 Express and Fastify applications exercise success, handler failure, resolution
  failure, concurrent tenants, streaming/cancellation boundary, and optional ORM executor composition.
- PostgreSQL 17 suites per ORM cover colliding tenant row IDs, CRUD/count, commit/rollback, concurrency,
  pooled reuse, central allowlists, schema placement, role mode, and separate databases.

## Security Tests

- Forced-RLS validation failures; superuser/BYPASSRLS/table-owner rejection; raw/query-builder/base
  client unreachability; tenant conflict and cross-placement attempts; sanitized errors; resource-cache
  collisions and shutdown.

## Release Gates

- Typecheck public generics against real ORM types; coverage floors; 11+ new package archives/consumer
  imports; `pnpm check`; `pnpm audit --audit-level high`; `persist doctor`.
