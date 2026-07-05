# `tenancyjs-adapter-typeorm`

Fail-closed TypeORM 1 isolation for PostgreSQL 17 and MySQL 8 on Node 24. PostgreSQL supports all
three strategies; MySQL supports adapter-enforced row-level and database-per-tenant.

The adapter exposes callback-scoped protected repositories, not a native `DataSource`, manager,
repository, QueryBuilder, or Active Record entity. The initial surface supports plain scalar-equality
`findBy`, `findOneBy`, `countBy`, `create`, `createMany`, `update`, and `delete`. Relations, raw SQL,
query builders, migrations, schema sync, and arbitrary TypeORM operators are rejected or unavailable.

Every tenant table must use a reviewed forced-RLS policy and a non-owner, non-superuser,
non-`BYPASSRLS` runtime role in row-level mode. Schema mode requires unqualified table metadata and
uses the shared transaction-local `search_path` engine; database mode leases host-created
`DataSource` instances through the bounded cache. `validate()` must pass before `run()`.

MySQL users pass `dialect: "mysql"`. Row mode is **adapter-enforced and experimental** because MySQL
has no RLS; the native `DataSource` bypasses it and must remain private. MySQL has no separate
schema-per-tenant mode—use `databasePerTenant`.

## Row-level usage

```ts
const tenancy = createTypeOrmTenancy({
  manager,
  dataSource,
  tenantEntities: [
    {
      entity: Post,
      table: "app.posts",
      tenantProperty: "tenantId",
      tenantColumn: "tenant_id",
    },
  ],
});

await tenancy.validate();
await manager.runWithTenant(tenant, () =>
  tenancy.run((client) => client.repository(Post).findBy({ status: "open" })),
);
```

## Schema per tenant

Entities must not declare a fixed schema; the adapter sets a transaction-local `search_path` and uses
unqualified tables.

```ts
const tenancy = createTypeOrmTenancy({
  manager,
  dataSource,
  strategy: "schemaPerTenant",
  schema: (tenant) => tenant.schemaName,
  tenantEntities: [{ entity: Post, table: "posts" }],
});
```

## Database per tenant

The factory must return an initialized `DataSource` with every registered entity. The opaque key must
not contain a URL or credential.

```ts
const tenancy = createTypeOrmTenancy({
  manager,
  dataSource: landlordDataSource,
  strategy: "databasePerTenant",
  tenantEntities: [{ entity: Post, table: "posts" }],
  connection: (tenant) => ({
    key: tenant.databaseKey,
    create: () => createInitializedDataSource(tenant.databaseSecretRef),
  }),
  maxConnections: 25,
});
```

Call `close()` during application shutdown. The protected repository supports scalar-equality
`findBy`, `findOneBy`, `countBy`, `create`, `createMany`, `update`, and `delete` only.
