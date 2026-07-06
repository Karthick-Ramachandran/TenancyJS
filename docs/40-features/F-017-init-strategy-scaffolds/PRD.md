# PRD: Init Strategy Scaffolds

## Purpose

`tenancy init` only scaffolded row-level isolation. Teams that want schema-per-tenant or
database-per-tenant had to leave the CLI and wire it by hand, which reads as "the CLI only supports
row-level" - a real gap, since every SQL adapter supports all three strategies. This feature adds a
`--strategy` flag so init scaffolds the strategy the team actually wants, using each adapter's real
factory and option names (the CLI must never invent an API).

## In Scope

- A `--strategy <row-level|schema-per-tenant|database-per-tenant>` flag on `tenancy init` (aliases:
  `schema`, `database`). Default stays `row-level`, so existing behavior is unchanged.
- Strategy-aware scaffolds (config + register helper) for:
  - Express + Sequelize / TypeORM / Drizzle (schema-per-tenant, database-per-tenant)
  - Express + Prisma and Next + Prisma (schema-per-tenant via `createPrismaSchemaTenancy`,
    database-per-tenant via `createPrismaDatabaseTenancy`)
- Fail closed for any combo not scaffolded yet: a clear error pointing to the stack docs, never a
  half-right scaffold.

## Non-Goals

- AdonisJS + Lucid schema/database scaffolds (row-level only for now; the docs carry the setup-agent
  prompts). Follow-up.
- Generating a fully-working app. Scaffolds are starter files with TODOs at the per-tenant
  connection/schema boundary, matching the existing row-level scaffolds.
- Provisioning the schemas/databases themselves (that stays a reviewed host step; see `tenancy policy`
  for the RLS DDL and the provisioning guide).
