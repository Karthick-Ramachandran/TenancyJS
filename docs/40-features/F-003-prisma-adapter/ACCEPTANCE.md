# Acceptance Criteria: Prisma Adapter

## Criteria

- AC-PRISMA-01: The adapter returns a Prisma extension that reads tenant identity only through the
  supplied `TenancyManager`; it creates no second context store and does not mutate the base client.
- AC-PRISMA-02: Every model reached through the extended client is classified explicitly as
  tenant-scoped or central. Overlap, invalid configuration, and unregistered models fail typed and
  closed before a query executes.
- AC-PRISMA-03: Supported reads, unique reads, counts, aggregates, and grouping combine the caller's
  filter with the current tenant discriminator and cannot return another tenant's rows.
- AC-PRISMA-04: Supported create/upsert/bulk-create operations inject the current tenant discriminator;
  conflicting input is rejected. Update operations cannot change the discriminator.
- AC-PRISMA-05: Supported update, update-many, delete, and delete-many operations combine tenant scope
  with caller filters so tenant A cannot mutate tenant B.
- AC-PRISMA-06: Supported batch and interactive transaction operations retain the current tenant scope
  and atomicity; adapter code does not issue queries through a different client or connection.
- AC-PRISMA-07: Central models pass through only when explicitly allowlisted. Tenant-scoped models
  require tenant context, while explicit core central context provides the reviewed administrative
  bypass.
- AC-PRISMA-08: Raw operations, relation traversal, nested relation reads/writes, and unknown Prisma
  operations are rejected with typed errors unless a later accepted ADR and conformance lane adds
  support.
- AC-PRISMA-09: A shared two-tenant PostgreSQL contract proves create/read/update/delete, bulk,
  count/aggregate, transaction, missing-context, central-model, tampering, raw-query, and nested-query
  behavior.
- AC-PRISMA-10: The package documents the extended-client-only boundary, supported Prisma/Node range,
  operation matrix, schema/index expectations, and unsupported escape paths.
- AC-PRISMA-11: A shared Adapter Security Contract defines guarantees, caller obligations, secured
  client boundaries, evidence requirements, and the fail-closed expansion rule for every adapter.
- AC-PRISMA-12: Prisma migration guidance gives greenfield and existing applications concrete native
  ORM alternatives for nested writes, relation traversal, raw SQL, base clients, and schema changes.
- AC-PRISMA-13: Typed rejection messages explain why execution is unsafe and identify the supported
  alternative without including tenant records, arguments, rows, SQL, or connection data.
- AC-PRISMA-14: Configuration is normalized/validated once when the extension is created. Query
  execution reuses core request context and performs no resolver, registry, or database lookup to
  discover the tenant.
- AC-PRISMA-15: A repeatable benchmark reports synchronous policy overhead separately from database
  latency; initial evidence is documented without a pass/fail threshold.
- AC-PRISMA-16: The later CLI task includes `tenancy doctor` diagnostics for unextended clients,
  unsupported Prisma patterns, incomplete classification, and migration-effort estimation.

## Out Of Scope

- AC-ADAPTER-01 for Sequelize, Knex, or Lucid.
- Database-per-tenant and schema-per-tenant strategies.
- Express or other framework lifecycle integration.
- A stable public compatibility claim before the PostgreSQL lane and package-consumer gate pass.

## Implementation Evidence

AC-PRISMA-01 through AC-PRISMA-10 are implemented for the explicit Prisma 7.8/PostgreSQL operation
matrix. Unit and real-database tests cover top-level CRUD/bulk/aggregate operations, unique selectors,
interactive/batch transactions, central models/context, missing context, discriminator tampering,
unknown models/operations, and raw/nested rejection. The shared adapter contract and package-consumer
gate pass locally; hosted Node 22/24 PostgreSQL evidence remains required before merge.
