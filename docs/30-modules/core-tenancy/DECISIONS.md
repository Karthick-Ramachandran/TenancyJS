# Module Decisions: Core Tenancy

Record durable module decisions here.

## Current Decisions

- Accepted: use layered package boundaries from ADR-0001.
- Accepted: use async-local tenant context with strict fail-closed defaults from ADR-0002.
- Accepted: use the lexical lifecycle, shallow tenant snapshot, bootstrapper/event ordering, and error
  semantics from ADR-0005.
- Accepted: core owns only the ORM-neutral adapter capability/validation vocabulary from ADR-0007;
  Prisma implementation remains in its adapter package.
- Product constraint: row-level isolation is delivered and proven before database-per-tenant behavior.
- Module constraint: core contains no framework or ORM dependency and no mutable global tenant state.

ADR-0001, ADR-0002, ADR-0005, and ADR-0007 are accepted repository source of truth.
