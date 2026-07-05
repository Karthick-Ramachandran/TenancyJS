# Product Backlog

Future scope agreed beyond the accepted PRD's **initial support commitment**. This does not change what
is *currently* being built; it records where we are headed so scope reads stay unambiguous.

## Source-of-truth hierarchy

1. `docs/00-product/PRD.md` — the **accepted** PRD. Governs current scope and non-goals.
2. This backlog — agreed **future** direction (post-initial-commitment).
3. `docs/BRD-PRD.md` — early aspirational **research** draft (2026-06-29). Useful for ideas, but it is
   **stale on scope** (e.g. it lists Mongoose as P0). Where it conflicts with the accepted PRD, the PRD
   wins; where this backlog restores an item the PRD deferred, this backlog is the newer intent.

## ORM adapters — support the common Node data layers

Target: support the most commonly used Node ORMs, at least for **Express and NestJS**.

| Adapter | State |
| --- | --- |
| Prisma | ✅ built (row-level, hosted evidence) |
| Knex | ✅ built (PostgreSQL RLS) |
| Lucid | ✅ built (AdonisJS/PostgreSQL RLS) |
| **Sequelize** | 🚧 row-level PostgreSQL vertical slice built locally; broader strategies pending |
| **Drizzle** | Backlog — high Next.js/Express usage |
| **TypeORM** | 🚧 row-level PostgreSQL vertical slice built locally; broader strategies pending |
| **Mongoose / MongoDB** | 🚧 adapter-enforced row-level replica-set slice built locally; database routing pending |

Note: PRD non-goals list Mongoose/Drizzle/TypeORM "in the initial support commitment"; this backlog
records them as **future**, so the two are consistent.

## Framework integrations

| Integration | State |
| --- | --- |
| Express, Next.js | ✅ built |
| AdonisJS | ✅ built — deliberately scoped to **Lucid + PostgreSQL only** (ADR-0014); other Adonis DBs are later |
| **NestJS** | 🚧 Nest 11 Express/Fastify lifecycle built locally; adapter E2E pending |
| Fastify | ✅ supported through the NestJS 11 integration; standalone integration remains backlog |

## Strategies

- **Database-per-tenant** — provisioning, tenant-migration loops, connection lifecycle (the second
  strategy the README promises for v0.5). Backlog.
- **Schema-per-tenant** (PostgreSQL) — backlog, after database-per-tenant.

## Operational CLI (beyond the current `init`/`doctor`/`test:leak` foundation)

Per `docs/CLI-RESEARCH.md`: tenant registry CRUD (`list`/`create`/`suspend`), `migrate` /
`migrate:central` / `seed` delegating to native ORM tools, `run <script>` in tenant context,
`provision`/`deprovision`, and the Adonis Ace wrappers. Backlog.

## Core capability gaps (from BRD coverage audit)

- Extra resolvers: **path prefix**, **JWT claim**, cached tenant lookup with TTL.
- Event catalog + provisioning pipeline (`tenant.created` → provision/migrate/seed).
- Bootstrappers: database (done via core ALS), **cache / storage / queue**.
- Tenant suspension read-only mode; queue/job tenant envelope.

## Immediate (not backlog — active)

Finish AdonisJS support: CLI `init` templates + Ace wrappers (F-007 T6 remainder), then reviews (T7).
