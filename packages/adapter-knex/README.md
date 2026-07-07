# tenancyjs-adapter-knex

Fail-closed Knex 3.3 row-level, schema-per-tenant, and database-per-tenant isolation for PostgreSQL 17.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

This package is experimental until its PostgreSQL conformance matrix passes. The protected callback
client exposes a deliberately narrow fluent subset. It combines application-level discriminator
enforcement with forced PostgreSQL row-level security (RLS).

```ts
const tenancy = createKnexTenancy({
  manager,
  knex: privateBaseKnex,
  tenantTables: {
    "app.posts": {
      tenantColumn: "tenant_id",
      policyName: "posts_tenant_isolation",
    },
  },
  centralTables: { "app.tenants": {} },
});

const validation = await tenancy.validate();
if (!validation.valid) throw new Error("Invalid tenancy database policy");

await manager.runWithTenant(tenant, () =>
  tenancy.run(async (db) => {
    return db.table("app.posts").where("published", true).select("id", "title");
  }),
);
```

## Required database boundary

- Use a separate migration role to own tables and install policies.
- The runtime role must not be superuser, `BYPASSRLS`, or table owner.
- Enable and force RLS on every tenant table with both `USING` and `WITH CHECK` expressions using
  `tenancyjs.tenant_id` and `tenancyjs.is_central` transaction-local settings.
- Run and review `validate()` during startup. Protected execution remains locked until it passes.

## Rejected surface

Raw SQL/values, schema/migration/seed APIs, client/connection access, caller transactions, unsafe OR
or clear operations, joins, unions, CTEs, subqueries, streams, truncate, and unclassified tables are
outside the initial guarantee. Retaining the base Knex client bypasses TenancyJS entirely.

## Schema per tenant

Schema mode is **adapter-enforced**, not equivalent to forced RLS. The protected client uses only
unqualified table names and the adapter validates and applies a transaction-local `search_path` for
every tenant scope.

```ts
const tenancy = createKnexTenancy({
  manager,
  knex: privateBaseKnex,
  strategy: "schemaPerTenant",
  schema: (tenant) => tenant.schema,
  centralSchema: "public",
  tenantTables: { posts: {} },
  centralTables: { tenants: {} },
});

await tenancy.validate();
await manager.runWithTenant(tenant, () =>
  tenancy.run((db) => db.table("posts").select("id", "title")),
);
```

Tenant and central table names must be unqualified. A tenant schema may not equal the central schema;
raw/qualified access is unavailable through the protected client. The engine rejects a tenant that
changes schemas and two tenant identities that resolve to the same schema. A retained base Knex client
can bypass this adapter-enforced tier. Configure `role: (tenant) => tenant.role` for the optional
database-enforced per-tenant-role tier; provisioning remains application-owned.

## Database per tenant

Database mode resolves an opaque placement key and lazily creates a tenant-specific Knex client. The
shared bounded cache enforces a one-to-one tenant/key mapping and disposes idle clients on eviction.
`validate()` reports configuration as valid with a warning: the open-ended set of tenant factories and
connections cannot be inspected at startup and is exercised when each tenant is first used.

```ts
const tenancy = createKnexTenancy({
  manager,
  knex: privateLandlordKnex,
  strategy: "databasePerTenant",
  connection: (tenant) => ({
    key: tenant.databaseKey,
    create: () => knex(connectionFor(tenant)),
  }),
  maxConnections: 25,
  tenantTables: { posts: {} },
});
```

The resolver and factory are security-sensitive host code: each key must create the intended separate
tenant database. Never use a URL or credentials as the key, and call `close()` during shutdown.
