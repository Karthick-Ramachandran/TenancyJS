# `tenancyjs-adapter-typeorm`

Fail-closed TypeORM 1 row-level isolation for PostgreSQL 17 and Node 24.

The adapter exposes callback-scoped protected repositories, not a native `DataSource`, manager,
repository, QueryBuilder, or Active Record entity. The initial surface supports plain scalar-equality
`findBy`, `findOneBy`, `countBy`, `create`, `createMany`, `update`, and `delete`. Relations, raw SQL,
query builders, migrations, schema sync, and arbitrary TypeORM operators are rejected or unavailable.

Every tenant table must use a reviewed forced-RLS policy and a non-owner, non-superuser,
non-`BYPASSRLS` runtime role. `validate()` must pass before `run()`.
