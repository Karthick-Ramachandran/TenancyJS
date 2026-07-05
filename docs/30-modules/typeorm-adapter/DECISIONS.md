# Module Decisions: Typeorm Adapter

Record durable module decisions here.

## Current Decisions

- ADR-0024 owns the TypeORM 1/PostgreSQL protected-repository boundary.
- Native repositories and entities are implementation details; returned values expose no manager.
- ORM-neutral SQL/context/cache behavior comes from adapter-shared, never a TypeORM reimplementation.
