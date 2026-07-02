# Module Decisions: Lucid Adapter

## Current Decisions

- ADR-0001 requires a dedicated Lucid surface even when Knex primitives are shared.
- ADR-0010 accepts model lifecycle hooks plus forced PostgreSQL RLS; hooks alone are not sufficient.
- Initial target is Lucid 21.8 with AdonisJS 6.21 on Node 22/24. Lucid 22/AdonisJS 7 is deferred.
