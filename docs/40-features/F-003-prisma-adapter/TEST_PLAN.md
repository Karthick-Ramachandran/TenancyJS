# Test Plan: Prisma Adapter

## Acceptance Mapping

| Criteria | Evidence |
|---|---|
| AC-PRISMA-01/02 | configuration, context, model-classification, and extension-construction unit tests |
| AC-PRISMA-03/04/05 | operation-policy matrix plus two-tenant PostgreSQL CRUD/bulk/aggregate tests |
| AC-PRISMA-06 | batch and interactive PostgreSQL transaction tests, including rollback |
| AC-PRISMA-07 | central-model and explicit central-context tests |
| AC-PRISMA-08 | raw, nested relation, unknown model/operation, and tenant-tampering negative tests |
| AC-PRISMA-09 | shared contract executed against real Prisma/PostgreSQL |
| AC-PRISMA-10 | tarball consumer, exports/types, README example, and compatibility documentation checks |

## Unit Tests

- Validate and freeze model configuration; reject overlap, duplicates, invalid names/fields, and empty
  tenant classifications.
- Compose tenant filters with caller `where` through `AND`, including unique filters and caller-supplied
  tenant predicates.
- Inject tenant fields into single/array creates and reject conflicting tenant IDs.
- Reject tenant-field updates and unsupported nested relation keys without mutating input arguments.
- Verify supported operation capability mapping, central pass-through, raw rejection, unknown operation,
  exact-once query delegation, and original error propagation.
- Self-test the runner-neutral adapter contract with safe and intentionally leaky harnesses.

## Integration Tests

- Use a dedicated Prisma schema with two tenant-owned models, one central model, relations, compound
  indexes, and tenant-specific records in disposable PostgreSQL.
- Execute the shared contract for create, unique/many reads, update/delete, createMany/updateMany/
  deleteMany, count, aggregate/groupBy, upsert, and supported returning operations.
- Prove batch and interactive transactions preserve tenant scope and rollback atomically.
- Install packed core/testing/adapter tarballs into a clean consumer, generate its Prisma client, and
  execute a public extension smoke test.
- Exercise the declared Prisma peer version on Node 22 and Node 24 in CI.

## Security Tests

- Tenant A cannot observe, count, aggregate, update, upsert, or delete tenant B records even with a
  conflicting caller filter or unique ID.
- Missing context and unregistered models fail before query delegation; central context is explicit.
- Conflicting create tenant IDs and all discriminator updates fail.
- Raw safe/unsafe methods, nested relation reads/writes, relation traversal entry points, and unknown
  operations fail typed and closed on the extended surface.
- Errors and diagnostics contain model/operation metadata but no row data, query arguments, tenant
  records, or database URLs.

## Skipped/Deferred Lanes

- Database-per-tenant, MongoDB, MySQL, SQLite-only evidence, Prisma 6, and future Prisma 8 are deferred.
- Nested relations and raw access are tested as rejected capabilities, not supported behavior.
- Express/Next/Nest lifecycle and example E2E begin in later tasks.
