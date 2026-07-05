# Test Plan

## Unit

- Reject invalid dialect/strategy combinations, duplicate/unknown tables, unsafe criteria and values,
  discriminator conflicts, missing context, pre-validation execution, and post-close access.
- Preserve central/tenant classification and bounded-cache collision/lifecycle invariants.
- CLI detects each ORM, rejects ambiguous detection, selects exact stack pairs, and produces idempotent
  non-overwriting plans.

## Real PostgreSQL

- Drizzle row: forced RLS, colliding IDs, CRUD/count, tenant move rejection, rollback, pooled reuse.
- Drizzle schema: two schemas, colliding IDs, cross-read/update/delete denial, mapping collision.
- Drizzle database: two databases, colliding IDs, cross-read/write denial and cache routing.

## Real MySQL

- Drizzle, TypeORM, Sequelize row: same table and colliding IDs, protected facade cannot read/update/
  delete another tenant; missing/native escape surfaces are absent.
- Drizzle, TypeORM, Sequelize database: physically separate databases with colliding IDs and routing/
  cache collision evidence.

## Release

- Package typecheck/build/pack import.
- Full `pnpm check`, website production build, dependency audit, and `persist doctor`.
- Hosted CI remains required before release claims if local Docker lanes cannot run.

