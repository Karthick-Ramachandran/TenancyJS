# Next.js + Prisma Reference

Next.js 16.2 App Router, Prisma 7.8, and PostgreSQL row-level tenancy through the TenancyJS Node
integration.

```bash
export DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tenancyjs_example
pnpm fixtures:generate
pnpm --filter @tenancyjs/example-next-prisma prisma:test:push
pnpm --filter @tenancyjs/example-next-prisma build
pnpm --filter @tenancyjs/example-next-prisma start
```

`/api/posts`, `/api/summary`, and `/api/action` (a Server Action invoked by a Route Handler) require
`x-tenant-id`. Read responses use `force-dynamic`, `revalidate = 0`, and `Cache-Control: no-store`;
applications that cache tenant results must instead include tenant identity in every cache key.

The generated Prisma client remains server-only. Tenant resolution establishes identity but does not
authenticate a user or authorize tenant membership; production applications must do both.
