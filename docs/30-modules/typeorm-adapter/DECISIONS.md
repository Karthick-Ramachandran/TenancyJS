# Module Decisions: Typeorm Adapter

Record durable module decisions here.

## Current Decisions

- ADR-0024 owns the TypeORM 1/PostgreSQL protected-repository boundary.
- ADR-0032 extends the facade to MySQL adapter-enforced row and database routing; schema mode remains
  PostgreSQL-only.
- Native repositories and entities are implementation details; returned values expose no manager.
- ORM-neutral SQL/context/cache behavior comes from adapter-shared, never a TypeORM reimplementation.
