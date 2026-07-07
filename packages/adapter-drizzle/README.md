# `tenancyjs-adapter-drizzle`

Fail-closed Drizzle 0.45 tenant isolation for PostgreSQL and MySQL on Node.js 24+.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

The adapter returns callback-scoped plain-value table facades. It never exposes the native Drizzle
database/transaction, SQL expressions, relational query API, joins, migrations, or raw execution.

## PostgreSQL row-level

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import {
  createDrizzleTenancy,
  createPostgresDrizzleBinding,
} from "tenancyjs-adapter-drizzle";

const tenancy = createDrizzleTenancy({
  manager,
  database: createPostgresDrizzleBinding(drizzle({ client: pool })),
  tenantTables: [{ table: posts, policyName: "posts_tenant_isolation" }],
});

await tenancy.validate(); // validates runtime role + ENABLE/FORCE RLS + policy
const rows = await tenancy.run((client) => client.table(posts).findMany());
```

Use a non-owner, non-superuser, non-`BYPASSRLS` runtime role. The deployed policy must use the
`tenancyjs.tenant_id` and `tenancyjs.is_central` transaction-local settings in both `USING` and
`WITH CHECK`. The migration role and base Drizzle database stay private.

## PostgreSQL schema-per-tenant

Use an unqualified `pgTable`; the adapter owns transaction-local `search_path`:

```ts
createDrizzleTenancy({
  manager,
  database: createPostgresDrizzleBinding(db),
  strategy: "schemaPerTenant",
  schema: (tenant) => tenant.schemaName,
  tenantTables: [{ table: posts }],
});
```

The default shared-role mode is adapter-enforced. Add a per-tenant role resolver for database-enforced
sibling-schema denial.

## Database-per-tenant

```ts
createDrizzleTenancy({
  manager,
  database: landlordBinding,
  strategy: "databasePerTenant",
  tenantTables: [{ table: posts }],
  connection: (tenant) => ({
    key: tenant.databaseKey, // opaque; never a URL
    create: () => {
      const pool = createTenantPool(tenant.secretRef);
      return createPostgresDrizzleBinding(drizzle({ client: pool }), {
        close: () => pool.end(),
      });
    },
  }),
});
```

The same pattern works with `createMySqlDrizzleBinding`. Always provide `close` for cache-owned tenant
pools.

## MySQL guarantee

MySQL row-level is **adapter-enforced and experimental**: every predicate is scoped by the protected
facade, but MySQL has no RLS backstop. Retaining/using the native Drizzle database bypasses the
guarantee. MySQL schema-per-tenant does not exist as a separate mode; use database-per-tenant.

## Supported protected operations

`findMany`, `findOne`, `count`, `create`, `createMany`, `update`, and `delete` accept plain scalar
equality only. Tenant ownership is injected/validated, and updates cannot move rows. Unknown tables,
raw SQL, nested/relational operations, query objects, and arbitrary operators are rejected or absent.

Call `validate()` before serving traffic and `close()` during shutdown.
