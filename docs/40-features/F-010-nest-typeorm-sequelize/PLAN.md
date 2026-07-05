# Plan: Nest Typeorm Sequelize

## Approach

1. Implement Nest resolution store, explicit route metadata, guard, Observable-lifetime interceptor,
   dynamic module, and dual-platform lifecycle tests.
2. Build a small shared protected-operation policy vocabulary only where both SQL adapters genuinely
   share behavior; keep ORM invocation in each adapter.
3. Implement TypeORM row-level vertical slice and real PostgreSQL evidence, then schema and database
   routing over existing shared engines.
4. Implement Sequelize 6 using the same invariants and shared engines, with explicit transactions and
   plain returned values.
5. Add Nest + one SQL adapter E2E, capability/CLI/docs updates, packed-consumer checks, and final reviews.

## Boundaries

- No native manager/model/base client escapes.
- No capability is marked supported before its real-database or lifecycle evidence passes.
- No Sequelize 7 alpha or unproven MySQL claim.
- Relations/associations and arbitrary criteria stay rejected until each widening is adversarially tested.
