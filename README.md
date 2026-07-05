# TenancyJS

**Fail-closed, TypeScript-first multi-tenancy for Node.js.**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen)
![Status](https://img.shields.io/badge/status-0.1.0--beta-blueviolet)
![Isolation](https://img.shields.io/badge/isolation-fail--closed-success)

One tenant contract for every framework and ORM you already use — not a replacement for them. Tenant
identity rides the async execution scope, so your queries stay scoped without threading a `tenantId`
through every call. And the guarantee that matters: **any tenant-aware access without a valid context
throws — it never returns another tenant's data.**

```ts
await tenancy.runWithTenant(tenant, async () => {
  // Every registered adapter scopes data access to this tenant.
  // No tenant context => it throws. No silent fallback to unscoped data.
});
```

> **Beta (`0.1.0-beta`).** The API surface is stabilising toward 1.0; safe for evaluation and
> non-critical workloads. Every "supported" cell below is proven by a two-tenant adversarial isolation
> test on a real database — nothing is marked supported on faith.

## Install

```bash
npm install tenancyjs-core
# then add an adapter + framework integration for your stack, e.g.
npm install tenancyjs-adapter-prisma tenancyjs-integration-express
```

## Three isolation strategies, one contract

| Strategy                        | What it means                                                                                                                     | Adapters                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Single database** (row-level) | Shared tables, `tenant_id` + forced Postgres RLS or query-scoping                                                                 | Knex · Lucid · Prisma · TypeORM · Sequelize · Mongoose |
| **Schema per tenant**           | One Postgres schema per tenant via transaction-local `search_path` (optionally a per-tenant role for database-enforced isolation) | Knex · Lucid                                           |
| **Database per tenant**         | A separate database per tenant, routed through a bounded connection cache                                                         | Knex · Lucid · Prisma                                  |

Prisma schema-per-tenant is intentionally not supported (Prisma resolves tables from the datasource,
not `search_path`) — and the toolkit tells you so rather than pretending.

## Supported stacks

- **Frameworks:** Express 5, Next.js (App Router), AdonisJS 7, NestJS 11 (Express or Fastify) — plus a
  framework-neutral core.
- **ORMs / databases:** Prisma (PostgreSQL + MySQL); Knex, Lucid 22, TypeORM, and Sequelize
  (PostgreSQL); Mongoose 9 (MongoDB replica set). Node.js 24+.

## Operational CLI

`tenancyjs-cli` scaffolds and operates a tenancy without ever guessing about your stack. It loads your
own `tenancy.config.ts` at runtime (Node 24 strips the types — no transpiler dependency) and acts
against your live tenants:

```bash
npx tenancy init                       # scaffold for your framework + ORM
npx tenancy tenant check               # verify the runtime + warn on untested combos
npx tenancy tenant list                # read your bring-your-own tenant store
npx tenancy tenant create acme --set plan=pro
npx tenancy tenant migrate --all       # delegate to your migrator, per tenant
npx tenancy run ./backfill.ts --tenant acme
```

Registry, provisioning, and migrations all go through **your** store and hooks — the CLI orchestrates
and fails closed, but never invents ORM behaviour it hasn't tested.

## Security

Tenant identity is not authorization — your app still owns auth. TenancyJS guarantees that unknown,
suspended, or ambiguous tenants never become central context, that a misbehaving tenant store cannot
hand back the wrong tenant, that secrets are redacted from CLI output, and that cleanup always runs.
See the [security model](docs/20-security/SECURITY_MODEL.md).

## Development

Requires Node.js 24+ and pnpm 10. Run the full gate with `pnpm check` (add `TEST_DATABASE_URL` /
`MYSQL_TEST_DATABASE_URL` / `TEST_MONGODB_URL` to run the real-database isolation tests). Runnable
examples live in a separate repo (see [`examples/README.md`](examples/README.md)).

## License

MIT — see [LICENSE](LICENSE).
