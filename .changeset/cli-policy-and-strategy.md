---
"tenancyjs-cli": minor
---

Add `tenancy policy` to generate review-ready PostgreSQL forced-RLS DDL (prints SQL, executes nothing),
add `tenancy init --strategy <row-level|schema-per-tenant|database-per-tenant>` with an interactive
strategy prompt (Express + Sequelize/TypeORM/Drizzle and Express/Next + Prisma scaffolds; fails closed
for combos not scaffolded yet), and correct the init banner to reflect that init scaffolds row-level by
default while --strategy scaffolds the other placements.
