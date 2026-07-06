# `tenancyjs-adapter-sequelize`

Fail-closed stable Sequelize 6 isolation for PostgreSQL 17 and MySQL 8 on Node 24. PostgreSQL supports
all three strategies; MySQL supports adapter-enforced row-level and database-per-tenant.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `npx tenancy` CLI, and how this package fits with an adapter + integration.

The adapter exposes callback-scoped protected plain-value model facades, not native Sequelize models,
instances, transactions, QueryInterface, or raw queries. Every supported operation receives the
adapter-owned transaction explicitly; no global CLS configuration is required.

The initial surface supports scalar-equality find/count/create/update/delete operations. Includes,
associations, scopes, literals/operators, instance save, sync, migrations, and raw access are rejected
or unavailable. Every tenant table requires reviewed forced RLS and startup validation in row-level
mode. Schema mode requires unqualified model table names and uses the shared transaction-local
`search_path` engine. Database mode leases host-created Sequelize instances from the bounded cache and
resolves only the registered model name on that tenant-bound instance.

MySQL users pass `dialect: "mysql"`. Row mode is **adapter-enforced and experimental** because MySQL
has no RLS; the native Sequelize instance bypasses it and must remain private. MySQL has no separate
schema-per-tenant mode—use `databasePerTenant`.

## Row-level usage

```ts
const tenancy = createSequelizeTenancy({
  manager,
  sequelize,
  tenantModels: [
    {
      model: Post,
      table: "app.posts",
      tenantAttribute: "tenantId",
      tenantColumn: "tenant_id",
    },
  ],
});

await tenancy.validate();
await manager.runWithTenant(tenant, () =>
  tenancy.run((client) => client.model(Post).findAll({ status: "open" })),
);
```

## Schema per tenant

Models must not declare a fixed schema; table config is unqualified and the adapter owns the
transaction-local `search_path`.

```ts
const tenancy = createSequelizeTenancy({
  manager,
  sequelize,
  strategy: "schemaPerTenant",
  schema: (tenant) => tenant.schemaName,
  tenantModels: [{ model: Post, table: "posts" }],
});
```

## Database per tenant

Each tenant Sequelize instance must register the same configured model names. Keep URLs and credentials
out of the opaque cache key.

```ts
const tenancy = createSequelizeTenancy({
  manager,
  sequelize: landlordSequelize,
  strategy: "databasePerTenant",
  tenantModels: [{ model: Post, table: "posts" }],
  connection: (tenant) => ({
    key: tenant.databaseKey,
    create: () => createTenantSequelize(tenant.databaseSecretRef),
  }),
  maxConnections: 25,
});
```

Call `close()` during shutdown. The facade supports plain scalar-equality find/count/create/update/delete
operations and returns plain values, never live Sequelize instances.
