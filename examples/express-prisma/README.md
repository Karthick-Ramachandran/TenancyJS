# Express + Prisma Reference

The first tested TenancyJS vertical slice: Express 5.2, Prisma 7.8, and PostgreSQL 17 with row-level
tenant isolation.

```bash
export DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tenancyjs_example
pnpm fixtures:generate
pnpm --filter @tenancyjs/example-express-prisma prisma:test:push
pnpm --filter @tenancyjs/example-express-prisma build
pnpm --filter @tenancyjs/example-express-prisma start
```

Send `x-tenant-id` with every tenant route request:

```bash
curl -H 'x-tenant-id: tenant-a' http://localhost:3000/posts
```

The protected Prisma client is the only client passed into route construction. The base client remains
inside bootstrap/disconnect code. Using an unextended client in application routes bypasses TenancyJS
isolation and is outside the adapter guarantee.

Tenant resolution establishes identity only. A production application must authenticate the user and
authorize membership in the resolved tenant before serving protected data.
