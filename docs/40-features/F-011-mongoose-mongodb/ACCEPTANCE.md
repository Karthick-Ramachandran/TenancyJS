# Acceptance Criteria: Mongoose Mongodb

## Criteria

- AC-01: Every model is tenant or central; duplicates/unknowns fail closed.
- AC-02: Supported row CRUD/count operations compose tenant filters, inject/validate creates, reject
  tenant-changing updates, pass the managed session, and return no live document/model handle.
- AC-03: Missing/central context, native/raw/aggregate/populate/unknown operations, unsafe filters, and
  tenant conflicts fail without delegation or secret/tenant disclosure.
- AC-04: A real MongoDB 8 replica-set suite proves two tenants with the same logical `id` cannot
  read/update/delete each other and proves rollback, concurrency, and session cleanup.
- AC-05: Database routing rejects tenant/key collisions, is bounded/closeable, and proves two databases
  with colliding `_id` values remain isolated.
- AC-06: Capability metadata labels row-level adapter-enforced, rejects schema mode, and documents the
  credential caveat for database mode; package consumers, full gate, audit, and Doctor pass.

## Out Of Scope

- Populate/relations, aggregation pipelines, change streams, raw driver/collection access, standalone
  Mongo transactions, schema-per-tenant, provisioning, and Prisma Mongo.
