# Module Decisions: Lucid Adapter

## Current Decisions

- ADR-0001 requires a dedicated Lucid surface even when Knex primitives are shared.
- ADR-0010 accepts model lifecycle hooks plus forced PostgreSQL RLS; hooks alone are not sufficient.
- ADR-0012 replaces ADR-0010's initial Lucid version clause: target Lucid 22.4 with AdonisJS 7.3 and
  PostgreSQL 17 on Node 24.
