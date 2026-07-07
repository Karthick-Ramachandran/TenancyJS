# tenancyjs-adapter-drizzle

## 0.2.0

### Minor Changes

- Generalize the `unrestricted()` escape hatch to forced-RLS row-level on PostgreSQL (ADR-0038): raw SQL,
  joins, and nested queries are now available in forced-RLS row-level tenant scopes (not just
  database-per-tenant), bound to the tenant by the validated RLS policy. Sequelize's `unrestricted()` now
  returns `{ sequelize, transaction }`; the other adapters return their native transaction handle. Add an
  RLS-backed Prisma row-level path (ADR-0037): `createPrismaRowLevelTenancy` runs scoped work in an
  interactive transaction with a `SET LOCAL` tenant GUC, so Prisma gains a real database backstop. The CLI
  now scaffolds every SQL ORM on Next.js (not only Prisma) and asks for the ORM + strategy interactively.
