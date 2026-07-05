# TenancyJS

**Fail-closed, TypeScript-first multi-tenancy for Node.js.**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen)
![Status](https://img.shields.io/badge/status-pre--alpha-orange)
![Isolation](https://img.shields.io/badge/isolation-fail--closed-success)

TenancyJS gives every framework and ORM the same tenant context and isolation contract — without
replacing the framework or ORM you already use. Tenant identity follows the async execution scope; any
tenant-aware access without valid context **fails closed** (throws) instead of returning unscoped data.

> **Pre-alpha** — not yet published to npm and not production-ready.

```ts
await tenancy.runWithTenant(tenant, async () => {
  // Every registered adapter scopes data access to this tenant.
  // No tenant context => it throws. No silent fallback to unscoped data.
});
```

## Three isolation strategies, one contract

| Strategy                        | What it means                                                                                                                     | Adapters              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Single database** (row-level) | Shared tables, `tenant_id` + forced Postgres RLS or query-scoping                                                                 | Knex · Lucid · Prisma |
| **Schema per tenant**           | One Postgres schema per tenant via transaction-local `search_path` (optionally a per-tenant role for database-enforced isolation) | Knex · Lucid          |
| **Database per tenant**         | A separate database per tenant, routed through a bounded connection cache                                                         | Knex · Lucid · Prisma |

Each supported cell is backed by a two-tenant adversarial isolation test on a real database. Prisma
schema-per-tenant is not supported (Prisma resolves tables from the datasource, not `search_path`).

## Supported stacks

- **Frameworks:** Express 5, Next.js (App Router), AdonisJS 7 — plus a framework-neutral core.
- **ORMs / databases:** Prisma (PostgreSQL + MySQL), Knex & Lucid 22 (PostgreSQL). PostgreSQL 17,
  Node.js 24+.

## Packages

Install only what you use — `@tenancyjs/core`, `@tenancyjs/identifiers`, an `@tenancyjs/adapter-*`
(Prisma/Knex/Lucid), an `@tenancyjs/integration-*` (Express/Next/Adonis), plus `@tenancyjs/testing`
and `@tenancyjs/cli` for tooling.

## Security

Tenant identity is not authorization — your app still owns auth. TenancyJS guarantees that unknown,
suspended, or ambiguous tenants never become central context, and that cleanup always runs. See the
[security model](docs/20-security/SECURITY_MODEL.md).

## Development

Requires Node.js 24+ and pnpm 10. Run the full gate with `pnpm check` (add `TEST_DATABASE_URL` /
`MYSQL_TEST_DATABASE_URL` to run the real-database isolation tests). Runnable examples live in a
separate repo (see [`examples/README.md`](examples/README.md)).

## License

MIT — see [LICENSE](LICENSE).
