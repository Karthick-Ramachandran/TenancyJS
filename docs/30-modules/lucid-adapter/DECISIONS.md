# Module Decisions: Lucid Adapter

## Current Decisions

- ADR-0001 requires a dedicated Lucid surface even when Knex primitives are shared.
- ADR-0010 accepts model lifecycle hooks plus forced PostgreSQL RLS; hooks alone are not sufficient.
- ADR-0014 sets the Lucid 22.4 / AdonisJS 7.3 target (replacing ADR-0010's initial Lucid version
  clause), with PostgreSQL 17 isolation under ADR-0010 on the ADR-0013 Node 24 baseline.
- ADR-0019 centralizes PostgreSQL enforcement and accepts adapter-enforced schema-per-tenant; it does
  not expand the guarantee to retained database services or hook-skipping paths.
