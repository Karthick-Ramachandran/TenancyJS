# Knex + PostgreSQL Reference

This reference shows the initial TenancyJS Knex boundary: a shared PostgreSQL database, forced RLS,
separate migration/runtime roles, and a callback-scoped protected client.

```bash
export MIGRATION_DATABASE_URL=postgresql://tenancy_migrator@127.0.0.1/tenancyjs_example
export DATABASE_URL=postgresql://tenancy_runtime@127.0.0.1/tenancyjs_example
export TENANCY_RUNTIME_ROLE=tenancy_runtime

pnpm --filter @tenancyjs/example-knex-postgres migrate
```

The migration role owns schema and policies. The runtime role must not own tables or have superuser,
`BYPASSRLS`, or DDL privileges.

```ts
const runtime = createKnexPostgresRuntime(process.env.DATABASE_URL!);
const validation = await runtime.tenancy.validate();
if (!validation.valid) throw new Error("Invalid tenancy RLS policy");

const posts = await runtime.manager.runWithTenant(tenant, () =>
  runtime.tenancy.run((db) =>
    db.table("knex_example.posts").select("id", "title"),
  ),
);
```

Never export the base Knex instance. Raw SQL, schema operations, unsafe builder composition, and
non-PostgreSQL providers are outside this example's security boundary.
