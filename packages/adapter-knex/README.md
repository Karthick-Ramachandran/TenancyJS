# @tenancyjs/adapter-knex

Fail-closed Knex 3.3 row-level tenancy for PostgreSQL 17.

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
