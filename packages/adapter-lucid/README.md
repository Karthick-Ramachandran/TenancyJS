# @tenancyjs/adapter-lucid

**Fail-closed Lucid 22 row-level, schema-per-tenant, and database-per-tenant isolation for AdonisJS 7 and PostgreSQL 17.**

![Node](https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen)
![AdonisJS](https://img.shields.io/badge/AdonisJS-7-5A45FF)
![Lucid](https://img.shields.io/badge/Lucid-22-5A45FF)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)
![Isolation](https://img.shields.io/badge/isolation-fail--closed-success)

This package gives normal Lucid model operations tenant-aware hooks while forced PostgreSQL
row-level security (RLS) remains the final isolation boundary. It is separate from the Knex adapter
because Lucid models, hooks, relationships, transactions, and AdonisJS lifecycle need their own
contract and evidence.

> **Pre-alpha:** do not claim production support until the hosted AdonisJS 7/Lucid 22/PostgreSQL 17
> lane and reference application pass.

## Install

```bash
pnpm add @tenancyjs/core @tenancyjs/adapter-lucid \
  @adonisjs/core@^7.3 @adonisjs/lucid@^22.4 luxon@^3.7 pg@^8.20
```

Node.js 24 or newer is required by AdonisJS 7 and Lucid 22.

## Configure

Create the adapter from the application-owned `TenancyManager`, Lucid database service, and an
explicit list of tenant models.

```ts
import { createLucidTenancy } from "@tenancyjs/adapter-lucid";
import db from "@adonisjs/lucid/services/db";

const lucidTenancy = createLucidTenancy({
  manager,
  database: db,
  tenantModels: [
    {
      model: Post,
      tenantAttribute: "tenantId",
      tenantColumn: "tenant_id",
      policyName: "posts_tenant_isolation",
    },
  ],
});

const validation = await lucidTenancy.validate();
if (!validation.valid) throw new Error("Invalid tenancy database policy");
```

Run application work inside both the core tenant context and the Lucid managed transaction:

```ts
await manager.runWithTenant(tenant, () =>
  lucidTenancy.run(async () => {
    const posts = await Post.query().preload("comments");
    return posts;
  }),
);
```

The AdonisJS integration will own this composition for HTTP middleware. Jobs and tests use the same
lexical callback contract.

## Security boundary

- Every tenant model is classified explicitly; unknown application models are outside this adapter's
  guarantee.
- Normal find/fetch/paginate/save/delete operations attach to the managed transaction. Tenant reads
  add the configured discriminator; creates inject it; updates cannot change it.
- `.pojo()`, quiet persistence, bulk mutation, direct database builders, and unsupported relationship
  writes do not receive a protected transaction. Forced RLS must deny them when tenant context is
  absent; they are not silently treated as supported.
- The runtime role must not be superuser, `BYPASSRLS`, or table owner. A separate migration role owns
  schema and policy changes.
- The retained Lucid database service and privileged clients bypass TenancyJS and remain outside the
  guarantee.

## Required PostgreSQL policy

Enable and force RLS on every tenant table. Both `USING` and `WITH CHECK` must use the transaction-
local settings `tenancyjs.tenant_id` and `tenancyjs.is_central`. Runtime code validates this contract
but never installs or alters policies.

```sql
alter table posts enable row level security;
alter table posts force row level security;

create policy posts_tenant_isolation on posts
using (
  current_setting('tenancyjs.is_central', true) = 'true'
  or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
)
with check (
  current_setting('tenancyjs.is_central', true) = 'true'
  or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
);
```

See the repository security model and ADR-0010/ADR-0013 for the complete operational contract.

## Schema per tenant

Schema mode is **adapter-enforced**. Registered Lucid models use unqualified table names and the
shared PostgreSQL engine validates and applies a transaction-local `search_path`.

```ts
const lucidTenancy = createLucidTenancy({
  manager,
  database: db,
  strategy: "schemaPerTenant",
  schema: (tenant) => tenant.schema,
  centralSchema: "public",
  tenantModels: [{ model: Post }, { model: Comment }],
});
```

Every configured model's actual `table` must be the same unqualified name. The central schema and every
schema on the runtime role's effective default `search_path` must not contain those tenant-table names:
`.pojo()`, quiet, bulk, and direct builder paths skip Lucid hooks and therefore receive no managed
`search_path`; keeping the names absent makes those paths fail closed.
Retained or qualified base-database access remains outside the guarantee. Per-tenant roles and schema
provisioning are application-owned. The shared engine rejects a tenant that changes schemas and two
tenant identities that resolve to the same schema. Configure `role: (tenant) => tenant.role` for the
optional database-enforced tier.

## Database per tenant

Database mode resolves an opaque key and a tenant-specific Lucid transaction provider. The shared
bounded cache enforces a one-to-one tenant/key mapping and disposes idle connections on eviction.
`validate()` returns a warning because tenant factories and connectivity are exercised lazily, when
each tenant is first used.

```ts
const lucidTenancy = createLucidTenancy({
  manager,
  database: landlordDatabase,
  strategy: "databasePerTenant",
  connection: (tenant) => ({
    key: tenant.connectionName,
    create: () => tenantConnection(tenant),
  }),
  tenantModels: [{ model: Post }],
});
```

The host resolver/factory must map each key to the intended separate database. Keys must never contain
URLs or credentials, and `close()` must run during application shutdown.
