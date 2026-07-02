# `@tenancyjs/adapter-prisma`

Fail-closed row-level tenant isolation for supported Prisma Client operations.

> Pre-alpha: implemented and tested against Prisma 7.8/PostgreSQL, but not published for production use.

## Security boundary

Only the client returned by `prisma.$extends(...)` is protected. Retaining or using the original
Prisma client bypasses TenancyJS guarantees. The adapter guarantees isolation only for the operations
listed below; every other operation is rejected or unsupported.

Apply the TenancyJS extension last. Prisma query extensions execute in registration order, so an
unreviewed extension registered after TenancyJS could alter already-scoped arguments before execution.

Raw operations are rejected because Prisma cannot reliably enforce a tenant predicate for arbitrary
SQL. Nested relation reads/writes and relation traversal are rejected because Prisma query extensions
do not expose those nested operations as reliable interception hooks.

## Usage

```ts
import { PrismaClient } from "./generated/prisma/client.js";
import { TenancyManager } from "@tenancyjs/core";
import { createPrismaTenancyExtension } from "@tenancyjs/adapter-prisma";

const tenancy = new TenancyManager();
const basePrisma = new PrismaClient({ adapter: databaseDriverAdapter });

export const prisma = basePrisma.$extends(
  createPrismaTenancyExtension({
    manager: tenancy,
    tenantModels: {
      Post: { tenantField: "tenantId", relationFields: ["comments"] },
      Comment: { tenantField: "tenantId", relationFields: ["post"] },
    },
    centralModels: {
      Tenant: { relationFields: [] },
    },
  }),
);
```

Every Prisma model must be classified. Unknown models fail before query delegation. Relation fields
must be listed so nested relation access can be rejected rather than silently bypassing isolation.
`createPrismaAdapter().validate()` returns a schema-classification warning because a generic packaged
extension cannot prove that this manual map is exhaustive; review it whenever the Prisma schema changes.

Use the extended client inside a tenant scope:

```ts
await tenancy.runWithTenant({ id: "tenant-a" }, async () => {
  await prisma.post.findMany(); // tenant predicate added
  await prisma.post.count(); // tenant predicate added
  await prisma.post.updateMany({ data: { published: true } });
});
```

Prisma's generated TypeScript create input still requires a non-nullable `tenantId` field. Query
extensions cannot change generated input types, so TypeScript callers provide the current tenant ID;
the adapter validates it and rejects conflicts before executing the query. Runtime inputs without the
field receive the active tenant ID automatically.

## Supported operations

| Capability                                    | Behavior                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `findUnique`, `findUniqueOrThrow`             | tenant predicate appended while preserving the top-level unique selector |
| `findFirst`, `findFirstOrThrow`, `findMany`   | tenant predicate appended                                                |
| `count`, `aggregate`, `groupBy`               | tenant predicate appended                                                |
| `create`, `createMany`, `createManyAndReturn` | tenant field injected/validated                                          |
| `update`, `updateMany`, `updateManyAndReturn` | tenant predicate appended; tenant-field changes rejected                 |
| `delete`, `deleteMany`                        | tenant predicate appended                                                |
| `upsert`                                      | tenant-scoped selector, validated create branch, immutable update branch |
| batch and interactive transactions            | supported through Prisma's supplied query callback                       |
| explicit `runInCentralContext`                | reviewed bypass for supported model operations                           |
| allowlisted central models                    | pass through for supported operations                                    |
| raw operations                                | rejected                                                                 |
| nested relations and relation traversal       | rejected                                                                 |
| unknown models or operations                  | rejected                                                                 |
| database-per-tenant                           | unsupported in this package version                                      |

Host schemas should use a non-null tenant discriminator and indexes appropriate for their access
patterns. TenancyJS does not generate or migrate the Prisma schema.

See [MIGRATION.md](MIGRATION.md) for greenfield/existing-application adoption and
[BENCHMARK.md](BENCHMARK.md) for the repeatable policy-overhead baseline.
