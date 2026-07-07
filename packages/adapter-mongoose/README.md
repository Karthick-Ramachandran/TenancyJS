# `tenancyjs-adapter-mongoose`

Fail-closed Mongoose 9 row-level and database-per-tenant isolation for MongoDB 8 replica sets and Node 24.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

This boundary is **adapter-enforced**, not equivalent to PostgreSQL forced RLS. Keep native Mongoose
connections, models, documents, queries, and collections private. Protected reads return lean plain
values and supported writes compose or validate the active tenant field inside one managed session.

The initial surface supports scalar-equality find/count/create/update/delete. Populate, aggregation,
raw collection/driver access, bulkWrite, mapReduce, change streams, and live document save are rejected
or unavailable. `validate()` returns an enforcement-tier warning that applications must review.

Database-per-tenant mode leases a host-created Mongoose `Connection` per tenant through the shared
bounded cache and resolves only registered model names on that connection. It is a routing guarantee
with shared credentials; use credentials restricted to one database when MongoDB itself must reject
sibling-database access. MongoDB has no SQL schema-per-tenant equivalent.

## Row-level usage

```ts
const tenancy = createMongooseTenancy({
  manager,
  connection,
  tenantModels: [{ model: PostModel, tenantField: "tenantId" }],
});

await tenancy.validate();
await manager.runWithTenant(tenant, () =>
  tenancy.run((client) => client.model(PostModel).find({ status: "open" })),
);
```

## Database per tenant

Every created connection must reach a replica set and register the same configured model names.

```ts
const tenancy = createMongooseTenancy({
  manager,
  connection: landlordConnection,
  strategy: "databasePerTenant",
  tenantModels: [{ model: PostModel }],
  database: (tenant) => ({
    key: tenant.databaseKey,
    create: () => createTenantConnection(tenant.databaseSecretRef),
  }),
  maxConnections: 25,
});
```

Call `close()` on shutdown. The protected model supports scalar-equality find/count/create/update/delete
operations and returns lean plain values. A native model, collection, connection, aggregation, populate,
or operator expression is outside the guarantee.
