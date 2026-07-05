# Architecture Impact

## New Boundary

`tenancyjs-adapter-drizzle` is a data-layer adapter beside Prisma, Knex, Lucid, TypeORM, Sequelize,
and Mongoose. It depends on core for context and adapter-shared for PostgreSQL enforcement,
discriminator decisions, and bounded database routing. Core remains ORM- and database-neutral.

## Public Boundary

`createDrizzleTenancy` receives a host-owned Drizzle database plus exhaustive table registration and
returns `validate`, `run`, and `close`. `run` provides immutable protected table facades only. Native
database, transaction, SQL expression, relation, migration, and schema handles never cross the
boundary.

## Dialects

PostgreSQL uses the shared forced-RLS and schema engine. MySQL row-level omits PostgreSQL session SQL
and relies only on the protected predicate facade; validation must report that weaker tier. Database
routing remains dialect-neutral and uses `createTenantResourceCache`.

## CLI

Init selection changes from a framework-to-one-ORM mapping to an explicit supported stack pair.
Detection chooses installed ORMs deterministically and fails on ambiguity rather than silently picking
one. Templates remain fixed, previewable, non-overwriting writes.

