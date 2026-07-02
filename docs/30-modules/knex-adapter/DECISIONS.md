# Module Decisions: Knex Adapter

## Current Decisions

- ADR-0001 requires a separate public Knex adapter; ADR-0010 accepts its enforcement contract.
- The initial target is Knex 3.3/PostgreSQL 17 on Node 22/24, not generic SQL-provider support.
- Query predicates and forced RLS are complementary; neither an experimental global extension nor
  caller-visible base client is accepted as the sole security boundary.
