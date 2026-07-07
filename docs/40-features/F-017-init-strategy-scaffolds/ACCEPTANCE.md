# Acceptance Criteria: Init Strategy Scaffolds

## Criteria

- `tenancyjs-cli init` with no `--strategy` still scaffolds row-level; the plan's `strategy` is `rowLevel`
  and the generated files are byte-identical to before. (Verified: existing init tests unchanged.)
- `tenancyjs-cli init --strategy database-per-tenant` (Express + Sequelize/TypeORM/Drizzle) scaffolds a
  register helper that calls the adapter's real factory with `strategy: "databasePerTenant"` and a
  `connection: (tenant) => ({ key, create })` factory.
- `tenancyjs-cli init --strategy schema-per-tenant` scaffolds `strategy: "schemaPerTenant"` with a
  `schema: (tenant) => ...` factory.
- Prisma uses `createPrismaSchemaTenancy` (schema) / `createPrismaDatabaseTenancy` (database) - not the
  row-level extension.
- An unknown `--strategy` value and `--strategy` outside `init` both fail with a clear usage error.
- A combo without a scaffold (e.g. AdonisJS + Lucid database-per-tenant) fails closed with a message
  pointing to the stack docs, and writes nothing.
- All generated snippets use real, verified factory and option names (no invented API).

## Out Of Scope

- Compiling the generated project end to end (the scaffolds have deliberate TODOs at the per-tenant
  connection boundary).
- AdonisJS + Lucid schema/database scaffolds.
