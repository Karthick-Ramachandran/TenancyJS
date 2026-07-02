# Plan: Knex, Lucid, And AdonisJS Vertical Slice

## Approach

1. Review and accept ADR-0010/ADR-0012, then freeze peer ranges and public names.
2. Implement the narrow Knex/PostgreSQL enforcement core first: configuration, table classification,
   managed transaction context, protected builder facade, RLS policy validation, errors, and matrix.
3. Prove Knex against the shared adapter contract and adversarial PostgreSQL tests before composing it
   into Lucid.
4. Implement the distinct Lucid model/transaction layer. Use model hooks for native ergonomics and RLS
   for final coverage of hook-bypassing Lucid paths; never advertise generic Knex tests as Lucid proof.
5. Implement the Adonis provider and HTTP middleware over the proven Lucid service, followed by Japa
   helpers and thin Ace wrappers over existing CLI services.
6. Extend safe CLI templates/detection, add generic Knex and Adonis/Lucid examples, and run production
   HTTP/Japa/PostgreSQL/package-consumer evidence on Node 24 while preserving Knex evidence on Node
   22 and 24.
7. Complete independent conventions, architecture-drift, security, module-memory, and completion
   reviews before promoting the compatibility matrix.

## Boundaries

- The protected client/facade is the only guaranteed Knex surface; the base Knex instance is private.
- Tenant SQL runs in a managed transaction with transaction-local identity. No session setting may
  survive commit, rollback, thrown callbacks, or pooled-connection reuse.
- Runtime never creates or alters RLS policies. Migrations own DDL; startup validation proves required
  policies and application-role behavior before support is claimed.
- Initially reject raw SQL, query-builder internals, schema/migration/seed APIs, joins/unions/subqueries,
  unsafe OR/clear operations, connection escape, and unknown methods until each is independently proven.
- Lucid hooks provide model-native behavior but are not the sole security boundary. RLS must protect
  `.pojo()`, quiet writes, bulk changes, relationships, and direct builder paths.
- HTTP middleware runs only on tenant route groups. Central routes do not infer central mode from a
  resolver failure, and streaming work after middleware settlement is outside the supported scope.
- Ace operational migration/seed/list behavior remains T-10; T-08 wrappers expose only services the
  shared CLI already owns.
